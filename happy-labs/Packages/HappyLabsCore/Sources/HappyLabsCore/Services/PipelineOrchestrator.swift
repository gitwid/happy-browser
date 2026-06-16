import CoreData
import Foundation

public struct PipelineOrchestrator: Sendable {
    public let persistence: PersistenceController
    public let summarizationProvider: SummarizationProvider

    public init(
        persistence: PersistenceController = .shared,
        summarizationProvider: SummarizationProvider = SummarizationProviderFactory.makeDefault()
    ) {
        self.persistence = persistence
        self.summarizationProvider = summarizationProvider
    }

    public func importMbox(
        at url: URL,
        scope: ImportScope = .everything,
        progress: (@Sendable (ImportProgressUpdate) -> Void)? = nil
    ) throws -> MboxImportOutput {
        #if os(macOS)
        let bookmark = try? url.bookmarkData(options: .withSecurityScope, includingResourceValuesForKeys: nil, relativeTo: nil)
        #else
        let bookmark: Data? = nil
        #endif
        progress?(ImportProgressUpdate(stage: .readingFile, message: "Reading \(url.lastPathComponent)…"))
        let input = MboxImportInput(
            fileURL: url,
            fileDisplayName: url.lastPathComponent,
            fileBookmarkData: bookmark,
            scope: scope
        )
        progress?(ImportProgressUpdate(stage: .parsingMessages, message: "Parsing messages (\(scope.title))…"))
        return try run { context in
            progress?(ImportProgressUpdate(stage: .savingEmails, message: "Saving messages…"))
            let codecContext = CodecContext(
                repository: EntityRepository(context: context),
                summarizationProvider: summarizationProvider
            )
            let output = try MboxImportCodec().transform(input, context: codecContext)
            try persistence.save(context)
            return output
        }
    }

    public func runFullPipeline(
        mboxImportID: UUID,
        progress: (@Sendable (ImportProgressUpdate) -> Void)? = nil
    ) throws -> FullPipelineOutput {
        progress?(ImportProgressUpdate(stage: .clusteringThreads, message: "Clustering threads…"))
        let threadOutput = try runThreadCluster(mboxImportID: mboxImportID)
        progress?(ImportProgressUpdate(stage: .extractingStories, message: "Extracting stories…"))
        let storyOutput = try runStoryExtraction(threadIDs: threadOutput.threadIDs)
        progress?(ImportProgressUpdate(stage: .draftingJournal, message: "Weaving journal drafts…"))
        let journalDraft = try runJournalDraft(storyCandidateIDs: storyOutput.storyCandidateIDs)
        progress?(ImportProgressUpdate(stage: .finishing, message: "Finishing up…"))
        let coherenceReport = try CoherenceReportService(persistence: persistence).generate(mboxImportID: mboxImportID)
        return FullPipelineOutput(journalDraft: journalDraft, coherenceReport: coherenceReport)
    }

    public func runThreadCluster(mboxImportID: UUID) throws -> ThreadClusterOutput {
        try run { context in
            let codecContext = CodecContext(
                repository: EntityRepository(context: context),
                summarizationProvider: summarizationProvider
            )
            let output = try ThreadClusterCodec().transform(
                ThreadClusterInput(mboxImportID: mboxImportID),
                context: codecContext
            )
            try persistence.save(context)
            return output
        }
    }

    public func runStoryExtraction(threadIDs: [UUID]) throws -> StoryExtractionOutput {
        try run { context in
            let codecContext = CodecContext(
                repository: EntityRepository(context: context),
                summarizationProvider: summarizationProvider
            )
            let output = try StoryExtractionCodec().transform(
                StoryExtractionInput(threadIDs: threadIDs),
                context: codecContext
            )
            try persistence.save(context)
            return output
        }
    }

    public func runJournalDraft(storyCandidateIDs: [UUID]) throws -> JournalDraftOutput {
        try run { context in
            let codecContext = CodecContext(
                repository: EntityRepository(context: context),
                summarizationProvider: summarizationProvider
            )
            let output = try JournalDraftCodec().transform(
                JournalDraftInput(storyCandidateIDs: storyCandidateIDs),
                context: codecContext
            )
            try persistence.save(context)
            return output
        }
    }

    private func run<T>(_ work: (NSManagedObjectContext) throws -> T) throws -> T {
        let context = persistence.newBackgroundContext()
        var result: Result<T, Error>!
        context.performAndWait {
            result = Result { try work(context) }
        }
        return try result.get()
    }
}

public struct HumanReviewService: Sendable {
    public let persistence: PersistenceController

    public init(persistence: PersistenceController = .shared) {
        self.persistence = persistence
    }

    public func applyDecision(
        journalEntryID: UUID,
        action: HumanDecisionAction,
        editedTitle: String?,
        editedBodyMarkdown: String?
    ) throws {
        let context = persistence.newBackgroundContext()
        try context.performAndWait {
            let repo = EntityRepository(context: context)
            let request = NSFetchRequest<JournalEntryEntity>(entityName: "JournalEntryEntity")
            request.predicate = NSPredicate(format: "provenanceID == %@", journalEntryID as CVarArg)
            request.fetchLimit = 1
            guard let entry = try context.fetch(request).first else { return }

            if let editedTitle, !editedTitle.isEmpty {
                entry.title = editedTitle
            }
            if let editedBodyMarkdown, !editedBodyMarkdown.isEmpty {
                entry.bodyMarkdown = editedBodyMarkdown
            }
            entry.contentFingerprint = ContentFingerprint.hash(entry.title, entry.bodyMarkdown)

            let decisionProvenance = ProvenanceFields(
                originRef: entry.provenanceID,
                sourceClass: entry.sourceClass,
                codecPath: entry.codecPath,
                contentFingerprint: ContentFingerprint.hash(action.rawValue, entry.contentFingerprint)
            )

            _ = repo.insertHumanDecision(
                journalEntryID: entry.provenanceID,
                action: action,
                editedTitle: editedTitle,
                editedBodyMarkdown: editedBodyMarkdown,
                provenance: decisionProvenance
            )

            switch action {
            case .approve:
                entry.entryStatus = .archived
                entry.archivedAt = Date()
            case .edit:
                entry.entryStatus = .archived
                entry.archivedAt = Date()
            case .retain:
                entry.entryStatus = .retained
            case .discard:
                entry.entryStatus = .discarded
                let discardProvenance = ProvenanceFields(
                    originRef: entry.provenanceID,
                    sourceClass: entry.sourceClass,
                    codecPath: entry.codecPath,
                    contentFingerprint: entry.contentFingerprint
                )
                _ = repo.insertDiscardedArtifact(
                    journalEntryID: entry.provenanceID,
                    storyCandidateID: entry.storyCandidateID,
                    reason: "human_discard",
                    provenance: discardProvenance
                )
            }

            try persistence.save(context)
        }
    }
}

public struct ExportedJournalEntry: Codable, Equatable {
    public let provenanceID: UUID
    public let sourceClass: String
    public let codecPath: [CodecPathEntry]
    public let contentFingerprint: String
    public let journal: JournalPayload
    public let origins: OriginsPayload

    public struct JournalPayload: Codable, Equatable {
        public let title: String
        public let body: String
        public let archivedAt: Date?
    }

    public struct OriginsPayload: Codable, Equatable {
        public let storyCandidateID: UUID
        public let originRef: UUID
    }
}

public struct ExportService: Sendable {
    public let persistence: PersistenceController

    public init(persistence: PersistenceController = .shared) {
        self.persistence = persistence
    }

    public func exportJSON(entryID: UUID) throws -> Data {
        let entry = try fetchEntry(id: entryID)
        let payload = makeExport(entry)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return try encoder.encode(payload)
    }

    public func exportMarkdown(entryID: UUID) throws -> String {
        let entry = try fetchEntry(id: entryID)
        let payload = makeExport(entry)
        var lines = [
            payload.journal.title,
            "",
            payload.journal.body,
            "",
            "<details>",
            "<summary>Provenance</summary>",
            "",
            "- provenanceID: `\(payload.provenanceID.uuidString)`",
            "- sourceClass: `\(payload.sourceClass)`",
            "- contentFingerprint: `\(payload.contentFingerprint)`",
            "- storyCandidateID: `\(payload.origins.storyCandidateID.uuidString)`"
        ]
        for step in payload.codecPath {
            lines.append("- codec: \(step.codecName) @ \(step.codecVersion)")
        }
        lines.append("</details>")
        return lines.joined(separator: "\n")
    }

    public func roundTrip(entryID: UUID) throws -> ExportedJournalEntry {
        let data = try exportJSON(entryID: entryID)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(ExportedJournalEntry.self, from: data)
    }

    private func fetchEntry(id: UUID) throws -> JournalEntryEntity {
        let context = persistence.container.viewContext
        let request = NSFetchRequest<JournalEntryEntity>(entityName: "JournalEntryEntity")
        request.predicate = NSPredicate(format: "provenanceID == %@", id as CVarArg)
        request.fetchLimit = 1
        guard let entry = try context.fetch(request).first else {
            throw ExportError.entryNotFound
        }
        return entry
    }

    private func makeExport(_ entry: JournalEntryEntity) -> ExportedJournalEntry {
        ExportedJournalEntry(
            provenanceID: entry.provenanceID,
            sourceClass: entry.sourceClass.rawValue,
            codecPath: entry.codecPath,
            contentFingerprint: entry.contentFingerprint,
            journal: .init(
                title: entry.title,
                body: entry.bodyMarkdown,
                archivedAt: entry.archivedAt
            ),
            origins: .init(
                storyCandidateID: entry.storyCandidateID,
                originRef: entry.originRef
            )
        )
    }
}

public enum ExportError: Error, LocalizedError {
    case entryNotFound

    public var errorDescription: String? {
        switch self {
        case .entryNotFound: return "Journal entry not found."
        }
    }
}
