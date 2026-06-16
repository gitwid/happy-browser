import HappyLabsCore
import SwiftUI

struct JournalReaderView: View {
    let detail: JournalEntryDetail
    @Binding var provenanceExpanded: Bool
    let onBack: () -> Void
    let onArchive: () -> Void
    let onKeep: () -> Void
    let onDiscard: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onBack) {
                HStack(spacing: 9) {
                    Text("‹")
                        .font(.system(size: 15))
                        .offset(y: -0.5)
                    Text("THE JOURNAL")
                        .font(JournalTheme.capsLabel(11))
                        .tracking(2.4)
                }
                .foregroundStyle(JournalTheme.label)
            }
            .buttonStyle(.plain)
            .padding(.vertical, 8)

            VStack(alignment: .leading, spacing: 0) {
                Text(detail.overline)
                    .font(JournalTheme.capsLabel(10.5))
                    .tracking(2.4)
                    .foregroundStyle(JournalTheme.label)
                    .padding(.bottom, 24)

                Text(detail.title)
                    .font(JournalTheme.newsreader(42, weight: .light))
                    .foregroundStyle(JournalTheme.ink)
                    .lineSpacing(4)

                Text(detail.byline)
                    .font(JournalTheme.newsreaderItalic(16, weight: .light))
                    .foregroundStyle(Color(red: 0.604, green: 0.580, blue: 0.525))
                    .padding(.top, 16)

                Rectangle()
                    .fill(JournalTheme.ink.opacity(0.18))
                    .frame(width: 54, height: 1)
                    .padding(.vertical, 38)

                ForEach(Array(detail.bodyParagraphs.enumerated()), id: \.offset) { _, paragraph in
                    Text(paragraph)
                        .font(JournalTheme.newsreader(19.5, weight: .light))
                        .foregroundStyle(JournalTheme.inkSoft)
                        .lineSpacing(10)
                        .padding(.bottom, 26)
                        .frame(maxWidth: JournalTheme.readerMeasure, alignment: .leading)
                }

                if let quote = detail.quote, !quote.isEmpty {
                    Text(quote)
                        .font(JournalTheme.newsreaderItalic(27, weight: .light))
                        .foregroundStyle(JournalTheme.ink)
                        .multilineTextAlignment(.center)
                        .lineSpacing(6)
                        .frame(maxWidth: 24 * 16)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 46)
                }

                VStack(alignment: .leading, spacing: 18) {
                    HStack(alignment: .center, spacing: 20) {
                        ProvenanceSealButton(shortFingerprint: detail.shortFingerprint) {
                            withAnimation(.easeOut(duration: 0.28)) {
                                provenanceExpanded.toggle()
                            }
                        }

                        Spacer(minLength: 12)

                        HStack(spacing: 8) {
                            JournalPillButton(title: "Archive", kind: .primary, action: onArchive)
                            JournalPillButton(title: "Keep for later", kind: .secondary, action: onKeep)
                            JournalPillButton(title: "Discard", kind: .ghost, action: onDiscard)
                        }
                    }

                    if detail.status != .draft, !detail.decisionNote.isEmpty {
                        Text(detail.decisionNote)
                            .font(JournalTheme.newsreaderItalic(14.5, weight: .light))
                            .foregroundStyle(Color(red: 0.604, green: 0.580, blue: 0.525))
                    }

                    if provenanceExpanded {
                        ProvenancePlateView(detail: detail)
                            .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }
                .padding(.top, 60)
                .overlay(alignment: .top) {
                    Rectangle().fill(JournalTheme.divider).frame(height: 1).padding(.top, 30)
                }
            }
            .padding(.top, 44)
            .frame(maxWidth: JournalTheme.contentMaxWidth, alignment: .leading)
        }
        .frame(maxWidth: JournalTheme.contentMaxWidth, alignment: .leading)
        .padding(.top, 40)
    }
}

private struct JournalPillButton: View {
    enum Kind { case primary, secondary, ghost }

    let title: String
    let kind: Kind
    let action: () -> Void
    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 12, weight: kind == .ghost ? .regular : .medium))
                .tracking(0.5)
                .padding(.horizontal, kind == .ghost ? 8 : 16)
                .padding(.vertical, 9)
                .foregroundStyle(foreground)
                .background(background)
                .overlay {
                    if kind == .secondary {
                        Capsule().stroke(JournalTheme.ink.opacity(isHovered ? 0.4 : 0.18), lineWidth: 1)
                    }
                }
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .opacity(kind == .primary && isHovered ? 0.84 : 1)
    }

    private var foreground: Color {
        switch kind {
        case .primary: return JournalTheme.paper
        case .secondary: return JournalTheme.accent
        case .ghost: return isHovered ? JournalTheme.ink : JournalTheme.label
        }
    }

    private var background: Color {
        switch kind {
        case .primary: return JournalTheme.ink
        case .secondary: return isHovered ? JournalTheme.hoverFill : .clear
        case .ghost: return .clear
        }
    }
}
