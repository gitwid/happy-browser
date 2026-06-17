import HappyLabsCore
import SwiftUI

struct ImportScopeSheet: View {
    let fileName: String
    let preview: MailboxPreview?
    @Binding var selectedScope: ImportScope
    let onCancel: () -> Void
    let onImport: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("IMPORT CORRESPONDENCE")
                .font(JournalTheme.capsLabel(11))
                .tracking(3.2)
                .foregroundStyle(JournalTheme.label)
                .padding(.bottom, 20)

            Text("How much of this mailbox?")
                .font(JournalTheme.newsreader(28, weight: .light))
                .foregroundStyle(JournalTheme.ink)
                .padding(.bottom, 10)

            Text(fileName)
                .font(JournalTheme.mono(12))
                .foregroundStyle(JournalTheme.muted)

            if let preview {
                Text("\(preview.messageCount) messages · \(preview.dateRangeLabel ?? "dates unknown")")
                    .font(.system(size: 12.5))
                    .foregroundStyle(JournalTheme.muted)
                    .padding(.top, 8)
            } else {
                Text("Scanning mailbox…")
                    .font(.system(size: 12.5))
                    .foregroundStyle(JournalTheme.muted)
                    .padding(.top, 8)
            }

            if let preview, preview.isLegacyArchive, selectedScope != .everything {
                Text("This archive looks older than a year. Use Everything — narrower ranges will import nothing.")
                    .font(JournalTheme.newsreaderItalic(14, weight: .light))
                    .foregroundStyle(Color(red: 0.604, green: 0.420, blue: 0.369))
                    .lineSpacing(4)
                    .padding(.top, 16)
            } else if let preview, !preview.wouldIncludeMessages(for: selectedScope) {
                Text("“\(selectedScope.title)” likely matches no messages in this mailbox. Try a wider range.")
                    .font(JournalTheme.newsreaderItalic(14, weight: .light))
                    .foregroundStyle(Color(red: 0.604, green: 0.420, blue: 0.369))
                    .lineSpacing(4)
                    .padding(.top, 16)
            }

            VStack(spacing: 0) {
                ForEach(ImportScope.allCases) { scope in
                    ImportScopeRow(
                        scope: scope,
                        isSelected: selectedScope == scope,
                        action: { selectedScope = scope }
                    )
                }
            }
            .padding(.top, 24)

            if selectedScope.isLongRunning {
                Text("Large imports run in the background. You can read existing entries while this finishes.")
                    .font(JournalTheme.newsreaderItalic(14, weight: .light))
                    .foregroundStyle(Color(red: 0.604, green: 0.580, blue: 0.525))
                    .lineSpacing(4)
                    .padding(.top, 22)
            }

            HStack {
                Button("Cancel", action: onCancel)
                    .buttonStyle(.plain)
                    .foregroundStyle(JournalTheme.label)
                Spacer()
                Button(action: onImport) {
                    Text("Import \(selectedScope.title.lowercased())")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(JournalTheme.paper)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(JournalTheme.ink)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 32)
        }
        .padding(36)
        .frame(width: 480)
        .background(JournalTheme.paper)
    }
}

private struct ImportScopeRow: View {
    let scope: ImportScope
    let isSelected: Bool
    let action: () -> Void
    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 14) {
                Circle()
                    .strokeBorder(isSelected ? JournalTheme.accent : JournalTheme.divider, lineWidth: isSelected ? 5 : 1)
                    .background(Circle().fill(isSelected ? JournalTheme.accent.opacity(0.12) : .clear))
                    .frame(width: 16, height: 16)
                    .padding(.top, 3)

                VStack(alignment: .leading, spacing: 4) {
                    Text(scope.title)
                        .font(.system(size: 14, weight: isSelected ? .semibold : .regular))
                        .foregroundStyle(JournalTheme.ink)
                    Text(scope.subtitle)
                        .font(.system(size: 12.5))
                        .foregroundStyle(JournalTheme.muted)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 12)
            .background(isSelected || isHovered ? JournalTheme.hoverFill : .clear)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
    }
}
