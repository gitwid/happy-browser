import HappyLabsCore
import SwiftUI

struct MorningstarPanelView: View {
    private enum Section: String, CaseIterable, Identifiable {
        case capture = "New Capture"
        case library = "Evidence"
        var id: String { rawValue }
    }

    @EnvironmentObject private var appModel: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var section: Section = .capture
    @State private var observation = ""
    @State private var phenomenology = ""
    @State private var action = ""
    @State private var recordedAt = ""
    @State private var source = ""
    @State private var recallLatency = ""
    @State private var selectedEntryID: UUID?
    @State private var reviewing = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 5) {
                    Text("MORNINGSTAR")
                        .font(JournalTheme.capsLabel(10.5))
                        .tracking(2.8)
                        .foregroundStyle(JournalTheme.label)
                    Text("The witness layer")
                        .font(JournalTheme.newsreader(30, weight: .light))
                        .foregroundStyle(JournalTheme.ink)
                }
                Spacer()
                Button("Done") { dismiss() }
                    .buttonStyle(.plain)
                    .foregroundStyle(JournalTheme.muted)
            }
            .padding(.bottom, 22)

            Picker("Morningstar section", selection: $section) {
                ForEach(Section.allCases) { item in
                    Text(item.rawValue).tag(item)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()

            Divider().padding(.vertical, 22)

            Group {
                switch section {
                case .capture: captureForm
                case .library: evidenceLibrary
                }
            }
            .frame(maxHeight: .infinity, alignment: .top)
        }
        .padding(30)
        .frame(minWidth: 720, minHeight: 660)
        .background(JournalTheme.paper)
    }

    private var input: MorningstarCaptureInput {
        MorningstarCaptureInput(
            observation: observation,
            phenomenology: phenomenology,
            action: action,
            recordedAt: recordedAt,
            source: source,
            recallLatency: recallLatency
        )
    }

    private var warnings: [MorningstarLeakageWarning] {
        MorningstarLeakageChecker.check(input)
    }

    private var captureForm: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Text("Record what can be witnessed. Interpretation can come later.")
                    .font(JournalTheme.newsreaderItalic(15, weight: .light))
                    .foregroundStyle(JournalTheme.muted)

                captureField(
                    title: "WHAT HAPPENED?",
                    guidance: "Externally observable facts, times, events, or verbatim messages.",
                    text: $observation
                )
                captureField(
                    title: "WHAT DID YOU EXPERIENCE?",
                    guidance: "Immediate subjective experience, in your own words.",
                    text: $phenomenology
                )
                captureField(
                    title: "WHAT DID YOU DO?",
                    guidance: "Behavior actually performed, without justification.",
                    text: $action
                )

                DisclosureGroup("Optional context") {
                    VStack(spacing: 12) {
                        smallField("When, in your words", text: $recordedAt)
                        smallField("Source", text: $source)
                        smallField("Recall latency", text: $recallLatency)
                    }
                    .padding(.top, 14)
                }
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(JournalTheme.ink)

                if !appModel.journalRows.isEmpty {
                    Picker("Attach explicitly to", selection: $selectedEntryID) {
                        Text("Keep unattached").tag(nil as UUID?)
                        ForEach(appModel.journalRows) { row in
                            Text(row.title).tag(Optional(row.id))
                        }
                    }
                    .pickerStyle(.menu)
                }

                if reviewing {
                    reviewBlock
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.system(size: 12))
                        .foregroundStyle(.red)
                }

                HStack {
                    Spacer()
                    if reviewing {
                        Button("Return to capture") { reviewing = false }
                            .buttonStyle(.plain)
                            .foregroundStyle(JournalTheme.muted)
                        Button("Commit immutable capture") { commit() }
                            .buttonStyle(.borderedProminent)
                            .tint(JournalTheme.ink)
                    } else {
                        Button("Review capture") {
                            errorMessage = nil
                            reviewing = true
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(JournalTheme.ink)
                        .disabled(isEmpty)
                    }
                }
            }
            .padding(.bottom, 20)
        }
    }

    private var reviewBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("COMMIT REVIEW")
                    .font(JournalTheme.capsLabel(10))
                    .tracking(2)
                Spacer()
                Text(warnings.isEmpty ? "CHANNELS LOOK SEPARATE" : "\(warnings.count) GENTLE FLAG\(warnings.count == 1 ? "" : "S")")
                    .font(JournalTheme.capsLabel(9))
                    .tracking(1.4)
                    .foregroundStyle(warnings.isEmpty ? JournalTheme.accent : JournalTheme.label)
            }
            Text("After commit, this text cannot be edited. Corrections become annotations and preserve the original.")
                .font(.system(size: 12.5))
                .foregroundStyle(JournalTheme.muted)
            ForEach(warnings) { warning in
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(warning.channel) · “\(warning.phrase)”")
                        .font(.system(size: 12, weight: .medium))
                    Text(warning.explanation)
                        .font(.system(size: 12))
                        .foregroundStyle(JournalTheme.muted)
                }
            }
        }
        .padding(18)
        .background(JournalTheme.hoverFill)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(JournalTheme.divider))
    }

    private var evidenceLibrary: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                if appModel.morningstarCaptures.isEmpty {
                    Text("No captures yet. The first committed capture will begin the chain.")
                        .font(JournalTheme.newsreader(17, weight: .light))
                        .foregroundStyle(JournalTheme.muted)
                        .padding(.vertical, 30)
                }
                ForEach(appModel.morningstarCaptures.reversed()) { capture in
                    evidenceRow(capture)
                }
            }
        }
    }

    private func evidenceRow(_ capture: MorningstarCapture) -> some View {
        HStack(alignment: .top, spacing: 16) {
            Text(String(format: "%03d", capture.sequenceNumber))
                .font(JournalTheme.mono(11))
                .foregroundStyle(JournalTheme.label)
                .frame(width: 38, alignment: .leading)
            VStack(alignment: .leading, spacing: 7) {
                Text(capture.observation.isEmpty ? "Phenomenology or action capture" : capture.observation)
                    .font(JournalTheme.newsreader(18, weight: .regular))
                    .foregroundStyle(JournalTheme.ink)
                    .lineLimit(2)
                Text("protocol \(capture.protocolVersion) · \(shortHash(capture.integrityHash))")
                    .font(JournalTheme.mono(10.5))
                    .foregroundStyle(JournalTheme.muted)
            }
            Spacer()
            if !appModel.journalRows.isEmpty {
                Menu("Attach…") {
                    ForEach(appModel.journalRows) { row in
                        Button(row.title) { attach(capture.id, to: row.id) }
                    }
                }
                .menuStyle(.borderlessButton)
            }
        }
        .padding(.vertical, 16)
        .overlay(alignment: .bottom) { Rectangle().fill(JournalTheme.divider).frame(height: 1) }
    }

    private func captureField(
        title: String,
        guidance: String,
        text: Binding<String>
    ) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title)
                .font(JournalTheme.capsLabel(10))
                .tracking(2)
                .foregroundStyle(JournalTheme.label)
            Text(guidance)
                .font(.system(size: 11.5))
                .foregroundStyle(JournalTheme.muted)
            TextEditor(text: text)
                .font(.system(size: 14))
                .scrollContentBackground(.hidden)
                .padding(8)
                .frame(minHeight: 84)
                .background(Color.white.opacity(0.5))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(JournalTheme.divider))
                .disabled(reviewing)
        }
    }

    private func smallField(_ title: String, text: Binding<String>) -> some View {
        HStack {
            Text(title).frame(width: 140, alignment: .leading)
            TextField("Optional", text: text)
                .textFieldStyle(.roundedBorder)
                .disabled(reviewing)
        }
        .font(.system(size: 12.5))
    }

    private var isEmpty: Bool {
        [observation, phenomenology, action]
            .allSatisfy { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    private func commit() {
        do {
            _ = try appModel.commitMorningstarCapture(input, attachingTo: selectedEntryID)
            clearForm()
            section = .library
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func attach(_ captureID: UUID, to journalEntryID: UUID) {
        do {
            try appModel.attachMorningstarCapture(captureID, to: journalEntryID)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func clearForm() {
        observation = ""
        phenomenology = ""
        action = ""
        recordedAt = ""
        source = ""
        recallLatency = ""
        selectedEntryID = nil
        reviewing = false
        errorMessage = nil
    }

    private func shortHash(_ hash: String) -> String {
        hash.count > 16 ? "\(hash.prefix(8))…\(hash.suffix(8))" : hash
    }
}
