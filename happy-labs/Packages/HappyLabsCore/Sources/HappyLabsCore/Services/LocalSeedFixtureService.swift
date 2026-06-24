import CoreData
import Foundation

public struct LocalSeedFixtureResult: Sendable {
    public let draftEntryID: UUID
    public let archivedEntryID: UUID
    public let capturedContextID: UUID
    public let attachedContextID: UUID
    public let humanDecisionID: UUID
}

public struct LocalSeedFixtureService: Sendable {
    public let persistence: PersistenceController

    public init(persistence: PersistenceController = .shared) {
        self.persistence = persistence
    }

    public func resetAndSeed() throws -> LocalSeedFixtureResult {
        try DataResetService(persistence: persistence).clearAllData()

        let context = persistence.newBackgroundContext()
        var result: Result<LocalSeedFixtureResult, Error>!
        context.performAndWait {
            result = Result {
                let repo = EntityRepository(context: context)
                let captured = insertCapturedContext(repo: repo)
                let attached = insertAttachedContext(repo: repo)
                let draft = insertJournalEntry(
                    repo: repo,
                    title: "Planning the Berlin care thread",
                    body: """
                    A care thread becomes legible when context stays attached as evidence instead of replacing the story.

                    This draft is intentionally awaiting review. Its attached web context is useful, but not journaled state by itself.
                    """,
                    status: .draft,
                    seedKey: "draft"
                )
                let archived = insertJournalEntry(
                    repo: repo,
                    title: "The moment continuity became inspectable",
                    body: """
                    The seed fixture proves three separate states in the native iOS app: captured context, attached evidence, and archived journal state.

                    The archive transition exists only because a human decision record was written.
                    """,
                    status: .draft,
                    seedKey: "archived"
                )

                try repo.attachContinuitySource(
                    sourceID: attached.provenanceID,
                    toJournalEntryID: draft.provenanceID
                )

                let decision = insertHumanDecision(repo: repo, entry: archived)
                archived.entryStatus = .archived
                archived.archivedAt = Date(timeIntervalSince1970: 1_800_003_600)
                archived.contentFingerprint = ContentFingerprint.hash(archived.title, archived.bodyMarkdown)

                try persistence.save(context)

                return LocalSeedFixtureResult(
                    draftEntryID: draft.provenanceID,
                    archivedEntryID: archived.provenanceID,
                    capturedContextID: captured.provenanceID,
                    attachedContextID: attached.provenanceID,
                    humanDecisionID: decision.provenanceID
                )
            }
        }

        persistence.container.viewContext.reset()
        return try result.get()
    }

    private func insertCapturedContext(repo: EntityRepository) -> ContinuitySource {
        insertBrowserContext(
            repo: repo,
            title: "Sports medicine practice page contrast sample",
            body: "A real-world page where photographic atmosphere can obscure interface legibility.",
            sourceURL: "https://sportsmed.berlin/praxis/",
            capturedAt: Date(timeIntervalSince1970: 1_800_000_000),
            state: .captured,
            seedKey: "captured-context"
        )
    }

    private func insertAttachedContext(repo: EntityRepository) -> ContinuitySource {
        insertBrowserContext(
            repo: repo,
            title: "Context should orbit, not author",
            body: "Browser material can support a story without becoming autonomous journal state.",
            sourceURL: "https://example.com/happy/context-orbit",
            capturedAt: Date(timeIntervalSince1970: 1_800_000_600),
            state: .captured,
            seedKey: "attached-context"
        )
    }

    private func insertBrowserContext(
        repo: EntityRepository,
        title: String,
        body: String,
        sourceURL: String,
        capturedAt: Date,
        state: ContinuitySourceState,
        seedKey: String
    ) -> ContinuitySource {
        let fingerprint = BrowserContextIngestCodec.fingerprint(
            sourceURL: sourceURL,
            title: title,
            bodyText: body
        )
        let provenanceID = seededUUID(seedKey)
        let provenance = ProvenanceFields(
            provenanceID: provenanceID,
            originRef: provenanceID,
            sourceClass: .publicSource,
            codecPath: [
                CodecPathEntry(
                    codecName: "LocalSeedFixtureService",
                    codecVersion: "0.1.0",
                    inputHash: seedKey,
                    outputHash: fingerprint,
                    timestamp: capturedAt
                )
            ],
            contentFingerprint: fingerprint
        )
        return repo.insertContinuitySource(
            kind: .browserContext,
            title: title,
            bodyText: body,
            sourceURL: sourceURL,
            capturedAt: capturedAt,
            metadata: [
                "fixture": "ios-local-seed",
                "seedKey": seedKey
            ],
            state: state,
            provenance: provenance
        )
    }

    private func insertJournalEntry(
        repo: EntityRepository,
        title: String,
        body: String,
        status: JournalEntryStatus,
        seedKey: String
    ) -> JournalEntryEntity {
        let provenanceID = seededUUID(seedKey)
        let fingerprint = ContentFingerprint.hash(title, body)
        let provenance = ProvenanceFields(
            provenanceID: provenanceID,
            originRef: provenanceID,
            sourceClass: .userHeld,
            codecPath: [
                CodecPathEntry(
                    codecName: "LocalSeedFixtureService",
                    codecVersion: "0.1.0",
                    inputHash: seedKey,
                    outputHash: fingerprint,
                    timestamp: Date(timeIntervalSince1970: 1_800_001_200)
                )
            ],
            contentFingerprint: fingerprint
        )
        return repo.insertJournalEntry(
            title: title,
            bodyMarkdown: body,
            tags: ["ios-seed", "fixture"],
            status: status,
            storyCandidateID: seededUUID("\(seedKey)-story"),
            provenance: provenance
        )
    }

    private func insertHumanDecision(
        repo: EntityRepository,
        entry: JournalEntryEntity
    ) -> HumanDecisionEntity {
        let fingerprint = ContentFingerprint.hash("approve", entry.contentFingerprint)
        let provenance = ProvenanceFields(
            provenanceID: seededUUID("archived-decision"),
            originRef: entry.provenanceID,
            sourceClass: entry.sourceClass,
            codecPath: entry.codecPath,
            contentFingerprint: fingerprint
        )
        return repo.insertHumanDecision(
            journalEntryID: entry.provenanceID,
            action: .approve,
            editedTitle: nil,
            editedBodyMarkdown: nil,
            provenance: provenance
        )
    }

    private func seededUUID(_ seed: String) -> UUID {
        let hash = ContentFingerprint.hash("ios-local-seed", seed)
        let text = "\(hash.prefix(8))-\(hash.dropFirst(8).prefix(4))-\(hash.dropFirst(12).prefix(4))-\(hash.dropFirst(16).prefix(4))-\(hash.dropFirst(20).prefix(12))"
        return UUID(uuidString: text) ?? UUID()
    }
}
