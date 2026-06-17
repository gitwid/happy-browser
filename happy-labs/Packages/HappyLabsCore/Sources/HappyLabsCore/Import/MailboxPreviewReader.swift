import Foundation

public struct MailboxPreview: Sendable, Equatable {
    public let messageCount: Int
    public let datedMessageCount: Int
    public let newestDate: Date?
    public let oldestDate: Date?

    public init(messageCount: Int, datedMessageCount: Int, newestDate: Date?, oldestDate: Date?) {
        self.messageCount = messageCount
        self.datedMessageCount = datedMessageCount
        self.newestDate = newestDate
        self.oldestDate = oldestDate
    }

    public var dateRangeLabel: String? {
        guard let newestDate else { return nil }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        if let oldestDate, oldestDate != newestDate {
            return "\(formatter.string(from: oldestDate)) – \(formatter.string(from: newestDate))"
        }
        return formatter.string(from: newestDate)
    }

    public var isLegacyArchive: Bool {
        guard let newestDate else { return false }
        guard let cutoff = Calendar.current.date(byAdding: .year, value: -1, to: Date()) else { return false }
        return newestDate < cutoff
    }

    public func wouldIncludeMessages(for scope: ImportScope) -> Bool {
        guard let newestDate else { return scope == .everything }
        return scope.includes(messageDate: newestDate)
    }
}

public enum MailboxPreviewReader {
    public static func preview(at url: URL) throws -> MailboxPreview {
        let source = try MailAppMailboxReader.detectSource(at: url)
        switch source {
        case .mboxFile:
            return try previewMboxFile(at: url)
        case .mailAppExportFolder:
            return try previewMboxFile(at: url.appendingPathComponent("mbox"))
        case .mailAppLiveMailbox:
            let files = emlxFiles(in: url)
            var dates: [Date] = []
            for file in files.prefix(200) {
                guard let data = try? Data(contentsOf: file),
                      let parsed = MboxParser.parseEmlx(data: data),
                      let date = parsed.date else { continue }
                dates.append(date)
            }
            return MailboxPreview(
                messageCount: files.count,
                datedMessageCount: dates.count,
                newestDate: dates.max(),
                oldestDate: dates.min()
            )
        }
    }

    private static func previewMboxFile(at url: URL) throws -> MailboxPreview {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }

        var messageCount = 0
        var dates: [Date] = []
        var lineData = Data()

        while true {
            guard let chunk = try handle.read(upToCount: 65_536), !chunk.isEmpty else { break }
            lineData.append(chunk)

            while let range = lineData.firstRange(of: Data([0x0A])) {
                let lineBytes = lineData[..<range.lowerBound]
                lineData.removeSubrange(..<range.upperBound)

                guard let line = String(data: lineBytes, encoding: .utf8)
                    ?? String(data: lineBytes, encoding: .isoLatin1) else { continue }

                if line.hasPrefix("From ") {
                    messageCount += 1
                } else if line.hasPrefix("Date: ") {
                    let value = String(line.dropFirst(6))
                    if let date = MboxParser.parseHeaderDate(value) {
                        dates.append(date)
                    }
                }
            }
        }

        return MailboxPreview(
            messageCount: messageCount,
            datedMessageCount: dates.count,
            newestDate: dates.max(),
            oldestDate: dates.min()
        )
    }

    private static func emlxFiles(in root: URL) -> [URL] {
        guard let enumerator = FileManager.default.enumerator(
            at: root,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }

        var files: [URL] = []
        for case let fileURL as URL in enumerator {
            guard fileURL.pathExtension == "emlx" else { continue }
            if fileURL.lastPathComponent.contains(".partial.") { continue }
            files.append(fileURL)
        }
        return files
    }
}
