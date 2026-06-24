import HappyLabsCore
import SwiftUI

struct JournalHomeView: View {
    @EnvironmentObject private var model: JournalModel
    @State private var selectedEntry: JournalEntrySnapshot?
    @State private var selectedSource: ContinuitySourceSnapshot?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    HeaderPanel(statusLine: model.statusLine)
                    TestBedPanel(message: model.lastFixtureMessage)
                    JournalSection(entries: model.entries, selectedEntry: $selectedEntry)
                    ContextSection(sources: model.contextSources, selectedSource: $selectedSource)
                }
                .padding(.horizontal, 18)
                .padding(.top, 18)
                .padding(.bottom, 40)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Journal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        model.refresh()
                    } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                    .accessibilityIdentifier("refreshJournalButton")
                }
            }
            .navigationDestination(item: $selectedEntry) { entry in
                JournalEntryDetailView(entry: entry)
                    .environmentObject(model)
            }
            .navigationDestination(item: $selectedSource) { source in
                ContinuitySourceDetailView(source: source)
            }
        }
    }
}

private struct HeaderPanel: View {
    let statusLine: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Happy Journal")
                .font(.largeTitle.weight(.semibold))
            Text("Comfort in remembering.")
                .font(.title3)
                .foregroundStyle(.secondary)
            Text(statusLine)
                .font(.footnote.monospaced())
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(.background, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private struct TestBedPanel: View {
    @EnvironmentObject private var model: JournalModel
    let message: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Local Test Bed")
                .font(.headline)

            Button {
                model.seedFixture()
            } label: {
                Label("Seed local fixture", systemImage: "sparkles")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("seedLocalFixtureButton")

            if model.hasDraftEntry {
                Button {
                    model.approveFirstDraft()
                } label: {
                    Label("Approve first draft", systemImage: "checkmark.seal")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .accessibilityIdentifier("approveFirstDraftButton")
            }

            Button(role: .destructive) {
                model.clearLocalData()
            } label: {
                Label("Clear local data", systemImage: "trash")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .accessibilityIdentifier("clearLocalDataButton")

            if let message {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("fixtureMessage")
            }

            Text("Captured context stays in the inbox. Attached context orbits a draft. Archived entries require a human decision record.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .panelStyle()
    }
}

private struct JournalSection: View {
    let entries: [JournalEntrySnapshot]
    @Binding var selectedEntry: JournalEntrySnapshot?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Journal")
                .font(.headline)

            if entries.isEmpty {
                EmptyPanel(
                    title: "No journal entries yet",
                    systemImage: "book.closed",
                    text: "Seed the local fixture to inspect reviewed and awaiting-review journal state."
                )
            } else {
                ForEach(entries.sorted(by: entrySort)) { entry in
                    JournalEntryCard(
                        entry: entry,
                        onInspect: { selectedEntry = entry }
                    )
                }
            }
        }
    }

    private func entrySort(_ lhs: JournalEntrySnapshot, _ rhs: JournalEntrySnapshot) -> Bool {
        if lhs.status == rhs.status {
            return lhs.title < rhs.title
        }
        return lhs.status.sortOrder < rhs.status.sortOrder
    }
}

private struct ContextSection: View {
    let sources: [ContinuitySourceSnapshot]
    @Binding var selectedSource: ContinuitySourceSnapshot?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Context")
                .font(.headline)

            if sources.isEmpty {
                EmptyPanel(
                    title: "No context sources",
                    systemImage: "tray",
                    text: "Captured and attached context will appear here as inspectable evidence."
                )
            } else {
                ForEach(sources.sorted(by: sourceSort)) { source in
                    Button {
                        selectedSource = source
                    } label: {
                        ContextSourceCard(source: source)
                    }
                    .contentShape(Rectangle())
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func sourceSort(_ lhs: ContinuitySourceSnapshot, _ rhs: ContinuitySourceSnapshot) -> Bool {
        if lhs.state == rhs.state {
            return lhs.capturedAt > rhs.capturedAt
        }
        return lhs.state.sortOrder < rhs.state.sortOrder
    }
}

private struct JournalEntryCard: View {
    @EnvironmentObject private var model: JournalModel
    let entry: JournalEntrySnapshot
    let onInspect: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(alignment: .firstTextBaseline) {
                Text(entry.status.label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(entry.status.tint)
                Spacer(minLength: 12)
                Text(shortHash(entry.fingerprint))
                    .font(.caption2.monospaced())
                    .foregroundStyle(.secondary)
            }

            Text(entry.title)
                .font(.headline)
                .foregroundStyle(.primary)

            HStack(spacing: 10) {
                Label("\(entry.attachedContexts.count) context", systemImage: "link")
                Label("\(entry.decisions.count) decisions", systemImage: "person.crop.circle.badge.checkmark")
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            HStack(spacing: 10) {
                Button {
                    onInspect()
                } label: {
                    Label("Inspect", systemImage: "doc.text.magnifyingglass")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("inspectEntryButton")

                if entry.status == .draft {
                    Button {
                        model.approveDraft(entry)
                    } label: {
                        Label("Approve", systemImage: "checkmark.seal")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .accessibilityIdentifier("approveDraftButton")
                }
            }
            .font(.caption.weight(.semibold))
        }
        .panelStyle()
        .contentShape(Rectangle())
    }
}

private struct ContextSourceCard: View {
    let source: ContinuitySourceSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(alignment: .firstTextBaseline) {
                Text(source.state.label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(source.state.tint)
                Spacer(minLength: 12)
                Text(shortHash(source.fingerprint))
                    .font(.caption2.monospaced())
                    .foregroundStyle(.secondary)
            }

            Text(source.title)
                .font(.headline)
                .foregroundStyle(.primary)

            Text(source.sourceURL)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .truncationMode(.middle)

            Label("\(source.attachedEntryCount) attached entries", systemImage: "book.pages")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .panelStyle()
        .contentShape(Rectangle())
    }
}

private struct JournalEntryDetailView: View {
    @EnvironmentObject private var model: JournalModel
    let entry: JournalEntrySnapshot

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                StateBadge(label: entry.status.label, color: entry.status.tint)

                Text(entry.title)
                    .font(.largeTitle.weight(.semibold))

                Text(entry.body)
                    .font(.body)
                    .textSelection(.enabled)

                if entry.status == .draft {
                    Button {
                        model.approveDraft(entry)
                    } label: {
                        Label("Approve draft into archive", systemImage: "checkmark.seal")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .accessibilityIdentifier("approveDraftButton")
                }

                DetailSection(title: "Attached Context") {
                    if entry.attachedContexts.isEmpty {
                        Text("No attached context.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(entry.attachedContexts) { source in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(source.title)
                                    .font(.subheadline.weight(.semibold))
                                Text("\(source.state.label) · \(shortHash(source.fingerprint))")
                                    .font(.caption.monospaced())
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                DetailSection(title: "Human Decisions") {
                    if entry.decisions.isEmpty {
                        Text("No human decision recorded yet.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(entry.decisions) { decision in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(decision.action.label)
                                    .font(.subheadline.weight(.semibold))
                                Text("\(decision.decidedAt.formatted(date: .abbreviated, time: .shortened)) · \(shortHash(decision.fingerprint))")
                                    .font(.caption.monospaced())
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                ProvenanceBlock(
                    sourceClass: entry.sourceClass.displayName,
                    originRef: entry.originRef,
                    fingerprint: entry.fingerprint
                )
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Entry")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct ContinuitySourceDetailView: View {
    let source: ContinuitySourceSnapshot

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                StateBadge(label: source.state.label, color: source.state.tint)

                Text(source.title)
                    .font(.largeTitle.weight(.semibold))

                Text(source.bodyText)
                    .font(.body)
                    .textSelection(.enabled)

                DetailSection(title: "Source") {
                    Text(source.sourceURL)
                        .font(.caption)
                        .textSelection(.enabled)
                    Text("\(source.kind.rawValue) · \(source.sourceClass.displayName)")
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                    Text("Captured \(source.capturedAt.formatted(date: .abbreviated, time: .shortened))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("\(source.attachedEntryCount) attached entries")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                ProvenanceBlock(
                    sourceClass: source.sourceClass.displayName,
                    originRef: source.id,
                    fingerprint: source.fingerprint
                )
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Context")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct DetailSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)
            content
        }
        .panelStyle()
    }
}

private struct ProvenanceBlock: View {
    let sourceClass: String
    let originRef: UUID
    let fingerprint: String

    var body: some View {
        DetailSection(title: "Provenance") {
            LabeledContent("Source class", value: sourceClass)
            LabeledContent("Origin", value: originRef.uuidString)
            VStack(alignment: .leading, spacing: 6) {
                Text("Content fingerprint")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(fingerprint)
                    .font(.caption.monospaced())
                    .textSelection(.enabled)
            }
        }
    }
}

private struct StateBadge: View {
    let label: String
    let color: Color

    var body: some View {
        Text(label)
            .font(.caption.weight(.semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(color.opacity(0.12), in: Capsule())
    }
}

private struct EmptyPanel: View {
    let title: String
    let systemImage: String
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: systemImage)
                .font(.subheadline.weight(.semibold))
            Text(text)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .panelStyle()
    }
}

private extension View {
    func panelStyle() -> some View {
        self
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(.background, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private extension JournalEntryStatus {
    var label: String {
        switch self {
        case .draft: return "Awaiting review"
        case .retained: return "Retained"
        case .archived: return "Archived after review"
        case .discarded: return "Discarded"
        }
    }

    var tint: Color {
        switch self {
        case .draft: return .orange
        case .retained: return .blue
        case .archived: return .green
        case .discarded: return .secondary
        }
    }

    var sortOrder: Int {
        switch self {
        case .draft: return 0
        case .retained: return 1
        case .archived: return 2
        case .discarded: return 3
        }
    }
}

private extension ContinuitySourceState {
    var label: String {
        switch self {
        case .captured: return "Captured"
        case .attached: return "Attached"
        case .journaled: return "Journaled"
        case .archived: return "Archived"
        case .discarded: return "Discarded"
        }
    }

    var tint: Color {
        switch self {
        case .captured: return .purple
        case .attached: return .blue
        case .journaled: return .orange
        case .archived: return .green
        case .discarded: return .secondary
        }
    }

    var sortOrder: Int {
        switch self {
        case .captured: return 0
        case .attached: return 1
        case .journaled: return 2
        case .archived: return 3
        case .discarded: return 4
        }
    }
}

private extension HumanDecisionAction {
    var label: String {
        switch self {
        case .approve: return "Approved into archive"
        case .edit: return "Edited and archived"
        case .retain: return "Retained for later"
        case .discard: return "Discarded"
        }
    }
}

private func shortHash(_ hash: String) -> String {
    guard hash.count > 16 else { return hash }
    return "\(hash.prefix(8))...\(hash.suffix(8))"
}
