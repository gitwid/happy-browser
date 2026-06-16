import Foundation

public enum SyntheticCorpusGenerator {
    public struct ThreadTemplate: Sendable {
        public let subject: String
        public let participants: [String]
        public let messagesPerThread: Int

        public init(subject: String, participants: [String], messagesPerThread: Int) {
            self.subject = subject
            self.participants = participants
            self.messagesPerThread = messagesPerThread
        }
    }

    /// Designed corpus: 20 semantic threads × 25 messages = 500 emails.
    public static let defaultTemplates: [ThreadTemplate] = [
        .init(subject: "Summer trip planning", participants: ["alice@example.com", "bob@example.com"], messagesPerThread: 25),
        .init(subject: "Kitchen renovation quotes", participants: ["alice@example.com", "contractor@example.com"], messagesPerThread: 25),
        .init(subject: "School pickup schedule", participants: ["alice@example.com", "carol@example.com"], messagesPerThread: 25),
        .init(subject: "Book club: next pick", participants: ["dana@example.com", "eve@example.com", "frank@example.com"], messagesPerThread: 25),
        .init(subject: "Neighborhood block party", participants: ["grace@example.com", "heidi@example.com"], messagesPerThread: 25),
        .init(subject: "Freelance invoice follow-up", participants: ["alice@example.com", "client@example.com"], messagesPerThread: 25),
        .init(subject: "Parent-teacher conference", participants: ["alice@example.com", "teacher@example.com"], messagesPerThread: 25),
        .init(subject: "Apartment lease renewal", participants: ["alice@example.com", "landlord@example.com"], messagesPerThread: 25),
        .init(subject: "Weekend hiking group", participants: ["ivan@example.com", "judy@example.com"], messagesPerThread: 25),
        .init(subject: "Recipe exchange", participants: ["kate@example.com", "liam@example.com"], messagesPerThread: 25),
        .init(subject: "Volunteer shift swap", participants: ["maya@example.com", "nora@example.com"], messagesPerThread: 25),
        .init(subject: "Dental appointment reminders", participants: ["office@example.com", "alice@example.com"], messagesPerThread: 25),
        .init(subject: "Home internet outage", participants: ["support@example.com", "alice@example.com"], messagesPerThread: 25),
        .init(subject: "Birthday dinner reservations", participants: ["olivia@example.com", "paul@example.com"], messagesPerThread: 25),
        .init(subject: "Garden compost questions", participants: ["quinn@example.com", "ruth@example.com"], messagesPerThread: 25),
        .init(subject: "Car maintenance schedule", participants: ["alice@example.com", "mechanic@example.com"], messagesPerThread: 25),
        .init(subject: "Community choir rehearsal", participants: ["sam@example.com", "tina@example.com"], messagesPerThread: 25),
        .init(subject: "Tax document checklist", participants: ["alice@example.com", "accountant@example.com"], messagesPerThread: 25),
        .init(subject: "Language exchange partner", participants: ["uma@example.com", "victor@example.com"], messagesPerThread: 25),
        .init(subject: "Pet sitter instructions", participants: ["alice@example.com", "wendy@example.com"], messagesPerThread: 25)
    ]

    public static func generateMbox(templates: [ThreadTemplate] = defaultTemplates) -> Data {
        var chunks: [String] = []
        var messageCounter = 0
        let baseDate = Date(timeIntervalSince1970: 1_700_000_000)

        for (threadIndex, template) in templates.enumerated() {
            var previousMessageID: String?
            for messageIndex in 0..<template.messagesPerThread {
                messageCounter += 1
                let messageID = "<thread-\(threadIndex)-msg-\(messageIndex)@example.com>"
                let from = template.participants[messageIndex % template.participants.count]
                let to = template.participants.filter { $0 != from }
                let date = baseDate.addingTimeInterval(Double(messageCounter * 3600))
                let subject = messageIndex == 0 ? template.subject : "Re: \(template.subject)"
                let body = "Message \(messageIndex + 1) in \(template.subject). Details about planning step \(messageIndex + 1)."

                var headers = [
                    "From: \(from)",
                    "To: \(to.joined(separator: ", "))",
                    "Subject: \(subject)",
                    "Date: \(rfc822(date))",
                    "Message-ID: \(messageID)"
                ]
                if let previousMessageID {
                    headers.append("In-Reply-To: \(previousMessageID)")
                    headers.append("References: \(previousMessageID)")
                }

                let chunk = """
                From \(from) Mon Jun 16 12:00:00 2026
                \(headers.joined(separator: "\n"))

                \(body)

                """
                chunks.append(chunk)
                previousMessageID = messageID
            }
        }

        return Data(chunks.joined().utf8)
    }

    public static func writeFixture(to url: URL, templates: [ThreadTemplate] = defaultTemplates) throws {
        try generateMbox(templates: templates).write(to: url)
    }

    private static func rfc822(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss Z"
        return formatter.string(from: date)
    }
}
