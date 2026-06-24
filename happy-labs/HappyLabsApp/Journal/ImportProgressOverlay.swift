import HappyLabsCore
import SwiftUI

struct ImportProgressOverlay: View {
    let message: String
    let progress: Double?
    let scopeTitle: String
    let onCancel: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.18)
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 14) {
                    Text("IMPORTING")
                        .font(JournalTheme.capsLabel(10.5))
                        .tracking(2.4)
                        .foregroundStyle(JournalTheme.label)
                    Spacer()
                    Text(progressLabel)
                        .font(JournalTheme.mono(11))
                        .foregroundStyle(JournalTheme.muted)
                }

                VStack(alignment: .leading, spacing: 10) {
                    ProgressView(value: progress ?? 0, total: 1)
                        .progressViewStyle(.linear)
                    Text(message)
                        .font(JournalTheme.newsreader(22, weight: .light))
                        .foregroundStyle(JournalTheme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Text("\(scopeTitle) · on this device only")
                    .font(JournalTheme.mono(11))
                    .foregroundStyle(JournalTheme.muted)

                Text("You can leave this window open while HappyLabs reads, clusters, and drafts. Cancellation rolls back partial imports.")
                    .font(JournalTheme.newsreaderItalic(13.5, weight: .light))
                    .foregroundStyle(Color(red: 0.604, green: 0.580, blue: 0.525))
                    .lineSpacing(3)

                Button("Cancel import", action: onCancel)
                    .buttonStyle(.plain)
                    .font(.system(size: 12))
                    .foregroundStyle(JournalTheme.label)
                    .padding(.top, 4)
            }
            .padding(32)
            .frame(maxWidth: 420, alignment: .leading)
            .background(JournalTheme.paper)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .shadow(color: .black.opacity(0.12), radius: 24, y: 12)
        }
    }

    private var progressLabel: String {
        guard let progress else { return "0%" }
        return "\(Int((progress * 100).rounded()))%"
    }
}
