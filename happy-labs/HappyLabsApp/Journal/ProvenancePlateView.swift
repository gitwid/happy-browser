import HappyLabsCore
import SwiftUI

struct ProvenancePlateView: View {
    let detail: JournalEntryDetail

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("PROVENANCE")
                    .font(JournalTheme.capsLabel(10.5))
                    .tracking(3.2)
                    .foregroundStyle(Color(red: 0.329, green: 0.337, blue: 0.361))
                Spacer()
                Text("PHASE 0")
                    .font(JournalTheme.capsLabel(10))
                    .tracking(2.4)
                    .foregroundStyle(Color(red: 0.494, green: 0.502, blue: 0.541))
            }
            .padding(.bottom, 14)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Color.black.opacity(0.12)).frame(height: 1)
            }

            ForEach(Array(detail.lineage.enumerated()), id: \.element.id) { index, rung in
                HStack(alignment: .top, spacing: 16) {
                    VStack(spacing: 0) {
                        ProvenanceNodeDot()
                            .padding(.top, 4)
                        if index < detail.lineage.count - 1 {
                            Rectangle()
                                .fill(
                                    LinearGradient(
                                        colors: [Color(red: 0.47, green: 0.478, blue: 0.51).opacity(0.45), .clear],
                                        startPoint: .top,
                                        endPoint: .bottom
                                    )
                                )
                                .frame(width: 1)
                                .frame(minHeight: 14)
                        }
                    }
                    .frame(width: 26)

                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text("\(rung.stage) · \(rung.phase)")
                                .font(JournalTheme.capsLabel(10))
                                .tracking(1.8)
                                .foregroundStyle(Color(red: 0.420, green: 0.427, blue: 0.459))
                            Spacer(minLength: 12)
                            Text(rung.io)
                                .font(JournalTheme.mono(10.5))
                                .foregroundStyle(Color(red: 0.514, green: 0.522, blue: 0.557))
                        }
                        Text(rung.codec)
                            .font(JournalTheme.mono(12.5))
                            .foregroundStyle(Color(red: 0.247, green: 0.251, blue: 0.275))
                        Text(rung.detail)
                            .font(.system(size: 12.5))
                            .foregroundStyle(Color(red: 0.443, green: 0.451, blue: 0.486))
                    }
                    .padding(.bottom, 16)
                }
            }

            HStack(alignment: .top, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("SOURCE CLASS")
                        .font(JournalTheme.capsLabel(9.5))
                        .tracking(2)
                        .foregroundStyle(Color(red: 0.514, green: 0.522, blue: 0.557))
                    HStack(spacing: 8) {
                        Text(detail.sourceClass.displayName)
                            .font(JournalTheme.mono(13))
                            .foregroundStyle(Color(red: 0.247, green: 0.251, blue: 0.275))
                        Text("a predicate, not a refactor")
                            .font(JournalTheme.newsreaderItalic(10))
                            .foregroundStyle(Color(red: 0.604, green: 0.612, blue: 0.643))
                    }
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text("DECISION")
                        .font(JournalTheme.capsLabel(9.5))
                        .tracking(2)
                        .foregroundStyle(Color(red: 0.514, green: 0.522, blue: 0.557))
                    Text(detail.decisionField)
                        .font(JournalTheme.mono(13))
                        .foregroundStyle(Color(red: 0.247, green: 0.251, blue: 0.275))
                }
            }
            .padding(.top, 20)
            .padding(.bottom, 18)
            .overlay(alignment: .top) {
                Rectangle().fill(Color.black.opacity(0.12)).frame(height: 1)
            }

            if !detail.attachedContextSources.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("ATTACHED CONTEXT")
                        .font(JournalTheme.capsLabel(9.5))
                        .tracking(2)
                        .foregroundStyle(Color(red: 0.514, green: 0.522, blue: 0.557))
                    ForEach(detail.attachedContextSources) { source in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(source.title)
                                    .font(JournalTheme.mono(12.5))
                                    .foregroundStyle(Color(red: 0.247, green: 0.251, blue: 0.275))
                                Spacer(minLength: 12)
                                Text("\(source.kind) · \(source.state)")
                                    .font(JournalTheme.capsLabel(9))
                                    .tracking(1.4)
                                    .foregroundStyle(Color(red: 0.514, green: 0.522, blue: 0.557))
                            }
                            if let url = source.sourceURL {
                                Text(url)
                                    .font(.system(size: 11.5))
                                    .foregroundStyle(Color(red: 0.443, green: 0.451, blue: 0.486))
                                    .lineLimit(1)
                                    .truncationMode(.middle)
                            }
                            Text(source.shortFingerprint)
                                .font(JournalTheme.mono(10.5))
                                .foregroundStyle(Color(red: 0.604, green: 0.612, blue: 0.643))
                        }
                    }
                }
                .padding(.top, 18)
                .overlay(alignment: .top) {
                    Rectangle().fill(Color.black.opacity(0.12)).frame(height: 1)
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("CONTENT FINGERPRINT — SHA-256")
                    .font(JournalTheme.capsLabel(9.5))
                    .tracking(2)
                    .foregroundStyle(Color(red: 0.514, green: 0.522, blue: 0.557))
                Text(detail.fingerprint)
                    .font(JournalTheme.mono(11.5))
                    .foregroundStyle(Color(red: 0.353, green: 0.357, blue: 0.380))
                    .lineSpacing(4)
                    .textSelection(.enabled)
            }
            .padding(.top, 18)
            .overlay(alignment: .top) {
                Rectangle().fill(Color.black.opacity(0.12)).frame(height: 1)
            }

            if detail.isDiscarded {
                Text("Discarded — yet its provenance is retained as a DiscardedArtifact. Nothing is unmade.")
                    .font(JournalTheme.newsreaderItalic(13.5))
                    .foregroundStyle(Color(red: 0.494, green: 0.502, blue: 0.541))
                    .padding(.top, 18)
            }
        }
        .padding(30)
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.925, green: 0.929, blue: 0.937),
                    Color(red: 0.867, green: 0.871, blue: 0.886),
                    Color(red: 0.824, green: 0.827, blue: 0.847),
                    Color(red: 0.784, green: 0.788, blue: 0.812)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 5))
        .overlay(
            RoundedRectangle(cornerRadius: 5)
                .stroke(Color(red: 0.47, green: 0.478, blue: 0.51).opacity(0.5), lineWidth: 1)
        )
        .shadow(color: Color(red: 0.157, green: 0.165, blue: 0.188).opacity(0.25), radius: 18, y: 10)
    }
}

private struct ProvenanceNodeDot: View {
    var body: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [
                        Color(red: 0.988, green: 0.988, blue: 0.992),
                        Color(red: 0.839, green: 0.843, blue: 0.863),
                        Color(red: 0.741, green: 0.745, blue: 0.769)
                    ],
                    center: .init(x: 0.32, y: 0.26),
                    startRadius: 0,
                    endRadius: 8
                )
            )
            .frame(width: 11, height: 11)
            .shadow(color: .black.opacity(0.15), radius: 0.5, y: 0.5)
    }
}

struct ProvenanceSealButton: View {
    let shortFingerprint: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [
                                    Color(red: 0.980, green: 0.980, blue: 0.984),
                                    Color(red: 0.894, green: 0.898, blue: 0.910),
                                    Color(red: 0.776, green: 0.780, blue: 0.800)
                                ],
                                center: .init(x: 0.32, y: 0.26),
                                startRadius: 0,
                                endRadius: 20
                            )
                        )
                        .frame(width: 30, height: 30)
                        .shadow(color: .black.opacity(0.12), radius: 1, y: 1)
                    Circle()
                        .fill(JournalTheme.accent)
                        .frame(width: 7, height: 7)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text("PROVENANCE")
                        .font(JournalTheme.capsLabel(10.5))
                        .tracking(2.4)
                        .foregroundStyle(JournalTheme.muted)
                    Text(shortFingerprint)
                        .font(JournalTheme.mono(11))
                        .foregroundStyle(Color(red: 0.714, green: 0.698, blue: 0.651))
                }
            }
        }
        .buttonStyle(.plain)
    }
}
