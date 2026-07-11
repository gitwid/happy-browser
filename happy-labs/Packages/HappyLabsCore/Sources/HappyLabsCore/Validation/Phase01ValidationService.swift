import CoreData
import Foundation

public enum Phase01ValidationError: Error, LocalizedError {
    case importNotFound
    case mboxNotFound(String)

    public var errorDescription: String? {
        switch self {
        case .importNotFound:
            return "No mbox import found for the requested validation report."
        case .mboxNotFound(let path):
            return "Mailbox not found at \(path)."
        }
    }
}

/// Headless Phase 0.1 validation: run the pipeline on a mailbox, export coherence
/// metrics, and measure per-draft round-trip drift against source thread bodies.
public struct Phase01ValidationService: Sendable {
    private let driftMetric = RoundTripDriftMetric()

    public init() {}

    public func validate(
        mboxURL: URL,
        scope: ImportScope = .lastMonth,
        persistence: PersistenceController? = nil
    ) throws -> Phase01ValidationReport {
        guard FileManager.default.fileExists(atPath: mboxURL.path) else {
            throw Phase01ValidationError.mboxNotFound(mboxURL.path)
        }

        let store = persistence ?? PersistenceController(inMemory: true)
        let orchestrator = PipelineOrchestrator(
            persistence: store,
            summarizationProvider: ExtractiveFallbackProvider()
        )

        let importOutput = try orchestrator.importMbox(at: mboxURL, scope: scope)
        let pipelineOutput = try orchestrator.runFullPipeline(mboxImportID: importOutput.importEntityID)

        return try buildReport(
            mboxDisplayName: mboxURL.lastPathComponent,
            importScope: scope,
            mboxImportID: importOutput.importEntityID,
            coherenceReport: pipelineOutput.coherenceReport,
            persistence: store
        )
    }

    public func report(
        for mboxImportID: UUID,
        mboxDisplayName: String,
        importScope: ImportScope,
        persistence: PersistenceController
    ) throws -> Phase01ValidationReport {
        let coherenceReport = try CoherenceReportService(persistence: persistence).generate(mboxImportID: mboxImportID)
        return try buildReport(
            mboxDisplayName: mboxDisplayName,
            importScope: importScope,
            mboxImportID: mboxImportID,
            coherenceReport: coherenceReport,
            persistence: persistence
        )
    }

    public func exportJSON(report: Phase01ValidationReport) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return try encoder.encode(report)
    }

    public func exportMarkdown(report: Phase01ValidationReport) throws -> String {
        let coherenceMarkdown = CoherenceReportService(persistence: PersistenceController(inMemory: true))
            .exportMarkdown(report: report.coherenceReport)

        var lines = [
            "# Phase 0.1 Validation Report",
            "",
            "Mailbox: `\(report.mboxDisplayName)`",
            "Scope: \(report.importScope)",
            "Import: `\(report.mboxImportID.uuidString)`",
            "Generated: `\(report.generatedAt.formatted(.iso8601))`",
            "",
            "## Drift summary",
            "",
            "- Drafts measured: \(report.driftSummary.draftCount)",
            "- Stable: \(report.driftSummary.stableCount)",
            "- Review: \(report.driftSummary.reviewCount)",
            "- Revise: \(report.driftSummary.reviseCount)"
        ]

        if let meanDrift = report.driftSummary.meanDriftScore {
            lines.append("- Mean drift score: \(String(format: "%.4f", meanDrift))")
        }

        lines.append(contentsOf: [
            "",
            "## Per-draft drift",
            ""
        ])

        for draft in report.draftDriftReports.sorted(by: { $0.title < $1.title }) {
            lines.append("### \(draft.title)")
            lines.append("")
            lines.append("- Thread: \(draft.threadSubject)")
            lines.append("- Messages in thread: \(draft.messageCount)")
            lines.append("- Drift disposition: **\(draft.drift.disposition.rawValue)**")
            lines.append("- Drift score: \(String(format: "%.4f", draft.drift.driftScore))")
            lines.append("- Source preservation: \(String(format: "%.4f", draft.drift.sourcePreservation))")
            if !draft.drift.missingAnchors.isEmpty {
                let sample = draft.drift.missingAnchors.prefix(8).joined(separator: ", ")
                lines.append("- Missing anchors (sample): \(sample)")
            }
            lines.append("")
            lines.append("#### Qualitative review (fill in)")
            lines.append("")
            lines.append("- [ ] Readable without opening the source thread?")
            lines.append("- [ ] Faithful to thread intent?")
            lines.append("- [ ] Useful enough to archive or edit?")
            lines.append("- Decision rationale:")
            lines.append("")
        }

        lines.append("---")
        lines.append("")
        lines.append(coherenceMarkdown)
        return lines.joined(separator: "\n")
    }

    private func buildReport(
        mboxDisplayName: String,
        importScope: ImportScope,
        mboxImportID: UUID,
        coherenceReport: CoherenceReport,
        persistence: PersistenceController
    ) throws -> Phase01ValidationReport {
        let context = persistence.container.viewContext
        context.refreshAllObjects()
        let repo = EntityRepository(context: context)

        guard try repo.fetchMboxImport(id: mboxImportID) != nil else {
            throw Phase01ValidationError.importNotFound
        }

        let rawEmails = try repo.fetchRawEmails(mboxImportID: mboxImportID)
        let rawEmailIDs = Set(rawEmails.map(\.provenanceID))
        let emailsByID = Dictionary(uniqueKeysWithValues: rawEmails.map { ($0.provenanceID, $0) })

        let threads = try repo.fetchEmailThreads().filter { thread in
            thread.rawEmailIDs.contains { rawEmailIDs.contains($0) }
        }
        let threadsByID = Dictionary(uniqueKeysWithValues: threads.map { ($0.provenanceID, $0) })

        let storyRequest = NSFetchRequest<StoryCandidateEntity>(entityName: "StoryCandidateEntity")
        storyRequest.predicate = NSPredicate(
            format: "emailThreadID IN %@",
            Array(threadsByID.keys)
        )
        let stories = try context.fetch(storyRequest)
        let storiesByID = Dictionary(uniqueKeysWithValues: stories.map { ($0.provenanceID, $0) })

        let journalRequest = NSFetchRequest<JournalEntryEntity>(entityName: "JournalEntryEntity")
        journalRequest.predicate = NSPredicate(
            format: "storyCandidateID IN %@",
            Array(storiesByID.keys)
        )
        journalRequest.sortDescriptors = [NSSortDescriptor(key: "title", ascending: true)]
        let journalEntries = try context.fetch(journalRequest)

        var draftDriftReports: [Phase01DraftDriftReport] = []
        for entry in journalEntries {
            guard let story = storiesByID[entry.storyCandidateID],
                  let thread = threadsByID[story.emailThreadID] else {
                continue
            }

            let sourceText = threadSourceText(thread: thread, emailsByID: emailsByID)
            let drift = driftMetric.evaluate(source: sourceText, recovered: entry.bodyMarkdown)
            draftDriftReports.append(
                Phase01DraftDriftReport(
                    journalEntryID: entry.provenanceID,
                    title: entry.title,
                    threadSubject: thread.normalizedSubject,
                    messageCount: thread.rawEmailIDs.count,
                    drift: drift
                )
            )
        }

        let driftSummary = summarizeDrift(draftDriftReports)
        return Phase01ValidationReport(
            mboxDisplayName: mboxDisplayName,
            importScope: importScope.title,
            mboxImportID: mboxImportID,
            coherenceReport: coherenceReport,
            draftDriftReports: draftDriftReports,
            driftSummary: driftSummary
        )
    }

    private func threadSourceText(thread: EmailThreadEntity, emailsByID: [UUID: RawEmailEntity]) -> String {
        let emails = thread.rawEmailIDs.compactMap { emailsByID[$0] }
            .sorted { ($0.dateSent ?? .distantPast) < ($1.dateSent ?? .distantPast) }

        var parts = [thread.normalizedSubject]
        for email in emails {
            parts.append(email.subject)
            parts.append(email.bodyPlain)
        }
        return parts.joined(separator: "\n\n")
    }

    private func summarizeDrift(_ reports: [Phase01DraftDriftReport]) -> Phase01DriftSummary {
        let stableCount = reports.filter { $0.drift.disposition == .stable }.count
        let reviewCount = reports.filter { $0.drift.disposition == .review }.count
        let reviseCount = reports.filter { $0.drift.disposition == .revise }.count
        let meanDriftScore = reports.isEmpty
            ? nil
            : reports.map(\.drift.driftScore).reduce(0, +) / Double(reports.count)

        return Phase01DriftSummary(
            draftCount: reports.count,
            stableCount: stableCount,
            reviewCount: reviewCount,
            reviseCount: reviseCount,
            meanDriftScore: meanDriftScore
        )
    }
}
