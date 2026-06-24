import Foundation

public enum MailMailboxSource: Sendable, Equatable {
    case mboxFile
    case mailAppExportFolder
    case mailAppLiveMailbox
}

public enum MailAppMailboxReader {
    public static func detectSource(at url: URL) throws -> MailMailboxSource {
        let values = try url.resourceValues(forKeys: [.isDirectoryKey, .isRegularFileKey])
        if values.isRegularFile == true {
            return .mboxFile
        }
        guard values.isDirectory == true else {
            throw MboxImportError.unsupportedSelection(url.lastPathComponent)
        }
        let fileManager = FileManager.default
        if fileManager.fileExists(atPath: url.appendingPathComponent("mbox").path) {
            return .mailAppExportFolder
        }
        if isMailAppLiveMailbox(at: url) {
            return .mailAppLiveMailbox
        }
        throw MboxImportError.missingPayload(url.lastPathComponent)
    }

    public static func isMailAppLiveMailbox(at url: URL) -> Bool {
        let infoPlist = url.appendingPathComponent("Info.plist")
        guard FileManager.default.fileExists(atPath: infoPlist.path) else { return false }
        return !emlxFiles(in: url).isEmpty
    }

    public static func loadMessages(from url: URL) throws -> [ParsedEmail] {
        try loadMessages(from: url, scope: .everything).messages
    }

    public static func loadMessages(from url: URL, scope: ImportScope) throws -> ScopedMailboxLoad {
        var messages: [ParsedEmail] = []
        var totalParsedCount = 0
        var newestParsedDate: Date?
        for fileURL in emlxFiles(in: url) {
            try ImportCancellation.throwIfCancelled()
            guard let data = try? Data(contentsOf: fileURL),
                  let parsed = MboxParser.parseEmlx(data: data) else {
                continue
            }
            totalParsedCount += 1
            if let date = parsed.date {
                newestParsedDate = max(newestParsedDate ?? date, date)
            }
            if scope.includes(messageDate: parsed.date) {
                messages.append(parsed)
            }
        }
        return ScopedMailboxLoad(
            messages: messages,
            totalParsedCount: totalParsedCount,
            newestParsedDate: newestParsedDate
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
        return files.sorted { $0.path < $1.path }
    }
}
