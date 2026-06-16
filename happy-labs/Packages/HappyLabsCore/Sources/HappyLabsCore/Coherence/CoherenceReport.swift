import Foundation

public enum CoherenceDegradationKind: String, Codable, CaseIterable, Sendable {
    case orphanThreads
    case lowThreadYield
    case noJournalDrafts
    case awaitingHumanResync
}

public struct CoherenceDegradationSignal: Codable, Equatable, Sendable {
    public let kind: CoherenceDegradationKind
    public let detail: String

    public init(kind: CoherenceDegradationKind, detail: String) {
        self.kind = kind
        self.detail = detail
    }
}

public struct CoherenceCodecStageReport: Codable, Equatable, Sendable {
    public let codecName: String
    public let codecVersion: String
    public let transformationCount: Int
    public let totalDurationMs: Double
    public let inputEntityCount: Int
    public let outputEntityCount: Int
    public let yieldRatio: Double

    public init(
        codecName: String,
        codecVersion: String,
        transformationCount: Int,
        totalDurationMs: Double,
        inputEntityCount: Int,
        outputEntityCount: Int,
        yieldRatio: Double
    ) {
        self.codecName = codecName
        self.codecVersion = codecVersion
        self.transformationCount = transformationCount
        self.totalDurationMs = totalDurationMs
        self.inputEntityCount = inputEntityCount
        self.outputEntityCount = outputEntityCount
        self.yieldRatio = yieldRatio
    }
}

public struct CoherenceHumanReviewReport: Codable, Equatable, Sendable {
    public let pendingReviewCount: Int
    public let resyncEventCount: Int
    public let approvedCount: Int
    public let editedCount: Int
    public let retainedCount: Int
    public let discardedCount: Int
    public let archivedCount: Int
    public let discardRatio: Double?
    public let recoveryRate: Double?
    public let firstDecisionDelaySeconds: Double?
    public let pipelineToLastDecisionSeconds: Double?

    public init(
        pendingReviewCount: Int,
        resyncEventCount: Int,
        approvedCount: Int,
        editedCount: Int,
        retainedCount: Int,
        discardedCount: Int,
        archivedCount: Int,
        discardRatio: Double?,
        recoveryRate: Double?,
        firstDecisionDelaySeconds: Double?,
        pipelineToLastDecisionSeconds: Double?
    ) {
        self.pendingReviewCount = pendingReviewCount
        self.resyncEventCount = resyncEventCount
        self.approvedCount = approvedCount
        self.editedCount = editedCount
        self.retainedCount = retainedCount
        self.discardedCount = discardedCount
        self.archivedCount = archivedCount
        self.discardRatio = discardRatio
        self.recoveryRate = recoveryRate
        self.firstDecisionDelaySeconds = firstDecisionDelaySeconds
        self.pipelineToLastDecisionSeconds = pipelineToLastDecisionSeconds
    }
}

/// Measures how much thread coherence the pipeline borrowed from structure
/// rather than from continuous human attention.
public struct CoherenceReport: Codable, Equatable, Sendable {
    public static let currentVersion = 1

    public let version: Int
    public let mboxImportID: UUID
    public let generatedAt: Date

    public let inputMessageCount: Int
    public let threadCount: Int
    public let orphanThreadCount: Int
    public let storyCandidateCount: Int
    public let journalDraftCount: Int

    public let pipelineDurationSeconds: Double
    public let pipelineCompletedWithoutIntervention: Bool
    public let messagesPerStory: Double?
    public let structureCoherenceRatio: Double

    public let codecStages: [CoherenceCodecStageReport]
    public let degradationSignals: [CoherenceDegradationSignal]
    public let humanReview: CoherenceHumanReviewReport

    public init(
        version: Int = CoherenceReport.currentVersion,
        mboxImportID: UUID,
        generatedAt: Date = Date(),
        inputMessageCount: Int,
        threadCount: Int,
        orphanThreadCount: Int,
        storyCandidateCount: Int,
        journalDraftCount: Int,
        pipelineDurationSeconds: Double,
        pipelineCompletedWithoutIntervention: Bool,
        messagesPerStory: Double?,
        structureCoherenceRatio: Double,
        codecStages: [CoherenceCodecStageReport],
        degradationSignals: [CoherenceDegradationSignal],
        humanReview: CoherenceHumanReviewReport
    ) {
        self.version = version
        self.mboxImportID = mboxImportID
        self.generatedAt = generatedAt
        self.inputMessageCount = inputMessageCount
        self.threadCount = threadCount
        self.orphanThreadCount = orphanThreadCount
        self.storyCandidateCount = storyCandidateCount
        self.journalDraftCount = journalDraftCount
        self.pipelineDurationSeconds = pipelineDurationSeconds
        self.pipelineCompletedWithoutIntervention = pipelineCompletedWithoutIntervention
        self.messagesPerStory = messagesPerStory
        self.structureCoherenceRatio = structureCoherenceRatio
        self.codecStages = codecStages
        self.degradationSignals = degradationSignals
        self.humanReview = humanReview
    }
}

public struct FullPipelineOutput: Sendable {
    public let journalDraft: JournalDraftOutput
    public let coherenceReport: CoherenceReport

    public init(journalDraft: JournalDraftOutput, coherenceReport: CoherenceReport) {
        self.journalDraft = journalDraft
        self.coherenceReport = coherenceReport
    }
}
