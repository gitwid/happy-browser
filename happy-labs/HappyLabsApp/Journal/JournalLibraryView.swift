import HappyLabsCore
import SwiftUI

struct JournalLibraryView: View {
    let rows: [JournalEntryRow]
    let countLine: String
    let isEmpty: Bool
    let onImport: () -> Void
    let onOpen: (UUID) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("THE JOURNAL")
                .font(JournalTheme.capsLabel(11))
                .tracking(3.2)
                .foregroundStyle(JournalTheme.label)
                .padding(.bottom, 26)

            Text("An account of the year, told back to itself.")
                .font(JournalTheme.newsreader(46, weight: .light))
                .foregroundStyle(JournalTheme.ink)
                .lineSpacing(2)
                .frame(maxWidth: 14 * 28, alignment: .leading)

            Text("Each entry below was woven from a single thread of your own correspondence — nothing added, nothing sent anywhere.")
                .font(JournalTheme.newsreaderItalic(19, weight: .light))
                .foregroundStyle(Color(red: 0.431, green: 0.416, blue: 0.369))
                .lineSpacing(6)
                .padding(.top, 22)
                .frame(maxWidth: 42 * 12, alignment: .leading)

            Text("Import a Mail.app export (.mbox file), or select a live mailbox folder such as INBOX.mbox from ~/Library/Mail/.")
                .font(.system(size: 12.5))
                .foregroundStyle(JournalTheme.muted)
                .padding(.top, 10)
                .frame(maxWidth: 42 * 12, alignment: .leading)

            if isEmpty {
                VStack(alignment: .leading, spacing: 16) {
                    Text("No entries yet.")
                        .font(JournalTheme.newsreader(22, weight: .light))
                        .foregroundStyle(JournalTheme.muted)
                        .padding(.top, 40)
                    Button(action: onImport) {
                        Text("Import a Mail.app mailbox export…")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(JournalTheme.accent)
                    }
                    .buttonStyle(.plain)
                }
            } else {
                HStack(spacing: 14) {
                    Text(countLine)
                        .font(JournalTheme.capsLabel(10.5))
                        .tracking(2.4)
                        .foregroundStyle(JournalTheme.label)
                    Rectangle()
                        .fill(JournalTheme.divider)
                        .frame(height: 1)
                }
                .padding(.top, 40)
                .padding(.bottom, 8)

                LazyVStack(spacing: 0) {
                    ForEach(rows) { row in
                        JournalLibraryRow(row: row) {
                            onOpen(row.id)
                        }
                    }
                }

                Text("Essence survives every translation.")
                    .font(JournalTheme.newsreaderItalic(14, weight: .light))
                    .foregroundStyle(Color(red: 0.714, green: 0.698, blue: 0.651))
                    .frame(maxWidth: .infinity)
                    .padding(.top, 54)
            }
        }
        .frame(maxWidth: JournalTheme.contentMaxWidth, alignment: .leading)
        .padding(.top, 84)
    }
}

private struct JournalLibraryRow: View {
    let row: JournalEntryRow
    let action: () -> Void
    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 18) {
                Text(row.number)
                    .font(JournalTheme.mono(11))
                    .foregroundStyle(Color(red: 0.733, green: 0.718, blue: 0.671))
                    .padding(.top, 6)
                    .frame(width: 38, alignment: .leading)

                VStack(alignment: .leading, spacing: 6) {
                    Text(row.title)
                        .font(JournalTheme.newsreader(23, weight: .regular))
                        .foregroundStyle(JournalTheme.ink)
                        .multilineTextAlignment(.leading)
                    Text(row.essence)
                        .font(.system(size: 13.5))
                        .foregroundStyle(JournalTheme.muted)
                        .lineSpacing(4)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: 48 * 12, alignment: .leading)
                }

                Spacer(minLength: 12)

                VStack(alignment: .trailing, spacing: 9) {
                    Text(row.dateSpan)
                        .font(JournalTheme.mono(11))
                        .foregroundStyle(JournalTheme.label)
                    Text(row.statusLabel)
                        .font(JournalTheme.capsLabel(10))
                        .tracking(1.6)
                        .foregroundStyle(row.statusColor)
                }
                .padding(.top, 5)
            }
            .padding(.vertical, 22)
            .padding(.trailing, 10)
            .padding(.leading, isHovered ? 14 : 0)
            .background(isHovered ? JournalTheme.hoverFill : .clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .overlay(alignment: .bottom) {
            Rectangle().fill(JournalTheme.divider.opacity(0.8)).frame(height: 1)
        }
    }
}
