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

    @Published var lastImportID: UUID?
    @Published var coherenceReport: CoherenceReport?
    @Published var statusMessage = "Import a Mail.app .mbox export to begin."
    @Published var journalEntries: [JournalEntryEntity] = []
    @Published var journalRows: [JournalEntryRow] = []
    @Published var journalCountLine = "0 ENTRIES · 0 ARCHIVED · 0 IN REVIEW"
    @Published var transformationLogs: [TransformationLogEntity] = []
    @Published var isBusy = false
    @Published var importProgressMessage: String?
    @Published var importScopeTitle: String?
    @Published var pendingImportURL: URL?
    @Published var selectedImportScope: ImportScope = .lastMonth
    @Published var mailboxPreview: MailboxPreview?

    private var importTask: Task<Void, Never>?
    private let dataResetService: DataResetService

    init() {
        orchestrator = PipelineOrchestrator(persistence: persistence)
        reviewService = HumanReviewService(persistence: persistence)
        exportService = ExportService(persistence: persistence)
        coherenceService = CoherenceReportService(persistence: persistence)
        dataResetService = DataResetService(persistence: persistence)
        refresh()
    }

    func refresh() {
        let context = persistence.container.viewContext
        let repo = EntityRepository(context: context)
        journalEntries = (try? repo.fetchJournalEntries()) ?? []
        transformationLogs = (try? repo.fetchTransformationLogs()) ?? []
        rebuildPresentation()
    }

    private func rebuildPresentation() {
        journalRows = JournalPresentationBuilder.rows(
            from: journalEntries,
            context: persistence.container.viewContext
        )
        journalCountLine = JournalPresentationBuilder.countLine(entries: journalRows)
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
        isBusy = true
        importScopeTitle = scope.title
        importProgressMessage = "Reading mailbox…"
        statusMessage = "Importing (\(scope.title))…"

        let orchestrator = orchestrator
        let entryCountBefore = journalEntries.count
        let fileName = url.lastPathComponent
        importTask = Task { @MainActor in
            do {
                importProgressMessage = "Reading and parsing messages…"
                let importOutput = try await Task.detached(priority: .userInitiated) {
                    try orchestrator.importMbox(at: url, scope: scope)
                }.value
                try Task.checkCancellation()

                importProgressMessage = "Clustering threads…"
                let threadOutput = try await Task.detached(priority: .userInitiated) {
                    try orchestrator.runThreadCluster(mboxImportID: importOutput.importEntityID)
                }.value
                try Task.checkCancellation()

                importProgressMessage = "Extracting stories…"
                let storyOutput = try await Task.detached(priority: .userInitiated) {
                    try orchestrator.runStoryExtraction(threadIDs: threadOutput.threadIDs)
                }.value
                try Task.checkCancellation()

                importProgressMessage = "Weaving journal drafts…"
                _ = try await Task.detached(priority: .userInitiated) {
                    try orchestrator.runJournalDraft(storyCandidateIDs: storyOutput.storyCandidateIDs)
                }.value
                try Task.checkCancellation()

                importProgressMessage = "Finishing up…"
                let coherenceReport = try await Task.detached(priority: .userInitiated) {
                    try CoherenceReportService(persistence: orchestrator.persistence).generate(mboxImportID: importOutput.importEntityID)
                }.value
                try Task.checkCancellation()

                lastImportID = importOutput.importEntityID
                self.coherenceReport = coherenceReport
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
                statusMessage = "Import cancelled."
                finishImport()
            } catch {
                statusMessage = "Import failed: \(error.localizedDescription)"
                finishImport()
            }
        }
    }

    func cancelImport() {
        importTask?.cancel()
    }

    private func finishImport() {
        isBusy = false
        importProgressMessage = nil
        importScopeTitle = nil
        importTask = nil
    }

    func applyDecision(entry: JournalEntryEntity, action: HumanDecisionAction, title: String, body: String) {
        isBusy = true
        defer { isBusy = false }
        do {
            try reviewService.applyDecision(
                journalEntryID: entry.provenanceID,
                action: action,
                editedTitle: title == entry.title ? nil : title,
                editedBodyMarkdown: body == entry.bodyMarkdown ? nil : body
            )
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
