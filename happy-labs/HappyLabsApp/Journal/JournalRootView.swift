import HappyLabsCore
import SwiftUI

struct JournalRootView: View {
    @EnvironmentObject private var appModel: AppModel
    @State private var openEntryID: UUID?
    @State private var provenanceExpanded = false

    var body: some View {
        ZStack {
            scrollContent

            if appModel.isBusy, let message = appModel.importProgressMessage {
                ImportProgressOverlay(
                    message: message,
                    scopeTitle: appModel.importScopeTitle ?? "Import",
                    onCancel: { appModel.cancelImport() }
                )
            }
        }
        .background(JournalTheme.paper)
        .sheet(item: importSheetBinding) { item in
            ImportScopeSheet(
                fileName: item.url.lastPathComponent,
                selectedScope: $appModel.selectedImportScope,
                onCancel: { appModel.pendingImportURL = nil },
                onImport: {
                    let url = item.url
                    appModel.pendingImportURL = nil
                    appModel.beginImport(from: url, scope: appModel.selectedImportScope)
                }
            )
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button("Import .mbox…") { pickMbox() }
                        .disabled(appModel.isBusy)
                    Divider()
                    Button("Export Coherence JSON…") { exportCoherenceJSON() }
                        .disabled(appModel.coherenceReport == nil)
                    Button("Export Coherence Markdown…") { exportCoherenceMarkdown() }
                        .disabled(appModel.coherenceReport == nil)
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundStyle(JournalTheme.muted)
                }
                .menuStyle(.borderlessButton)
            }
        }
    }

    private var importSheetBinding: Binding<ImportSheetItem?> {
        Binding(
            get: { appModel.pendingImportURL.map { ImportSheetItem(url: $0) } },
            set: { appModel.pendingImportURL = $0?.url }
        )
    }

    private var scrollContent: some View {
        ScrollView {
            VStack(spacing: 0) {
                JournalMasthead()
                    .padding(.horizontal, 28)
                    .padding(.top, 34)

                if let openEntryID, let detail = detail(for: openEntryID) {
                    JournalReaderView(
                        detail: detail,
                        provenanceExpanded: $provenanceExpanded,
                        onBack: {
                            withAnimation(.easeOut(duration: 0.2)) {
                                self.openEntryID = nil
                                provenanceExpanded = false
                            }
                        },
                        onArchive: { decide(.approve, entryID: openEntryID) },
                        onKeep: { decide(.retain, entryID: openEntryID) },
                        onDiscard: { decide(.discard, entryID: openEntryID) }
                    )
                    .padding(.horizontal, 28)
                    .transition(.opacity.combined(with: .move(edge: .trailing)))
                } else {
                    JournalLibraryView(
                        rows: appModel.journalRows,
                        countLine: appModel.journalCountLine,
                        isEmpty: appModel.journalRows.isEmpty,
                        onImport: { guard !appModel.isBusy else { return }; pickMbox() },
                        onOpen: { id in
                            withAnimation(.easeOut(duration: 0.2)) {
                                openEntryID = id
                                provenanceExpanded = false
                            }
                        }
                    )
                    .padding(.horizontal, 28)
                }

                if !appModel.statusMessage.isEmpty, appModel.journalRows.isEmpty || appModel.isBusy {
                    Text(appModel.statusMessage)
                        .font(.system(size: 11))
                        .foregroundStyle(JournalTheme.muted)
                        .padding(.top, 24)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.bottom, 96)
        }
    }

    private func detail(for id: UUID) -> JournalEntryDetail? {
        guard let entry = appModel.journalEntries.first(where: { $0.provenanceID == id }) else { return nil }
        return JournalPresentationBuilder.detail(
            for: entry,
            context: appModel.persistence.container.viewContext
        )
    }

    private func decide(_ action: HumanDecisionAction, entryID: UUID) {
        guard let entry = appModel.journalEntries.first(where: { $0.provenanceID == entryID }) else { return }
        appModel.applyDecision(entry: entry, action: action, title: entry.title, body: entry.bodyMarkdown)
        if action == .approve || action == .discard {
            withAnimation {
                openEntryID = nil
                provenanceExpanded = false
            }
        }
    }

    private func pickMbox() {
        appModel.pickMboxImport()
    }

    private func exportCoherenceJSON() {
        do {
            let url = try appModel.exportCoherenceJSON()
            NSWorkspace.shared.activateFileViewerSelecting([url])
        } catch {
            appModel.statusMessage = error.localizedDescription
        }
    }

    private func exportCoherenceMarkdown() {
        do {
            let url = try appModel.exportCoherenceMarkdown()
            NSWorkspace.shared.activateFileViewerSelecting([url])
        } catch {
            appModel.statusMessage = error.localizedDescription
        }
    }
}

#if os(macOS)
import AppKit
#endif

private struct ImportSheetItem: Identifiable {
    let url: URL
    var id: String { url.path }
}
