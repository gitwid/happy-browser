import CoreData
import Foundation

public struct CoherenceReportService: Sendable {
    public let persistence: PersistenceController

    private static let pipelineCodecOrder = [
        "MboxImportCodec",
        "ThreadClusterCodec",
        "StoryExtractionCodec",
        "JournalDraftCodec"
    ]

    public init(persistence: PersistenceController = .shared) {
        self.persistence = persistence
    }

    public func generate(mboxImportID: UUID) throws -> CoherenceReport {
        let context = persistence.container.viewContext
        context.refreshAllObjects()
        let repo = EntityRepository(context: context)

        guard let importEntity = try repo.fetchMboxImport(id: mboxImportID) else {
            throw CoherenceReportError.importNotFound
        }

        let rawEmails = try repo.fetchRawEmails(mboxImportID: mboxImportID)
        let rawEmailIDs = Set(rawEmails.map(\.provenanceID))

        let threads = try repo.fetchEmailThreads().filter { thread in
            thread.rawEmailIDs.contains { rawEmailIDs.contains($0) }
        }
        let threadIDs = Set(threads.map(\.provenanceID))

        let storyRequest = NSFetchRequest<StoryCandidateEntity>(entityName: "StoryCandidateEntity")
        storyRequest.predicate = NSPredicate(format: "emailThreadID IN %@", Array(threadIDs))
        let stories = try context.fetch(storyRequest)
        let storyIDs = Set(stories.map(\.provenanceID))

        let journalRequest = NSFetchRequest<JournalEntryEntity>(entityName: "JournalEntryEntity")
        journalRequest.predicate = NSPredicate(format: "storyCandidateID IN %@", Array(storyIDs))
        let journalEntries = try context.fetch(journalRequest)
        let journalEntryIDs = Set(journalEntries.map(\.provenanceID))

        let entityIDs = rawEmailIDs
            .union(threadIDs)
            .union(storyIDs)
            .union(journalEntryIDs)
            .union([mboxImportID])

        let logs = try repo.fetchTransformationLogs().filter { log in
            log.loggedAt >= importEntity.importedAt && logTouchesEntitySet(log, entityIDs: entityIDs)
        }

        let decisions = try repo.fetchHumanDecisions(journalEntryIDs: Array(journalEntryIDs))
        let codecStages = buildCodecStages(from: logs)
        let pipelineDurationSeconds = pipelineDuration(from: logs, fallbackStart: importEntity.importedAt)
        let humanReview = buildHumanReview(
            journalEntries: journalEntries,
            decisions: decisions,
            pipelineCompletedAt: logs.map(\.loggedAt).max() ?? importEntity.importedAt,
            importStartedAt: importEntity.importedAt
        )

        let inputMessageCount = Int(importEntity.messageCount)
        let threadCount = threads.count
        let orphanThreadCount = threads.filter(\.isOrphan).count
        let storyCandidateCount = stories.count
        let journalDraftCount = journalEntries.count

        let messagesPerStory = storyCandidateCount > 0
            ? Double(inputMessageCount) / Double(storyCandidateCount)
            : nil
        let structureCoherenceRatio = inputMessageCount > 0
            ? Double(journalDraftCount) / Double(inputMessageCount)
            : 0

        let degradationSignals = buildDegradationSignals(
            inputMessageCount: inputMessageCount,
            threadCount: threadCount,
            orphanThreadCount: orphanThreadCount,
            journalDraftCount: journalDraftCount,
            pendingReviewCount: humanReview.pendingReviewCount
        )

        return CoherenceReport(
            mboxImportID: mboxImportID,
            inputMessageCount: inputMessageCount,
            threadCount: threadCount,
            orphanThreadCount: orphanThreadCount,
            storyCandidateCount: storyCandidateCount,
            journalDraftCount: journalDraftCount,
            pipelineDurationSeconds: pipelineDurationSeconds,
            pipelineCompletedWithoutIntervention: journalDraftCount > 0,
            messagesPerStory: messagesPerStory,
            structureCoherenceRatio: structureCoherenceRatio,
            codecStages: codecStages,
            degradationSignals: degradationSignals,
            humanReview: humanReview
        )
    }

    public func exportJSON(report: CoherenceReport) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return try encoder.encode(report)
    }

    public func exportMarkdown(report: CoherenceReport) -> String {
        let pipelineDuration = String(format: "%.2f", report.pipelineDurationSeconds)
        let structureCoherenceRatio = String(format: "%.4f", report.structureCoherenceRatio)
        var lines = [
            "# Coherence Report",
            "",
            "Import: `\(report.mboxImportID.uuidString)`",
            "Generated: `\(report.generatedAt.formatted(.iso8601))`",
            "",
            "## Hypothesis",
            "",
            "H0: Attention volatility prevents completion.",
            "H1: Attention volatility can be compensated for by external structure, periodic re-synchronization, and residual classification.",
            "",
            "## Structure",
            "",
            "- Input messages: \(report.inputMessageCount)",
            "- Threads: \(report.threadCount)",
            "- Orphan threads: \(report.orphanThreadCount)",
            "- Story candidates: \(report.storyCandidateCount)",
            "- Journal drafts: \(report.journalDraftCount)",
            "- Pipeline duration: \(pipelineDuration) seconds",
            "- Structure coherence ratio: \(structureCoherenceRatio)"
        ]

        if let messagesPerStory = report.messagesPerStory {
            lines.append("- Messages per story: \(String(format: "%.2f", messagesPerStory))")
        }

        lines.append(contentsOf: [
            "",
            "## Human Re-synchronization",
            "",
            "- Pending review: \(report.humanReview.pendingReviewCount)",
            "- Resync events: \(report.humanReview.resyncEventCount)",
            "- Approved: \(report.humanReview.approvedCount)",
            "- Edited: \(report.humanReview.editedCount)",
            "- Retained: \(report.humanReview.retainedCount)",
            "- Discarded: \(report.humanReview.discardedCount)",
            "- Archived: \(report.humanReview.archivedCount)"
        ])

        if let recoveryRate = report.humanReview.recoveryRate {
            lines.append("- Recovery rate: \(String(format: "%.2f", recoveryRate))")
        }
        if let discardRatio = report.humanReview.discardRatio {
            lines.append("- Discard ratio: \(String(format: "%.2f", discardRatio))")
        }

        if !report.codecStages.isEmpty {
            lines.append(contentsOf: ["", "## Codec Stages", ""])
            for stage in report.codecStages {
                let yieldRatio = String(format: "%.2f", stage.yieldRatio)
                lines.append("- \(stage.codecName) @ \(stage.codecVersion): \(stage.transformationCount) transformations, yield \(yieldRatio)")
            }
        }

        if !report.degradationSignals.isEmpty {
            lines.append(contentsOf: ["", "## Degradation Signals", ""])
            for signal in report.degradationSignals {
                lines.append("- \(signal.kind.rawValue): \(signal.detail)")
            }
        }

        return lines.joined(separator: "\n")
    }

    private func logTouchesEntitySet(_ log: TransformationLogEntity, entityIDs: Set<UUID>) -> Bool {
        if entityIDs.contains(log.originRef) {
            return true
        }
        if log.inputEntityIDs.contains(where: entityIDs.contains) {
            return true
        }
        if log.outputEntityIDs.contains(where: entityIDs.contains) {
            return true
        }
        return false
    }

    private func buildCodecStages(from logs: [TransformationLogEntity]) -> [CoherenceCodecStageReport] {
        let grouped = Dictionary(grouping: logs) { "\($0.codecName)|\($0.codecVersion)" }
        let orderedKeys = Self.pipelineCodecOrder.compactMap { codecName in
            grouped.keys.first { $0.hasPrefix("\(codecName)|") }
        }
        let remainingKeys = grouped.keys.filter { key in
            !orderedKeys.contains(key)
        }.sorted()

        return (orderedKeys + remainingKeys).compactMap { key in
            guard let stageLogs = grouped[key], let sample = stageLogs.first else {
                return nil
            }

            let inputCount = stageLogs.reduce(0) { $0 + $1.inputEntityIDs.count }
            let outputCount = stageLogs.reduce(0) { $0 + $1.outputEntityIDs.count }
            let yieldRatio = inputCount > 0 ? Double(outputCount) / Double(inputCount) : 0

            return CoherenceCodecStageReport(
                codecName: sample.codecName,
                codecVersion: sample.codecVersion,
                transformationCount: stageLogs.count,
                totalDurationMs: stageLogs.reduce(0) { $0 + $1.durationMs },
                inputEntityCount: inputCount,
                outputEntityCount: outputCount,
                yieldRatio: yieldRatio
            )
        }
    }

    private func pipelineDuration(from logs: [TransformationLogEntity], fallbackStart: Date) -> Double {
        guard let first = logs.map(\.loggedAt).min(),
              let last = logs.map(\.loggedAt).max() else {
            return 0
        }
        let start = min(first, fallbackStart)
        return max(last.timeIntervalSince(start), 0)
    }

    private func buildHumanReview(
        journalEntries: [JournalEntryEntity],
        decisions: [HumanDecisionEntity],
        pipelineCompletedAt: Date,
        importStartedAt: Date
    ) -> CoherenceHumanReviewReport {
        let pendingReviewCount = journalEntries.filter {
            $0.entryStatus == .draft || $0.entryStatus == .retained
        }.count

        let approvedCount = decisions.filter { $0.decisionAction == .approve }.count
        let editedCount = decisions.filter { $0.decisionAction == .edit }.count
        let retainedCount = decisions.filter { $0.decisionAction == .retain }.count
        let discardedCount = decisions.filter { $0.decisionAction == .discard }.count
        let archivedCount = journalEntries.filter { $0.entryStatus == .archived }.count

        let resolvedCount = archivedCount + discardedCount
        let discardRatio = resolvedCount > 0 ? Double(discardedCount) / Double(resolvedCount) : nil
        let recoveryRate = resolvedCount > 0 ? Double(archivedCount) / Double(resolvedCount) : nil

        let sortedDecisions = decisions.sorted { $0.decidedAt < $1.decidedAt }
        let firstDecisionDelaySeconds = sortedDecisions.first.map {
            max($0.decidedAt.timeIntervalSince(pipelineCompletedAt), 0)
        }
        let pipelineToLastDecisionSeconds = sortedDecisions.last.map {
            max($0.decidedAt.timeIntervalSince(importStartedAt), 0)
        }

        return CoherenceHumanReviewReport(
            pendingReviewCount: pendingReviewCount,
            resyncEventCount: decisions.count,
            approvedCount: approvedCount,
            editedCount: editedCount,
            retainedCount: retainedCount,
            discardedCount: discardedCount,
            archivedCount: archivedCount,
            discardRatio: discardRatio,
            recoveryRate: recoveryRate,
            firstDecisionDelaySeconds: firstDecisionDelaySeconds,
            pipelineToLastDecisionSeconds: pipelineToLastDecisionSeconds
        )
    }

    private func buildDegradationSignals(
        inputMessageCount: Int,
        threadCount: Int,
        orphanThreadCount: Int,
        journalDraftCount: Int,
        pendingReviewCount: Int
    ) -> [CoherenceDegradationSignal] {
        var signals: [CoherenceDegradationSignal] = []

        if orphanThreadCount > 0 {
            signals.append(CoherenceDegradationSignal(
                kind: .orphanThreads,
                detail: "\(orphanThreadCount) thread(s) did not cluster via reply graph"
            ))
        }

        if inputMessageCount > 0 {
            let expectedThreads = Double(inputMessageCount) / 25.0
            if Double(threadCount) < expectedThreads * 0.5 {
                signals.append(CoherenceDegradationSignal(
                    kind: .lowThreadYield,
                    detail: "\(threadCount) threads from \(inputMessageCount) messages (below half of 25:1 target)"
                ))
            }
        }

        if journalDraftCount == 0 {
            signals.append(CoherenceDegradationSignal(
                kind: .noJournalDrafts,
                detail: "Pipeline produced no reviewable journal drafts"
            ))
        }

        if pendingReviewCount > 0 {
            signals.append(CoherenceDegradationSignal(
                kind: .awaitingHumanResync,
                detail: "\(pendingReviewCount) draft(s) awaiting human review checkpoint"
            ))
        }

        return signals
    }
}

public enum CoherenceReportError: Error, LocalizedError {
    case importNotFound

    public var errorDescription: String? {
        switch self {
        case .importNotFound:
            return "Mbox import not found."
        }
    }
}
