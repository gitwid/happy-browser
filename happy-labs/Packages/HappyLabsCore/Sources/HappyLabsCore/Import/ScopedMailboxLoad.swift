import Foundation

public struct ScopedMailboxLoad: Sendable, Equatable {
    public let messages: [ParsedEmail]
    public let totalParsedCount: Int
    public let newestParsedDate: Date?

    public init(messages: [ParsedEmail], totalParsedCount: Int, newestParsedDate: Date? = nil) {
        self.messages = messages
        self.totalParsedCount = totalParsedCount
        self.newestParsedDate = newestParsedDate
    }
}
