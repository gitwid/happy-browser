import Foundation

public struct ParsedEmail: Codable, Equatable, Sendable {
    public let messageID: String
    public let inReplyTo: String?
    public let references: String?
    public let subject: String
    public let from: String
    public let to: [String]
    public let date: Date?
    public let bodyPlain: String
    public let bodyHTML: String?

    public init(
        messageID: String,
        inReplyTo: String? = nil,
        references: String? = nil,
        subject: String,
        from: String,
        to: [String],
        date: Date? = nil,
        bodyPlain: String,
        bodyHTML: String? = nil
    ) {
        self.messageID = messageID
        self.inReplyTo = inReplyTo
        self.references = references
        self.subject = subject
        self.from = from
        self.to = to
        self.date = date
        self.bodyPlain = bodyPlain
        self.bodyHTML = bodyHTML
    }
}

public enum MboxParser {
    private static let fromLinePrefix = "From "

    public static func parse(data: Data) throws -> [ParsedEmail] {
        guard let text = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1) else {
            throw MboxParserError.unreadableData
        }
        return try parse(text: text)
    }

    public static func parse(text: String) throws -> [ParsedEmail] {
        try parse(text: text, scope: .everything).messages
    }

    public static func parse(text: String, scope: ImportScope) throws -> ScopedMailboxLoad {
        var messages: [ParsedEmail] = []
        var totalParsedCount = 0
        var newestParsedDate: Date?
        var currentLines: [String] = []

        func flush() throws {
            guard !currentLines.isEmpty else { return }
            try ImportCancellation.throwIfCancelled()
            let raw = currentLines.joined(separator: "\n")
            if let parsed = parseRFC822(raw) {
                totalParsedCount += 1
                if let date = parsed.date {
                    newestParsedDate = max(newestParsedDate ?? date, date)
                }
                if scope.includes(messageDate: parsed.date) {
                    messages.append(parsed)
                }
            }
            currentLines.removeAll(keepingCapacity: true)
        }

        for line in text.split(separator: "\n", omittingEmptySubsequences: false) {
            try ImportCancellation.throwIfCancelled()
            let lineString = String(line)
            if lineString.hasPrefix(fromLinePrefix), !currentLines.isEmpty {
                try flush()
            }
            if !lineString.hasPrefix(fromLinePrefix) || !currentLines.isEmpty {
                currentLines.append(lineString)
            }
        }
        try flush()
        return ScopedMailboxLoad(
            messages: messages,
            totalParsedCount: totalParsedCount,
            newestParsedDate: newestParsedDate
        )
    }

    public static func parseRFC822(_ raw: String) -> ParsedEmail? {
        parseMessage(raw: raw)
    }

    public static func parseEmlx(data: Data) -> ParsedEmail? {
        guard let text = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1) else {
            return nil
        }
        let lines = text.split(separator: "\n", omittingEmptySubsequences: false)
        guard lines.count > 1 else { return nil }
        let payload = lines.dropFirst().joined(separator: "\n")
        return parseRFC822(payload)
    }

    private static func parseMessage(raw: String) -> ParsedEmail? {
        let parts = raw.components(separatedBy: "\n\n")
        guard let headerBlock = parts.first else { return nil }
        let body = parts.dropFirst().joined(separator: "\n\n")

        var headers: [String: String] = [:]
        var currentKey: String?
        var currentValue = ""

        for line in headerBlock.split(separator: "\n", omittingEmptySubsequences: false) {
            let lineString = String(line)
            if lineString.first == " " || lineString.first == "\t", let key = currentKey {
                currentValue += " " + lineString.trimmingCharacters(in: .whitespaces)
                headers[key] = currentValue
            } else if let colon = lineString.firstIndex(of: ":") {
                if let key = currentKey {
                    headers[key] = currentValue
                }
                currentKey = String(lineString[..<colon]).trimmingCharacters(in: .whitespaces).lowercased()
                currentValue = String(lineString[lineString.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
            }
        }
        if let key = currentKey {
            headers[key] = currentValue
        }

        let messageID = normalizeMessageID(headers["message-id"]) ?? UUID().uuidString
        let subject = MIMEHeaderDecoder.decode(headers["subject"] ?? "(no subject)")
        let from = MIMEHeaderDecoder.decode(headers["from"] ?? "unknown@example.com")
        let to = (headers["to"] ?? "")
            .split(separator: ",")
            .map { MIMEHeaderDecoder.decode(String($0.trimmingCharacters(in: .whitespaces))) }
            .filter { !$0.isEmpty }
        let date = parseDate(headers["date"])

        let decodedBody = EmailBodyDecoder.decodeBody(headers: headers, body: body)

        return ParsedEmail(
            messageID: messageID,
            inReplyTo: normalizeMessageID(headers["in-reply-to"]),
            references: headers["references"],
            subject: subject,
            from: from,
            to: to.isEmpty ? ["unknown@example.com"] : to,
            date: date,
            bodyPlain: decodedBody.plain,
            bodyHTML: decodedBody.html
        )
    }

    private static func normalizeMessageID(_ value: String?) -> String? {
        guard var value else { return nil }
        value = value.trimmingCharacters(in: CharacterSet(charactersIn: "<> \t"))
        return value.isEmpty ? nil : value
    }

    private static func parseDate(_ value: String?) -> Date? {
        guard let value else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        for format in [
            "EEE, dd MMM yyyy HH:mm:ss Z",
            "EEE, dd MMM yyyy HH:mm:ss zzz",
            "dd MMM yyyy HH:mm:ss Z"
        ] {
            formatter.dateFormat = format
            if let date = formatter.date(from: value) {
                return date
            }
        }
        return ISO8601DateFormatter().date(from: value)
    }

    public static func parseHeaderDate(_ value: String) -> Date? {
        parseDate(value.trimmingCharacters(in: .whitespacesAndNewlines))
    }
}

public enum MboxParserError: Error, LocalizedError {
    case unreadableData

    public var errorDescription: String? {
        switch self {
        case .unreadableData: return "Could not decode mbox data."
        }
    }
}
