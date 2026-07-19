import CoreData
import Foundation

public final class PersistenceController: @unchecked Sendable {
    public static let shared = PersistenceController()

    public let container: NSPersistentContainer

    public init(inMemory: Bool = false) {
        let model = HappyLabsModel.makeModel()
        container = NSPersistentContainer(name: HappyLabsModel.modelName, managedObjectModel: model)

        if inMemory {
            let description = NSPersistentStoreDescription()
            description.type = NSInMemoryStoreType
            container.persistentStoreDescriptions = [description]
        } else {
            let storeURL = Self.defaultStoreURL()
            let description = NSPersistentStoreDescription(url: storeURL)
            description.cloudKitContainerOptions = nil
            description.setOption(true as NSNumber, forKey: NSPersistentHistoryTrackingKey)
            description.setOption(true as NSNumber, forKey: NSMigratePersistentStoresAutomaticallyOption)
            description.setOption(true as NSNumber, forKey: NSInferMappingModelAutomaticallyOption)
            container.persistentStoreDescriptions = [description]
        }

        container.loadPersistentStores { _, error in
            if let error {
                fatalError(
                    """
                    Happy Labs store failed: \(error)
                    Dev store reset required after ContinuitySource schema change. Production migration not implemented.
                    """
                )
            }
        }

        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
    }

    public static func defaultStoreURL() -> URL {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let folder = support.appendingPathComponent("HappyLabs", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("HappyLabs.sqlite")
    }

    public func newBackgroundContext() -> NSManagedObjectContext {
        let context = container.newBackgroundContext()
        context.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
        return context
    }

    public func save(_ context: NSManagedObjectContext) throws {
        if context.hasChanges {
            try context.save()
        }
    }
}

public struct EntityRepository {
    public let context: NSManagedObjectContext

    public init(context: NSManagedObjectContext) {
        self.context = context
    }

    private func insert<T: NSManagedObject>(_ entityName: String) -> T {
        NSEntityDescription.insertNewObject(forEntityName: entityName, into: context) as! T
    }

    public func insertMboxImport(
        fileDisplayName: String,
        fileBookmarkData: Data?,
        messageCount: Int32,
        provenance: ProvenanceFields
    ) -> MboxImportEntity {
        let entity: MboxImportEntity = insert("MboxImportEntity")
        entity.apply(provenance)
        entity.importedAt = Date()
        entity.fileDisplayName = fileDisplayName
        entity.fileBookmarkData = fileBookmarkData
        entity.messageCount = messageCount
        return entity
    }

    public func insertRawEmail(
        message: ParsedEmail,
        mboxImportID: UUID,
        provenance: ProvenanceFields
    ) -> RawEmailEntity {
        let entity: RawEmailEntity = insert("RawEmailEntity")
        entity.apply(provenance)
        entity.messageID = message.messageID
        entity.inReplyTo = message.inReplyTo
        entity.referencesHeader = message.references
        entity.subject = message.subject
        entity.fromAddress = message.from
        entity.toAddresses = message.to.joined(separator: ", ")
        entity.dateSent = message.date
        entity.bodyPlain = message.bodyPlain
        entity.bodyHTML = message.bodyHTML
        entity.mboxImportID = mboxImportID
        return entity
    }

    public func insertEmailThread(
        normalizedSubject: String,
        participantSummary: String,
        earliestDate: Date?,
        latestDate: Date?,
        rawEmailIDs: [UUID],
        isOrphan: Bool,
        provenance: ProvenanceFields
    ) -> EmailThreadEntity {
        let entity: EmailThreadEntity = insert("EmailThreadEntity")
        entity.apply(provenance)
        entity.normalizedSubject = normalizedSubject
        entity.participantSummary = participantSummary
        entity.earliestDate = earliestDate
        entity.latestDate = latestDate
        entity.rawEmailIDs = rawEmailIDs
        entity.isOrphan = isOrphan
        return entity
    }

    public func insertStoryCandidate(
        title: String,
        summary: String,
        keyQuotes: [String],
        emailThreadID: UUID,
        modelUsed: String,
        provenance: ProvenanceFields
    ) -> StoryCandidateEntity {
        let entity: StoryCandidateEntity = insert("StoryCandidateEntity")
        entity.apply(provenance)
        entity.title = title
        entity.summary = summary
        entity.keyQuotes = keyQuotes
        entity.emailThreadID = emailThreadID
        entity.modelUsed = modelUsed
        return entity
    }

    public func insertJournalEntry(
        title: String,
        bodyMarkdown: String,
        tags: [String],
        status: JournalEntryStatus,
        storyCandidateID: UUID,
        provenance: ProvenanceFields
    ) -> JournalEntryEntity {
        let entity: JournalEntryEntity = insert("JournalEntryEntity")
        entity.apply(provenance)
        entity.title = title
        entity.bodyMarkdown = bodyMarkdown
        entity.tags = tags
        entity.entryStatus = status
        entity.storyCandidateID = storyCandidateID
        return entity
    }

    public func insertContinuitySource(
        kind: ContinuitySourceKind,
        title: String,
        bodyText: String,
        sourceURL: String?,
        capturedAt: Date,
        metadata: [String: String],
        state: ContinuitySourceState,
        provenance: ProvenanceFields
    ) -> ContinuitySource {
        let entity: ContinuitySource = insert("ContinuitySource")
        entity.apply(provenance)
        entity.kind = kind
        entity.title = title
        entity.bodyText = bodyText
        entity.sourceURL = sourceURL
        entity.capturedAt = capturedAt
        entity.metadata = metadata
        entity.state = state
        return entity
    }

    public func insertTransformationLog(
        codecName: String,
        codecVersion: String,
        inputEntityIDs: [UUID],
        outputEntityIDs: [UUID],
        inputHash: String,
        outputHash: String,
        durationMs: Double,
        modelUsed: String?,
        sourceClass: SourceClass,
        originRef: UUID
    ) -> TransformationLogEntity {
        let fingerprint = ContentFingerprint.hash(codecName, codecVersion, inputHash, outputHash)
        let provenance = ProvenanceFields(
            originRef: originRef,
            sourceClass: sourceClass,
            contentFingerprint: fingerprint
        )
        let entity: TransformationLogEntity = insert("TransformationLogEntity")
        entity.apply(provenance)
        entity.codecName = codecName
        entity.codecVersion = codecVersion
        entity.inputEntityIDs = inputEntityIDs
        entity.outputEntityIDs = outputEntityIDs
        entity.inputHash = inputHash
        entity.outputHash = outputHash
        entity.durationMs = durationMs
        entity.modelUsed = modelUsed
        entity.loggedAt = Date()
        return entity
    }

    public func insertHumanDecision(
        journalEntryID: UUID,
        action: HumanDecisionAction,
        editedTitle: String?,
        editedBodyMarkdown: String?,
        provenance: ProvenanceFields
    ) -> HumanDecisionEntity {
        let entity: HumanDecisionEntity = insert("HumanDecisionEntity")
        entity.apply(provenance)
        entity.journalEntryID = journalEntryID
        entity.decisionAction = action
        entity.editedTitle = editedTitle
        entity.editedBodyMarkdown = editedBodyMarkdown
        entity.decidedAt = Date()
        return entity
    }

    /// - Parameter author: deliberately has no default. A revision whose author
    ///   was never decided is unattributable forever, so every call site is
    ///   made to state one.
    public func insertJournalRevision(
        journalEntryID: UUID,
        revisionNumber: Int32,
        title: String,
        bodyMarkdown: String,
        evidenceReferences: [String],
        author: JournalRevisionAuthor,
        provenance: ProvenanceFields
    ) -> JournalRevisionEntity {
        let entity: JournalRevisionEntity = insert("JournalRevisionEntity")
        entity.apply(provenance)
        entity.journalEntryID = journalEntryID
        entity.revisionNumber = revisionNumber
        entity.title = title
        entity.bodyMarkdown = bodyMarkdown
        entity.evidenceReferences = evidenceReferences
        entity.author = author
        entity.createdAt = Date()
        return entity
    }

    public func insertDiscardedArtifact(
        journalEntryID: UUID,
        storyCandidateID: UUID,
        reason: String?,
        provenance: ProvenanceFields
    ) -> DiscardedArtifactEntity {
        let entity: DiscardedArtifactEntity = insert("DiscardedArtifactEntity")
        entity.apply(provenance)
        entity.journalEntryID = journalEntryID
        entity.storyCandidateID = storyCandidateID
        entity.discardedAt = Date()
        entity.reason = reason
        return entity
    }

    public func fetchRawEmails(mboxImportID: UUID) throws -> [RawEmailEntity] {
        let request = NSFetchRequest<RawEmailEntity>(entityName: "RawEmailEntity")
        request.predicate = NSPredicate(format: "mboxImportID == %@", mboxImportID as CVarArg)
        request.sortDescriptors = [NSSortDescriptor(key: "dateSent", ascending: true)]
        return try context.fetch(request)
    }

    public func fetchEmailThreads() throws -> [EmailThreadEntity] {
        let request = NSFetchRequest<EmailThreadEntity>(entityName: "EmailThreadEntity")
        request.sortDescriptors = [NSSortDescriptor(key: "latestDate", ascending: false)]
        return try context.fetch(request)
    }

    public func fetchJournalEntries(status: JournalEntryStatus? = nil) throws -> [JournalEntryEntity] {
        let request = NSFetchRequest<JournalEntryEntity>(entityName: "JournalEntryEntity")
        if let status {
            request.predicate = NSPredicate(format: "status == %@", status.rawValue)
        }
        request.sortDescriptors = [NSSortDescriptor(key: "archivedAt", ascending: false)]
        return try context.fetch(request)
    }

    public func fetchTransformationLogs() throws -> [TransformationLogEntity] {
        let request = NSFetchRequest<TransformationLogEntity>(entityName: "TransformationLogEntity")
        request.sortDescriptors = [NSSortDescriptor(key: "loggedAt", ascending: true)]
        return try context.fetch(request)
    }

    public func fetchContinuitySources(
        state: ContinuitySourceState? = nil,
        kind: ContinuitySourceKind? = nil
    ) throws -> [ContinuitySource] {
        let request = NSFetchRequest<ContinuitySource>(entityName: "ContinuitySource")
        var predicates: [NSPredicate] = []
        if let state {
            predicates.append(NSPredicate(format: "stateRaw == %@", state.rawValue))
        }
        if let kind {
            predicates.append(NSPredicate(format: "kindRaw == %@", kind.rawValue))
        }
        if !predicates.isEmpty {
            request.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: predicates)
        }
        request.sortDescriptors = [NSSortDescriptor(key: "capturedAt", ascending: false)]
        return try context.fetch(request)
    }

    public func fetchContinuitySource(id: UUID) throws -> ContinuitySource? {
        let request = NSFetchRequest<ContinuitySource>(entityName: "ContinuitySource")
        request.predicate = NSPredicate(format: "provenanceID == %@", id as CVarArg)
        request.fetchLimit = 1
        return try context.fetch(request).first
    }

    @discardableResult
    public func attachContinuitySource(
        sourceID: UUID,
        toJournalEntryID journalEntryID: UUID
    ) throws -> Bool {
        guard let source = try fetchContinuitySource(id: sourceID) else {
            throw ContinuitySourceError.sourceNotFound
        }
        let entryRequest = NSFetchRequest<JournalEntryEntity>(entityName: "JournalEntryEntity")
        entryRequest.predicate = NSPredicate(format: "provenanceID == %@", journalEntryID as CVarArg)
        entryRequest.fetchLimit = 1
        guard let entry = try context.fetch(entryRequest).first else {
            throw ContinuitySourceError.journalEntryNotFound
        }

        if entry.attachedSources.contains(source) {
            if source.state == .captured {
                source.state = .attached
            }
            return false
        }

        entry.mutableSetValue(forKey: "attachedSources").add(source)
        if source.state == .captured {
            source.state = .attached
        }
        return true
    }

    public func fetchMboxImport(id: UUID) throws -> MboxImportEntity? {
        let request = NSFetchRequest<MboxImportEntity>(entityName: "MboxImportEntity")
        request.predicate = NSPredicate(format: "provenanceID == %@", id as CVarArg)
        request.fetchLimit = 1
        return try context.fetch(request).first
    }

    public func fetchHumanDecisions(journalEntryID: UUID) throws -> [HumanDecisionEntity] {
        try fetchHumanDecisions(journalEntryIDs: [journalEntryID])
    }

    public func fetchJournalRevisions(journalEntryID: UUID) throws -> [JournalRevisionEntity] {
        let request = NSFetchRequest<JournalRevisionEntity>(entityName: "JournalRevisionEntity")
        request.predicate = NSPredicate(format: "journalEntryID == %@", journalEntryID as CVarArg)
        request.sortDescriptors = [NSSortDescriptor(key: "revisionNumber", ascending: true)]
        return try context.fetch(request)
    }

    public func fetchHumanDecisions(journalEntryIDs: [UUID]) throws -> [HumanDecisionEntity] {
        guard !journalEntryIDs.isEmpty else { return [] }
        let allowed = Set(journalEntryIDs)
        let request = NSFetchRequest<HumanDecisionEntity>(entityName: "HumanDecisionEntity")
        request.sortDescriptors = [NSSortDescriptor(key: "decidedAt", ascending: true)]
        return try context.fetch(request).filter { allowed.contains($0.journalEntryID) }
    }

    public func allEntitiesHaveUserHeldSourceClass() throws -> Bool {
        let entityNames = [
            "MboxImportEntity",
            "RawEmailEntity",
            "EmailThreadEntity",
            "StoryCandidateEntity",
            "JournalEntryEntity",
            "ContinuitySource",
            "TransformationLogEntity",
            "HumanDecisionEntity",
            "DiscardedArtifactEntity"
        ]
        for name in entityNames {
            let request = NSFetchRequest<NSManagedObject>(entityName: name)
            request.predicate = NSPredicate(format: "sourceClassRaw != %@", SourceClass.userHeld.rawValue)
            request.fetchLimit = 1
            if try context.count(for: request) > 0 {
                return false
            }
        }
        return true
    }
}

public enum ContinuitySourceError: Error, LocalizedError {
    case sourceNotFound
    case journalEntryNotFound

    public var errorDescription: String? {
        switch self {
        case .sourceNotFound:
            return "Continuity source not found."
        case .journalEntryNotFound:
            return "Journal entry not found."
        }
    }
}
