import CoreData
import Foundation

public struct CodecContext {
    public let repository: EntityRepository
    public let summarizationProvider: SummarizationProvider

    public init(repository: EntityRepository, summarizationProvider: SummarizationProvider) {
        self.repository = repository
        self.summarizationProvider = summarizationProvider
    }
}

public protocol HappyCodec {
    associatedtype Input
    associatedtype Output
    var name: String { get }
    var version: String { get }
    func transform(_ input: Input, context: CodecContext) throws -> Output
}

public struct MboxImportInput: Sendable {
    public let fileURL: URL
    public let fileDisplayName: String
    public let fileBookmarkData: Data?
    public let scope: ImportScope

    public init(
        fileURL: URL,
        fileDisplayName: String,
        fileBookmarkData: Data?,
        scope: ImportScope = .everything
    ) {
        self.fileURL = fileURL
        self.fileDisplayName = fileDisplayName
        self.fileBookmarkData = fileBookmarkData
        self.scope = scope
    }
}

public struct MboxImportOutput: Sendable {
    public let importEntityID: UUID
    public let rawEmailIDs: [UUID]
    public let messageCount: Int
    public let totalParsedCount: Int
    public let scope: ImportScope
}

public struct MboxImportCodec: HappyCodec {
    public let name = "MboxImportCodec"
    public let version = "0.1.0"

    public init() {}

    public func transform(_ input: MboxImportInput, context: CodecContext) throws -> MboxImportOutput {
        let start = Date()
        let source = try MailAppMailboxReader.detectSource(at: input.fileURL)
        let loaded: ScopedMailboxLoad
        switch source {
        case .mboxFile:
            let data = try Data(contentsOf: input.fileURL)
            try ImportCancellation.throwIfCancelled()
            guard let text = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1) else {
                throw MboxParserError.unreadableData
            }
            loaded = try MboxParser.parse(text: text, scope: input.scope)
        case .mailAppExportFolder:
            let payloadURL = input.fileURL.appendingPathComponent("mbox")
            let data = try Data(contentsOf: payloadURL)
            try ImportCancellation.throwIfCancelled()
            guard let text = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1) else {
                throw MboxParserError.unreadableData
            }
            loaded = try MboxParser.parse(text: text, scope: input.scope)
        case .mailAppLiveMailbox:
            loaded = try MailAppMailboxReader.loadMessages(from: input.fileURL, scope: input.scope)
        }
        let messages = loaded.messages
        let allMessagesCount = loaded.totalParsedCount

        guard !messages.isEmpty else {
            throw MboxImportError.noMessagesInScope(
                scopeTitle: input.scope.title,
                totalParsed: allMessagesCount,
                newestMessageDate: loaded.newestParsedDate
            )
        }

        let inputHash = ContentFingerprint.hash(input.fileDisplayName, String(allMessagesCount), input.scope.rawValue, Self.sourceLabel(source))
        let importProvenanceID = UUID()
        let importProvenance = ProvenanceFields(
            provenanceID: importProvenanceID,
            originRef: importProvenanceID,
            sourceClass: .userHeld,
            contentFingerprint: ContentFingerprint.hash(input.fileDisplayName, String(messages.count))
        )

        let importEntity = context.repository.insertMboxImport(
            fileDisplayName: input.fileDisplayName,
            fileBookmarkData: input.fileBookmarkData,
            messageCount: Int32(messages.count),
            provenance: importProvenance
        )

        var rawEmailIDs: [UUID] = []
        for message in messages {
            try ImportCancellation.throwIfCancelled()
            let fingerprint = try ContentFingerprint.hashJSON(message)
            let provenance = importProvenance.child(
                appendCodec: nil,
                contentFingerprint: fingerprint
            )
            let entity = context.repository.insertRawEmail(
                message: message,
                mboxImportID: importEntity.provenanceID,
                provenance: provenance
            )
            rawEmailIDs.append(entity.provenanceID)
        }

        let subjectGroups = Dictionary(grouping: messages) { ThreadClusterCodec.normalizeSubject($0.subject) }
        for (subject, group) in subjectGroups {
            let groupHash = ContentFingerprint.hash(subject, String(group.count))
            _ = context.repository.insertTransformationLog(
                codecName: name,
                codecVersion: version,
                inputEntityIDs: [importEntity.provenanceID],
                outputEntityIDs: rawEmailIDs,
                inputHash: inputHash,
                outputHash: groupHash,
                durationMs: Date().timeIntervalSince(start) * 1000 / Double(max(subjectGroups.count, 1)),
                modelUsed: nil,
                sourceClass: .userHeld,
                originRef: importProvenanceID
            )
        }

        return MboxImportOutput(
            importEntityID: importEntity.provenanceID,
            rawEmailIDs: rawEmailIDs,
            messageCount: messages.count,
            totalParsedCount: allMessagesCount,
            scope: input.scope
        )
    }

    private static func sourceLabel(_ source: MailMailboxSource) -> String {
        switch source {
        case .mboxFile: return "mbox"
        case .mailAppExportFolder: return "mail-export"
        case .mailAppLiveMailbox: return "mail-live"
        }
    }

    private static func resolvePayloadURL(from url: URL) throws -> URL {
        let resourceValues = try url.resourceValues(forKeys: [.isDirectoryKey, .isRegularFileKey])
        if resourceValues.isRegularFile == true {
            return url
        }

        guard resourceValues.isDirectory == true else {
            throw MboxImportError.unsupportedSelection(url.lastPathComponent)
        }

        let fileManager = FileManager.default
        let directPayload = url.appendingPathComponent("mbox", isDirectory: false)
        if fileManager.fileExists(atPath: directPayload.path) {
            return directPayload
        }

        let children = try fileManager.contentsOfDirectory(
            at: url,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        )
        if let regularFile = children.first(where: { child in
            guard child.pathExtension != "plist" else { return false }
            return (try? child.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true
        }) {
            return regularFile
        }

        throw MboxImportError.missingPayload(url.lastPathComponent)
    }
}

public enum MboxImportError: Error, LocalizedError {
    case unsupportedSelection(String)
    case missingPayload(String)
    case noMessagesInScope(scopeTitle: String, totalParsed: Int, newestMessageDate: Date? = nil)

    public var errorDescription: String? {
        switch self {
        case .unsupportedSelection(let name):
            return "\(name) is not a readable mbox file or folder."
        case .missingPayload(let name):
            return "\(name) is a Mail.app mailbox folder, not an exported .mbox file. Select the INBOX.mbox folder from ~/Library/Mail/ — HappyLabs now reads those directly — or use Mail.app → Mailbox → Export Mailbox…"
        case .noMessagesInScope(let scopeTitle, let totalParsed, let newestMessageDate):
            if totalParsed == 0 {
                return "No messages were found in this mailbox."
            }
            if let newestMessageDate {
                let formatter = DateFormatter()
                formatter.dateStyle = .medium
                let newest = formatter.string(from: newestMessageDate)
                return "No messages fall within “\(scopeTitle)”. This mailbox has \(totalParsed) messages; the newest is from \(newest). Try a wider range or Everything."
            }
            return "No messages fall within “\(scopeTitle)” (\(totalParsed) messages skipped). Try a wider range."
        }
    }
}

public struct ThreadClusterInput: Sendable {
    public let mboxImportID: UUID
}

public struct ThreadClusterOutput: Sendable {
    public let threadIDs: [UUID]
    public let orphanCount: Int
}

public struct ThreadClusterCodec: HappyCodec {
    public let name = "ThreadClusterCodec"
    public let version = "0.1.0"

    public init() {}

    public func transform(_ input: ThreadClusterInput, context: CodecContext) throws -> ThreadClusterOutput {
        let start = Date()
        let emails = try context.repository.fetchRawEmails(mboxImportID: input.mboxImportID)
        guard !emails.isEmpty else {
            return ThreadClusterOutput(threadIDs: [], orphanCount: 0)
        }

        let inputHash = ContentFingerprint.hash(input.mboxImportID.uuidString, String(emails.count))
        var clusters: [[RawEmailEntity]] = []
        var assigned = Set<UUID>()

        // Reply-graph clustering
        for email in emails {
            if assigned.contains(email.provenanceID) { continue }
            var cluster = [email]
            assigned.insert(email.provenanceID)
            var frontier = [email.messageID]

            while let anchor = frontier.popLast() {
                for candidate in emails where !assigned.contains(candidate.provenanceID) {
                    if repliesTo(candidate, anchor: anchor) {
                        cluster.append(candidate)
                        assigned.insert(candidate.provenanceID)
                        frontier.append(candidate.messageID)
                    }
                }
            }
            clusters.append(cluster)
        }

        // Subject-based merge for unthreaded messages
        var subjectGroups: [String: [RawEmailEntity]] = [:]
        for cluster in clusters {
            let subject = Self.normalizeSubject(cluster.first?.subject ?? "(no subject)")
            subjectGroups[subject, default: []].append(contentsOf: cluster)
        }
        clusters = subjectGroups.values.map {
            $0.sorted { ($0.dateSent ?? .distantPast) < ($1.dateSent ?? .distantPast) }
        }

        var threadIDs: [UUID] = []
        var orphanCount = 0

        for cluster in clusters {
            try ImportCancellation.throwIfCancelled()
            let ids = cluster.map(\.provenanceID)
            let subject = Self.normalizeSubject(cluster.first?.subject ?? "(no subject)")
            let participants = Set(cluster.map(\.fromAddress)).sorted().joined(separator: ", ")
            let dates = cluster.compactMap(\.dateSent)
            let isOrphan = cluster.count == 1 && cluster.first?.inReplyTo == nil && (cluster.first?.referencesHeader ?? "").isEmpty
            if isOrphan { orphanCount += 1 }

            let fingerprint = ContentFingerprint.hash(
                subject,
                ids.map(\.uuidString).joined(),
                participants
            )
            let parent = cluster.first!
            let provenance = ProvenanceFields(
                originRef: parent.provenanceID,
                sourceClass: parent.sourceClass,
                codecPath: parent.codecPath,
                contentFingerprint: fingerprint
            ).child(
                appendCodec: CodecPathEntry(
                    codecName: name,
                    codecVersion: version,
                    inputHash: inputHash,
                    outputHash: fingerprint
                ),
                contentFingerprint: fingerprint
            )

            let thread = context.repository.insertEmailThread(
                normalizedSubject: subject,
                participantSummary: participants,
                earliestDate: dates.min(),
                latestDate: dates.max(),
                rawEmailIDs: ids,
                isOrphan: isOrphan,
                provenance: provenance
            )
            threadIDs.append(thread.provenanceID)

            _ = context.repository.insertTransformationLog(
                codecName: name,
                codecVersion: version,
                inputEntityIDs: ids,
                outputEntityIDs: [thread.provenanceID],
                inputHash: inputHash,
                outputHash: fingerprint,
                durationMs: Date().timeIntervalSince(start) * 1000 / Double(max(clusters.count, 1)),
                modelUsed: nil,
                sourceClass: .userHeld,
                originRef: parent.provenanceID
            )
        }

        return ThreadClusterOutput(threadIDs: threadIDs, orphanCount: orphanCount)
    }

    private func repliesTo(_ email: RawEmailEntity, anchor: String) -> Bool {
        if email.inReplyTo?.contains(anchor) == true { return true }
        if email.referencesHeader?.contains(anchor) == true { return true }
        return false
    }

    public static func normalizeSubject(_ subject: String) -> String {
        var value = subject.trimmingCharacters(in: .whitespacesAndNewlines)
        while value.lowercased().hasPrefix("re:") || value.lowercased().hasPrefix("fwd:") {
            if value.lowercased().hasPrefix("re:") {
                value = String(value.dropFirst(3)).trimmingCharacters(in: .whitespaces)
            } else if value.lowercased().hasPrefix("fwd:") {
                value = String(value.dropFirst(4)).trimmingCharacters(in: .whitespaces)
            }
        }
        return value.isEmpty ? "(no subject)" : value
    }
}

public struct StoryExtractionInput: Sendable {
    public let threadIDs: [UUID]
}

public struct StoryExtractionOutput: Sendable {
    public let storyCandidateIDs: [UUID]
}

public struct StoryExtractionCodec: HappyCodec {
    public let name = "StoryExtractionCodec"
    public let version = "0.1.0"

    public init() {}

    public func transform(_ input: StoryExtractionInput, context: CodecContext) throws -> StoryExtractionOutput {
        let start = Date()
        let threads = try context.repository.fetchEmailThreads().filter { input.threadIDs.contains($0.provenanceID) }
        let inputHash = ContentFingerprint.hash(input.threadIDs.map(\.uuidString).joined())

        var storyIDs: [UUID] = []
        for thread in threads {
            try ImportCancellation.throwIfCancelled()
            let fetchedEmails = try fetchEmailsForThread(thread: thread, repository: context.repository)
            let threadContext = EmailThreadContext(
                threadID: thread.provenanceID,
                normalizedSubject: thread.normalizedSubject,
                participants: thread.participantSummary.split(separator: ",").map { String($0.trimmingCharacters(in: .whitespaces)) },
                emails: fetchedEmails.map { EmailMessageContext(from: $0) }
            )

            let summary = try context.summarizationProvider.summarize(thread: threadContext)
            let fingerprint = ContentFingerprint.hash(thread.provenanceID.uuidString, summary.title, summary.summary)

            let provenance = ProvenanceFields(
                originRef: thread.provenanceID,
                sourceClass: thread.sourceClass,
                codecPath: thread.codecPath,
                contentFingerprint: fingerprint
            ).child(
                appendCodec: CodecPathEntry(
                    codecName: name,
                    codecVersion: version,
                    inputHash: inputHash,
                    outputHash: fingerprint
                ),
                contentFingerprint: fingerprint
            )

            let candidate = context.repository.insertStoryCandidate(
                title: summary.title,
                summary: summary.summary,
                keyQuotes: summary.keyQuotes,
                emailThreadID: thread.provenanceID,
                modelUsed: summary.modelUsed,
                provenance: provenance
            )
            storyIDs.append(candidate.provenanceID)

            _ = context.repository.insertTransformationLog(
                codecName: name,
                codecVersion: version,
                inputEntityIDs: [thread.provenanceID],
                outputEntityIDs: [candidate.provenanceID],
                inputHash: inputHash,
                outputHash: fingerprint,
                durationMs: Date().timeIntervalSince(start) * 1000 / Double(max(threads.count, 1)),
                modelUsed: summary.modelUsed,
                sourceClass: .userHeld,
                originRef: thread.provenanceID
            )
        }

        return StoryExtractionOutput(storyCandidateIDs: storyIDs)
    }

    private func fetchEmailsForThread(thread: EmailThreadEntity, repository: EntityRepository) throws -> [RawEmailEntity] {
        let request = NSFetchRequest<RawEmailEntity>(entityName: "RawEmailEntity")
        request.predicate = NSPredicate(format: "provenanceID IN %@", thread.rawEmailIDs)
        return try repository.context.fetch(request)
    }
}

public struct JournalDraftInput: Sendable {
    public let storyCandidateIDs: [UUID]
}

public struct JournalDraftOutput: Sendable {
    public let journalEntryIDs: [UUID]
}

public struct JournalDraftCodec: HappyCodec {
    public let name = "JournalDraftCodec"
    public let version = "0.1.0"

    public init() {}

    public func transform(_ input: JournalDraftInput, context: CodecContext) throws -> JournalDraftOutput {
        let start = Date()
        let request = NSFetchRequest<StoryCandidateEntity>(entityName: "StoryCandidateEntity")
        request.predicate = NSPredicate(format: "provenanceID IN %@", input.storyCandidateIDs)
        let candidates = try context.repository.context.fetch(request)
        let inputHash = ContentFingerprint.hash(input.storyCandidateIDs.map(\.uuidString).joined())

        var journalIDs: [UUID] = []
        for candidate in candidates {
            try ImportCancellation.throwIfCancelled()
            let body = renderMarkdown(candidate: candidate)
            let fingerprint = ContentFingerprint.hash(candidate.title, body)
            let provenance = ProvenanceFields(
                originRef: candidate.provenanceID,
                sourceClass: candidate.sourceClass,
                codecPath: candidate.codecPath,
                contentFingerprint: fingerprint
            ).child(
                appendCodec: CodecPathEntry(
                    codecName: name,
                    codecVersion: version,
                    inputHash: inputHash,
                    outputHash: fingerprint
                ),
                contentFingerprint: fingerprint
            )

            let entry = context.repository.insertJournalEntry(
                title: candidate.title,
                bodyMarkdown: body,
                tags: ["email", "draft"],
                status: .draft,
                storyCandidateID: candidate.provenanceID,
                provenance: provenance
            )
            journalIDs.append(entry.provenanceID)

            _ = context.repository.insertTransformationLog(
                codecName: name,
                codecVersion: version,
                inputEntityIDs: [candidate.provenanceID],
                outputEntityIDs: [entry.provenanceID],
                inputHash: inputHash,
                outputHash: fingerprint,
                durationMs: Date().timeIntervalSince(start) * 1000 / Double(max(candidates.count, 1)),
                modelUsed: nil,
                sourceClass: .userHeld,
                originRef: candidate.provenanceID
            )
        }

        return JournalDraftOutput(journalEntryIDs: journalIDs)
    }

    private func renderMarkdown(candidate: StoryCandidateEntity) -> String {
        var lines = [
            "# \(candidate.title)",
            "",
            candidate.summary,
            ""
        ]
        if !candidate.keyQuotes.isEmpty {
            lines.append("## Key quotes")
            lines.append("")
            for quote in candidate.keyQuotes {
                lines.append("> \(quote)")
                lines.append("")
            }
        }
        lines.append("---")
        lines.append("_Draft from email thread. Review before archiving._")
        return lines.joined(separator: "\n")
    }
}

public struct BrowserContextIngestInput: Sendable {
    public let sourceURL: String
    public let title: String
    public let bodyText: String
    public let capturedAt: Date
    public let metadata: [String: String]

    public init(
        sourceURL: String,
        title: String,
        bodyText: String,
        capturedAt: Date = Date(),
        metadata: [String: String] = [:]
    ) {
        self.sourceURL = sourceURL
        self.title = title
        self.bodyText = bodyText
        self.capturedAt = capturedAt
        self.metadata = metadata
    }
}

public struct BrowserContextIngestOutput: Sendable {
    public let continuitySourceID: UUID
    public let contentFingerprint: String
}

public struct BrowserContextIngestCodec: HappyCodec {
    public let name = "BrowserContextIngestCodec"
    public let version = "0.1.0"

    public init() {}

    public func transform(_ input: BrowserContextIngestInput, context: CodecContext) throws -> BrowserContextIngestOutput {
        let start = Date()
        let fingerprint = Self.fingerprint(
            sourceURL: input.sourceURL,
            title: input.title,
            bodyText: input.bodyText
        )
        let codecEntry = CodecPathEntry(
            codecName: name,
            codecVersion: version,
            inputHash: fingerprint,
            outputHash: fingerprint
        )
        let provenanceID = UUID()
        let provenance = ProvenanceFields(
            provenanceID: provenanceID,
            originRef: provenanceID,
            sourceClass: .publicSource,
            codecPath: [codecEntry],
            contentFingerprint: fingerprint
        )

        let source = context.repository.insertContinuitySource(
            kind: .browserContext,
            title: input.title,
            bodyText: input.bodyText,
            sourceURL: input.sourceURL,
            capturedAt: input.capturedAt,
            metadata: input.metadata,
            state: .captured,
            provenance: provenance
        )

        _ = context.repository.insertTransformationLog(
            codecName: name,
            codecVersion: version,
            inputEntityIDs: [],
            outputEntityIDs: [source.provenanceID],
            inputHash: fingerprint,
            outputHash: fingerprint,
            durationMs: Date().timeIntervalSince(start) * 1000,
            modelUsed: nil,
            sourceClass: .publicSource,
            originRef: source.provenanceID
        )

        return BrowserContextIngestOutput(
            continuitySourceID: source.provenanceID,
            contentFingerprint: fingerprint
        )
    }

    public static func fingerprint(sourceURL: String, title: String, bodyText: String) -> String {
        ContentFingerprint.hash(sourceURL, title, bodyText)
    }
}
