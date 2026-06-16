import Foundation

public struct EmailMessageContext: Sendable {
    public let messageID: String
    public let subject: String
    public let from: String
    public let date: Date?
    public let bodyPlain: String

    public init(messageID: String, subject: String, from: String, date: Date?, bodyPlain: String) {
        self.messageID = messageID
        self.subject = subject
        self.from = from
        self.date = date
        self.bodyPlain = bodyPlain
    }

    init(from entity: RawEmailEntity) {
        self.messageID = entity.messageID
        self.subject = entity.subject
        self.from = entity.fromAddress
        self.date = entity.dateSent
        self.bodyPlain = entity.bodyPlain
    }
}

public struct EmailThreadContext: Sendable {
    public let threadID: UUID
    public let normalizedSubject: String
    public let participants: [String]
    public let emails: [EmailMessageContext]
}

public struct StorySummary: Sendable {
    public let title: String
    public let summary: String
    public let keyQuotes: [String]
    public let modelUsed: String
}

public protocol SummarizationProvider: Sendable {
    var name: String { get }
    func summarize(thread: EmailThreadContext) throws -> StorySummary
}

public struct ExtractiveFallbackProvider: SummarizationProvider {
    public let name = "ExtractiveFallbackProvider"

    public init() {}

    public func summarize(thread: EmailThreadContext) throws -> StorySummary {
        let sorted = thread.emails.sorted { ($0.date ?? .distantPast) < ($1.date ?? .distantPast) }
        let first = sorted.first
        let last = sorted.last

        let opener = first.map { clip($0.bodyPlain, limit: 220) } ?? ""
        let closer = last.map { clip($0.bodyPlain, limit: 220) } ?? ""
        let summaryParts = [
            "Thread \"\(thread.normalizedSubject)\" with \(thread.participants.joined(separator: ", ")).",
            opener.isEmpty ? "" : "It opens: \(opener)",
            closer.isEmpty || closer == opener ? "" : "It latest says: \(closer)"
        ].filter { !$0.isEmpty }

        let quotes = [opener, closer]
            .filter { !$0.isEmpty }
            .prefix(2)
            .map { String($0) }

        return StorySummary(
            title: thread.normalizedSubject,
            summary: summaryParts.joined(separator: " "),
            keyQuotes: Array(quotes),
            modelUsed: name
        )
    }

    private func clip(_ text: String, limit: Int) -> String {
        let trimmed = text.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count > limit else { return trimmed }
        return String(trimmed.prefix(limit)).trimmingCharacters(in: .whitespaces) + "…"
    }
}

public struct FoundationModelsProvider: SummarizationProvider {
    public let name = "FoundationModelsProvider"
    private let fallback = ExtractiveFallbackProvider()

    public init() {}

    public func summarize(thread: EmailThreadContext) throws -> StorySummary {
        let summary = try fallback.summarize(thread: thread)
        return StorySummary(
            title: summary.title,
            summary: summary.summary,
            keyQuotes: summary.keyQuotes,
            modelUsed: fallback.name
        )
    }
}

public enum SummarizationProviderFactory {
    public static func makeDefault() -> SummarizationProvider {
        ExtractiveFallbackProvider()
    }
}
