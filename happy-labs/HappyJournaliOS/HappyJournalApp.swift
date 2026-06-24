import HappyLabsCore
import SwiftUI

@main
struct HappyJournalApp: App {
    @StateObject private var model = JournalModel()

    var body: some Scene {
        WindowGroup {
            JournalHomeView()
                .environmentObject(model)
                .onAppear {
                    model.applyLaunchArgumentsIfNeeded()
                }
        }
    }
}

@MainActor
final class JournalModel: ObservableObject {
    let persistence = PersistenceController.shared

    @Published var entries: [JournalEntrySnapshot] = []
    @Published var contextSources: [ContinuitySourceSnapshot] = []
    @Published var attachedContextCount = 0
    @Published var archivedCount = 0
    @Published var hasDraftEntry = false
    @Published var statusLine = "Local-first. Provenance before interpretation."
    @Published var lastFixtureMessage: String?
    private var didApplyLaunchArguments = false

    init() {
        refresh()
    }

    func refresh() {
        let repo = EntityRepository(context: persistence.container.viewContext)
        entries = ((try? repo.fetchJournalEntries()) ?? []).map { entity in
            let decisions = (try? repo.fetchHumanDecisions(journalEntryID: entity.provenanceID)) ?? []
            return JournalEntrySnapshot(entity, decisions: decisions)
        }
        contextSources = ((try? repo.fetchContinuitySources()) ?? []).map(ContinuitySourceSnapshot.init)
        let capturedCount = contextSources.filter { $0.state == .captured }.count
        attachedContextCount = contextSources.filter { $0.state == .attached }.count
        archivedCount = entries.filter { $0.status == .archived }.count
        hasDraftEntry = entries.contains { $0.status == .draft }
        statusLine = "\(entries.count) entries · \(capturedCount) captured · \(attachedContextCount) attached · \(archivedCount) archived"
    }

    func seedFixture() {
        do {
            let result = try LocalSeedFixtureService(persistence: persistence).resetAndSeed()
            refresh()
            lastFixtureMessage = "Seeded local fixture: draft \(result.draftEntryID.uuidString.prefix(8)), archived \(result.archivedEntryID.uuidString.prefix(8))."
        } catch {
            lastFixtureMessage = "Seed failed: \(error.localizedDescription)"
        }
    }

    func clearLocalData() {
        do {
            try DataResetService(persistence: persistence).clearAllData()
            refresh()
            lastFixtureMessage = "Cleared local fixture data."
        } catch {
            lastFixtureMessage = "Clear failed: \(error.localizedDescription)"
        }
    }

    func approveDraft(_ entry: JournalEntrySnapshot) {
        guard entry.status == .draft else {
            lastFixtureMessage = "Only draft entries can be approved from this test bed."
            return
        }
        do {
            try HumanReviewService(persistence: persistence).applyDecision(
                journalEntryID: entry.id,
                action: .approve,
                editedTitle: nil,
                editedBodyMarkdown: nil
            )
            refresh()
            lastFixtureMessage = "Approved \(entry.title.prefix(32)) into archive after human review."
        } catch {
            lastFixtureMessage = "Approve failed: \(error.localizedDescription)"
        }
    }

    func approveFirstDraft() {
        guard let draft = entries.first(where: { $0.status == .draft }) else {
            lastFixtureMessage = "No draft entry is awaiting review."
            return
        }
        approveDraft(draft)
    }

    func applyLaunchArgumentsIfNeeded() {
        guard !didApplyLaunchArguments else { return }
        didApplyLaunchArguments = true
        let arguments = ProcessInfo.processInfo.arguments
        if arguments.contains("--seed-local-fixture") {
            seedFixture()
        } else if arguments.contains("--clear-local-data") {
            clearLocalData()
        }
    }
}

struct ContextReferenceSnapshot: Identifiable, Hashable {
    let id: UUID
    let title: String
    let state: ContinuitySourceState
    let fingerprint: String

    init(_ source: ContinuitySource) {
        id = source.provenanceID
        title = source.title
        state = source.state
        fingerprint = source.contentFingerprint
    }
}

struct HumanDecisionSnapshot: Identifiable, Hashable {
    let id: UUID
    let action: HumanDecisionAction
    let decidedAt: Date
    let fingerprint: String

    init(_ decision: HumanDecisionEntity) {
        id = decision.provenanceID
        action = decision.decisionAction
        decidedAt = decision.decidedAt
        fingerprint = decision.contentFingerprint
    }
}

struct JournalEntrySnapshot: Identifiable, Hashable {
    let id: UUID
    let title: String
    let body: String
    let status: JournalEntryStatus
    let sourceClass: SourceClass
    let originRef: UUID
    let fingerprint: String
    let attachedContexts: [ContextReferenceSnapshot]
    let decisions: [HumanDecisionSnapshot]

    init(_ entity: JournalEntryEntity, decisions: [HumanDecisionEntity]) {
        id = entity.provenanceID
        title = entity.title
        body = entity.bodyMarkdown
        status = entity.entryStatus
        sourceClass = entity.sourceClass
        originRef = entity.originRef
        fingerprint = entity.contentFingerprint
        attachedContexts = entity.attachedSources
            .sorted { $0.capturedAt < $1.capturedAt }
            .map(ContextReferenceSnapshot.init)
        self.decisions = decisions
            .sorted { $0.decidedAt < $1.decidedAt }
            .map(HumanDecisionSnapshot.init)
    }
}

struct ContinuitySourceSnapshot: Identifiable, Hashable {
    let id: UUID
    let title: String
    let bodyText: String
    let kind: ContinuitySourceKind
    let state: ContinuitySourceState
    let sourceClass: SourceClass
    let sourceURL: String
    let capturedAt: Date
    let fingerprint: String
    let attachedEntryCount: Int

    init(_ entity: ContinuitySource) {
        id = entity.provenanceID
        title = entity.title
        bodyText = entity.bodyText
        kind = entity.kind
        state = entity.state
        sourceClass = entity.sourceClass
        sourceURL = entity.sourceURL ?? "local capture"
        capturedAt = entity.capturedAt
        fingerprint = entity.contentFingerprint
        attachedEntryCount = entity.attachedEntries.count
    }
}
