import SwiftUI

enum JournalTheme {
    static let paper = Color(red: 0.965, green: 0.957, blue: 0.933)
    static let ink = Color(red: 0.110, green: 0.106, blue: 0.086)
    static let inkSoft = Color(red: 0.231, green: 0.224, blue: 0.184)
    static let muted = Color(red: 0.557, green: 0.541, blue: 0.494)
    static let mutedLight = Color(red: 0.663, green: 0.647, blue: 0.592)
    static let label = Color(red: 0.663, green: 0.647, blue: 0.592)
    static let accent = Color(red: 0.275, green: 0.329, blue: 0.369)
    static let divider = Color(red: 0.110, green: 0.106, blue: 0.086).opacity(0.10)
    static let hoverFill = Color(red: 0.110, green: 0.106, blue: 0.086).opacity(0.022)

    static let contentMaxWidth: CGFloat = 760
    static let mastheadMaxWidth: CGFloat = 880
    static let readerMeasure: CGFloat = 640

    static func newsreader(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom("Newsreader", size: size).weight(weight)
    }

    static func newsreaderItalic(_ size: CGFloat, weight: Font.Weight = .light) -> Font {
        .custom("Newsreader", size: size).weight(weight).italic()
    }

    static func mono(_ size: CGFloat) -> Font {
        .system(size: size, weight: .regular, design: .monospaced)
    }

    static func capsLabel(_ size: CGFloat = 10.5) -> Font {
        .system(size: size, weight: .medium, design: .default)
    }
}

struct JournalMasthead: View {
    var body: some View {
        HStack {
            Text("HAPPYLABS")
                .font(JournalTheme.capsLabel(11))
                .tracking(3.2)
                .foregroundStyle(JournalTheme.muted)
            Spacer()
            HStack(spacing: 8) {
                Circle()
                    .fill(JournalTheme.accent)
                    .frame(width: 5, height: 5)
                Text("PRIVATE · ON THIS DEVICE")
                    .font(JournalTheme.capsLabel(10))
                    .tracking(2.4)
                    .foregroundStyle(JournalTheme.label)
            }
        }
        .frame(maxWidth: JournalTheme.mastheadMaxWidth)
    }
}
