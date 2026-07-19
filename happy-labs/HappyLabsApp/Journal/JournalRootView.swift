import HappyLabsCore
import SwiftUI

struct JournalRootView: View {
    @EnvironmentObject private var appModel: AppModel
    @State private var openEntryID: UUID?
    @State private var showConnectome = false
    @State private var provenanceExpanded = false
    @State private var showMorningstar = false

    var body: some View {
        ZStack {
            scrollContent

            if appModel.isBusy, let message = appModel.importProgressMessage {
                ImportProgressOverlay(
                    message: message,
                    progress: appModel.importProgressFraction,
                    scopeTitle: appModel.importScopeTitle ?? "Import",
                    onCancel: { appModel.cancelImport() }
                )
            }
        }
        .background(JournalTheme.paper)
        .sheet(item: importSheetBinding) { item in
            ImportScopeSheet(
                fileName: item.url.lastPathComponent,
                preview: appModel.mailboxPreview,
                selectedScope: $appModel.selectedImportScope,
                onCancel: {
                    appModel.pendingImportURL = nil
                    appModel.mailboxPreview = nil
                },
                onImport: {
                    let url = item.url
                    appModel.pendingImportURL = nil
                    appModel.beginImport(from: url, scope: appModel.selectedImportScope)
                }
            )
        }
        .sheet(isPresented: $showMorningstar) {
            MorningstarPanelView()
                .environmentObject(appModel)
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showMorningstar = true
                } label: {
                    Label("Morningstar", systemImage: "sparkle")
                }
                .help("Capture evidence with Morningstar")
            }
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button("Import .mbox…") { pickMbox() }
                        .disabled(appModel.isBusy)
                    Divider()
                    Button("Export Coherence JSON…") { exportCoherenceJSON() }
                        .disabled(appModel.coherenceReport == nil)
                    Button("Export Coherence Markdown…") { exportCoherenceMarkdown() }
                        .disabled(appModel.coherenceReport == nil)
                    Divider()
                    Button("Clear all journal data…", role: .destructive) {
                        confirmClearAllData()
                    }
                    .disabled(appModel.isBusy)
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
                } else if showConnectome, let graph = connectomeGraph {
                    ConnectomeView(
                        graph: graph,
                        onBack: {
                            withAnimation(.easeOut(duration: 0.2)) {
                                showConnectome = false
                            }
                        },
                        onOpen: { id in
                            withAnimation(.easeOut(duration: 0.2)) {
                                showConnectome = false
                                openEntryID = id
                                provenanceExpanded = false
                            }
                        }
                    )
                    .padding(.horizontal, 28)
                    .transition(.opacity.combined(with: .move(edge: .leading)))
                } else {
                    JournalLibraryView(
                        rows: appModel.journalRows,
                        countLine: appModel.journalCountLine,
                        contextRows: appModel.contextRows,
                        contextCountLine: appModel.contextCountLine,
                        isEmpty: appModel.journalRows.isEmpty,
                        onImport: { guard !appModel.isBusy else { return }; pickMbox() },
                        onOpenConnectome: {
                            guard !appModel.journalRows.isEmpty else { return }
                            withAnimation(.easeOut(duration: 0.2)) {
                                showConnectome = true
                            }
                        },
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

    private var connectomeGraph: ConnectomeGraph? {
        ConnectomeGraphBuilder.build(
            context: appModel.persistence.container.viewContext,
            morningstarStore: appModel.morningstarStore
        )
    }

    private func detail(for id: UUID) -> JournalEntryDetail? {
        guard let entry = appModel.journalEntries.first(where: { $0.provenanceID == id }) else { return nil }
        return JournalPresentationBuilder.detail(
            for: entry,
            context: appModel.persistence.container.viewContext,
            morningstarEvidence: appModel.morningstarEvidence(for: id)
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

    private func confirmClearAllData() {
        let alert = NSAlert()
        alert.messageText = "Clear all journal data?"
        alert.informativeText = "Removes every imported mailbox, draft, and review decision from this device. This cannot be undone."
        alert.alertStyle = .warning
        alert.addButton(withTitle: "Clear Everything")
        alert.addButton(withTitle: "Cancel")
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        appModel.clearAllJournalData()
        openEntryID = nil
        showConnectome = false
        provenanceExpanded = false
    }
}

#if os(macOS)
import AppKit
#endif

private struct ImportSheetItem: Identifiable {
    let url: URL
    var id: String { url.path }
}
