import AppKit
import HappyLabsCore
import SwiftUI

@main
struct HappyLabsApp: App {
    @StateObject private var appModel = AppModel()

    init() {
        NSApplication.shared.setActivationPolicy(.regular)
    }

    var body: some Scene {
        WindowGroup {
            JournalRootView()
                .environmentObject(appModel)
                .frame(minWidth: 960, minHeight: 640)
                .onAppear {
                    NSApp.activate()
                }
        }
    }
}

@MainActor
final class AppModel: ObservableObject {
    let persistence = PersistenceController.shared
    let orchestrator: PipelineOrchestrator
    let reviewService: HumanReviewService
    let exportService: ExportService
    let coherenceService: CoherenceReportService
    let morningstarStore: MorningstarStore?

    @Published var lastImportID: UUID?
    @Published var coherenceReport: CoherenceReport?
    @Published var statusMessage = "Import a Mail.app .mbox export to begin."
    @Published var journalEntries: [JournalEntryEntity] = []
    @Published var journalRows: [JournalEntryRow] = []
    @Published var journalCountLine = "0 ENTRIES · 0 ARCHIVED · 0 IN REVIEW"
    @Published var contextSources: [ContinuitySource] = []
    @Published var contextRows: [ContextSourceRow] = []
    @Published var contextCountLine = "0 CAPTURED · PRE-ARCHIVAL"
    @Published var transformationLogs: [TransformationLogEntity] = []
    @Published var isBusy = false
    @Published var importProgressMessage: String?
    @Published var importProgressFraction: Double?
    @Published var importScopeTitle: String?
    @Published var pendingImportURL: URL?
    @Published var selectedImportScope: ImportScope = .lastMonth
    @Published var mailboxPreview: MailboxPreview?
    @Published var morningstarCaptures: [MorningstarCapture] = []
    @Published var morningstarVerification: MorningstarVerificationReport?

    private var importTask: Task<Void, Never>?
    private var activeImportID: UUID?
    private let dataResetService: DataResetService

    init() {
        orchestrator = PipelineOrchestrator(persistence: persistence)
        reviewService = HumanReviewService(persistence: persistence)
        exportService = ExportService(persistence: persistence)
        coherenceService = CoherenceReportService(persistence: persistence)
        dataResetService = DataResetService(persistence: persistence)
        morningstarStore = try? MorningstarStore(url: MorningstarStore.defaultStoreURL())
        refresh()
    }

    func refresh() {
        let context = persistence.container.viewContext
        let repo = EntityRepository(context: context)
        journalEntries = (try? repo.fetchJournalEntries()) ?? []
        contextSources = (try? repo.fetchContinuitySources(state: .captured)) ?? []
        transformationLogs = (try? repo.fetchTransformationLogs()) ?? []
        refreshMorningstar()
        rebuildPresentation()
    }

    func refreshMorningstar() {
        guard let morningstarStore else {
            morningstarCaptures = []
            morningstarVerification = nil
            return
        }
        morningstarCaptures = (try? morningstarStore.captures()) ?? []
        morningstarVerification = try? morningstarStore.verify()
    }

    @discardableResult
    func commitMorningstarCapture(
        _ input: MorningstarCaptureInput,
        attachingTo journalEntryID: UUID?
    ) throws -> MorningstarCapture {
        guard let morningstarStore else {
            throw MorningstarStoreError.database("the native evidence store could not be opened")
        }
        let capture = try morningstarStore.commitCapture(input)
        if let journalEntryID {
            guard journalEntries.contains(where: { $0.provenanceID == journalEntryID }) else {
                throw MorningstarStoreError.journalEntryNotFound
            }
            _ = try morningstarStore.attach(captureID: capture.id, toJournalEntryID: journalEntryID)
        }
        refreshMorningstar()
        statusMessage = journalEntryID == nil
            ? "Committed Morningstar capture \(String(format: "%03d", capture.sequenceNumber))."
            : "Committed and attached Morningstar capture \(String(format: "%03d", capture.sequenceNumber))."
        return capture
    }

    func attachMorningstarCapture(_ captureID: UUID, to journalEntryID: UUID) throws {
        guard let morningstarStore else {
            throw MorningstarStoreError.database("the native evidence store could not be opened")
        }
        guard journalEntries.contains(where: { $0.provenanceID == journalEntryID }) else {
            throw MorningstarStoreError.journalEntryNotFound
        }
        _ = try morningstarStore.attach(captureID: captureID, toJournalEntryID: journalEntryID)
        refreshMorningstar()
        statusMessage = "Attached Morningstar evidence to the journal entry."
    }

    func morningstarEvidence(for journalEntryID: UUID) -> [MorningstarEvidenceDetail] {
        guard let morningstarStore,
              let attachments = try? morningstarStore.attachments(journalEntryID: journalEntryID) else {
            return []
        }
        let verificationByID = Dictionary(
            uniqueKeysWithValues: (morningstarVerification?.captures ?? []).map { ($0.captureID, $0) }
        )
        return attachments.compactMap { attachment in
            guard let capture = try? morningstarStore.capture(id: attachment.captureID) else { return nil }
            return MorningstarEvidenceDetail(
                capture: capture,
                attachment: attachment,
                annotations: (try? morningstarStore.annotations(captureID: capture.id)) ?? [],
                verification: verificationByID[capture.id]
            )
        }
    }

    private func rebuildPresentation() {
        journalRows = JournalPresentationBuilder.rows(
            from: journalEntries,
            context: persistence.container.viewContext
        )
        journalCountLine = JournalPresentationBuilder.countLine(entries: journalRows)
        contextRows = JournalPresentationBuilder.contextRows(from: contextSources)
        contextCountLine = JournalPresentationBuilder.contextCountLine(rows: contextRows)
    }

    func pickMboxImport() {
        guard !isBusy else { return }
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.init(filenameExtension: "mbox")!]
        panel.canChooseFiles = true
        panel.canChooseDirectories = true
        panel.treatsFilePackagesAsDirectories = false
        if panel.runModal() == .OK, let url = panel.url {
            pendingImportURL = url
            loadMailboxPreview(for: url)
        }
    }

    func loadMailboxPreview(for url: URL) {
        mailboxPreview = nil
        Task.detached(priority: .utility) {
            let preview = try? MailboxPreviewReader.preview(at: url)
            await MainActor.run {
                guard self.pendingImportURL == url else { return }
                self.mailboxPreview = preview
                if preview?.isLegacyArchive == true {
                    self.selectedImportScope = .everything
                }
            }
        }
    }

    func clearAllJournalData() {
        isBusy = true
        defer { isBusy = false }
        do {
            try dataResetService.clearAllData()
            lastImportID = nil
            coherenceReport = nil
            statusMessage = "Cleared all journal data on this device."
            refresh()
        } catch {
            statusMessage = "Clear failed: \(error.localizedDescription)"
        }
    }

    func beginImport(from url: URL, scope: ImportScope) {
        importTask?.cancel()
        activeImportID = nil
        isBusy = true
        importScopeTitle = scope.title
        importProgressMessage = "Preparing import…"
        importProgressFraction = 0
        statusMessage = "Importing (\(scope.title))…"

        let orchestrator = orchestrator
        let entryCountBefore = journalEntries.count
        let fileName = url.lastPathComponent
        importTask = Task { @MainActor in
            var importEntityID: UUID?
            do {
                setImportProgress("Reading and parsing messages…", fraction: 0.08)
                let importOutput = try await runImportStage {
                    try orchestrator.importMbox(at: url, scope: scope) { update in
                        Task { @MainActor in
                            self.importProgressMessage = update.message
                        }
                    }
                }
                setImportProgress("Mailbox saved. Preparing thread clusters…", fraction: 0.26)
                importEntityID = importOutput.importEntityID
                activeImportID = importOutput.importEntityID
                try Task.checkCancellation()

                setImportProgress("Clustering threads…", fraction: 0.32)
                let threadOutput = try await runImportStage {
                    try orchestrator.runThreadCluster(mboxImportID: importOutput.importEntityID)
                }
                setImportProgress("Threads clustered. Finding stories…", fraction: 0.48)
                try Task.checkCancellation()

                setImportProgress("Extracting stories…", fraction: 0.54)
                let storyOutput = try await runImportStage {
                    try orchestrator.runStoryExtraction(threadIDs: threadOutput.threadIDs)
                }
                setImportProgress("Stories extracted. Drafting journal entries…", fraction: 0.70)
                try Task.checkCancellation()

                setImportProgress("Weaving journal drafts…", fraction: 0.76)
                _ = try await runImportStage {
                    try orchestrator.runJournalDraft(storyCandidateIDs: storyOutput.storyCandidateIDs)
                }
                setImportProgress("Drafts ready. Building coherence report…", fraction: 0.90)
                try Task.checkCancellation()

                setImportProgress("Finishing up…", fraction: 0.94)
                let coherenceReport = try await runImportStage {
                    try CoherenceReportService(persistence: orchestrator.persistence)
                        .generate(mboxImportID: importOutput.importEntityID)
                }
                setImportProgress("Import complete.", fraction: 1)
                try Task.checkCancellation()

                lastImportID = importOutput.importEntityID
                self.coherenceReport = coherenceReport
                activeImportID = nil
                finishImport()
                refresh()
                let added = journalEntries.count - entryCountBefore
                let skipped = importOutput.totalParsedCount - importOutput.messageCount
                if skipped > 0 {
                    statusMessage = "Added \(added) drafts from \(fileName) (\(importOutput.messageCount) of \(importOutput.totalParsedCount) messages matched \(scope.title)). \(journalEntries.count) total."
                } else {
                    statusMessage = "Added \(added) drafts from \(fileName). \(journalEntries.count) entries in the journal."
                }
                mailboxPreview = nil
            } catch is CancellationError {
                if let importEntityID {
                    try? await runImportStage {
                        try orchestrator.rollbackImport(mboxImportID: importEntityID)
                    }
                }
                activeImportID = nil
                statusMessage = "Import cancelled."
                finishImport()
                refresh()
            } catch {
                if let importEntityID {
                    try? await runImportStage {
                        try orchestrator.rollbackImport(mboxImportID: importEntityID)
                    }
                }
                activeImportID = nil
                statusMessage = "Import failed: \(error.localizedDescription)"
                finishImport()
                refresh()
            }
        }
    }

    func cancelImport() {
        importTask?.cancel()
    }

    private func runImportStage<T: Sendable>(_ work: @escaping @Sendable () throws -> T) async throws -> T {
        let task = Task.detached(priority: .userInitiated) {
            try work()
        }
        return try await withTaskCancellationHandler {
            try await task.value
        } onCancel: {
            task.cancel()
        }
    }

    private func setImportProgress(_ message: String, fraction: Double) {
        importProgressMessage = message
        importProgressFraction = min(max(fraction, 0), 1)
    }

    private func finishImport() {
        isBusy = false
        importProgressMessage = nil
        importProgressFraction = nil
        importScopeTitle = nil
        importTask = nil
    }

    func applyDecision(entry: JournalEntryEntity, action: HumanDecisionAction, title: String, body: String) {
        isBusy = true
        defer { isBusy = false }
        do {
            // Content-addressed: the reference is the capture's integrity hash, so a
            // revision fingerprint transitively commits to capture content, not a row id.
            let morningstarReferences = ((try? morningstarStore?.attachedCaptures(journalEntryID: entry.provenanceID)) ?? [])
                .map { $0.capture.integrityHash }
            try reviewService.applyDecision(
                journalEntryID: entry.provenanceID,
                action: action,
                editedTitle: title == entry.title ? nil : title,
                editedBodyMarkdown: body == entry.bodyMarkdown ? nil : body,
                evidenceReferences: morningstarReferences
            )
            if let importID = lastImportID {
                coherenceReport = try coherenceService.generate(mboxImportID: importID)
            }
            statusMessage = "Applied \(action.rawValue) to \(title)."
            refresh()
        } catch {
            statusMessage = "Review action failed: \(error.localizedDescription)"
        }
    }

    func exportJSON(entry: JournalEntryEntity) throws -> URL {
        let data = try exportService.exportJSON(entryID: entry.provenanceID)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(entry.provenanceID.uuidString).json")
        try data.write(to: url)
        return url
    }

    func exportMarkdown(entry: JournalEntryEntity) throws -> URL {
        let markdown = try exportService.exportMarkdown(entryID: entry.provenanceID)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(entry.provenanceID.uuidString).md")
        try markdown.write(to: url, atomically: true, encoding: .utf8)
        return url
    }

    func exportCoherenceJSON() throws -> URL {
        guard let report = coherenceReport else {
            throw CoherenceExportError.missingReport
        }
        let data = try coherenceService.exportJSON(report: report)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("coherence-\(report.mboxImportID.uuidString).json")
        try data.write(to: url)
        return url
    }

    func exportCoherenceMarkdown() throws -> URL {
        guard let report = coherenceReport else {
            throw CoherenceExportError.missingReport
        }
        let markdown = coherenceService.exportMarkdown(report: report)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("coherence-\(report.mboxImportID.uuidString).md")
        try markdown.write(to: url, atomically: true, encoding: .utf8)
        return url
    }
}

private enum CoherenceExportError: LocalizedError {
    case missingReport

    var errorDescription: String? {
        "Run an import before exporting a coherence report."
    }
}
