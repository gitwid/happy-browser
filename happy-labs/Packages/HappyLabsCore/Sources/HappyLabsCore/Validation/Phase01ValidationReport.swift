import Foundation

public struct Phase01DraftDriftReport: Codable, Equatable, Sendable {
    public let journalEntryID: UUID
    public let title: String
    public let threadSubject: String
    public let messageCount: Int
    public let drift: RoundTripDriftReport

    public init(
        journalEntryID: UUID,
        title: String,
        threadSubject: String,
        messageCount: Int,
        drift: RoundTripDriftReport
    ) {
        self.journalEntryID = journalEntryID
        self.title = title
        self.threadSubject = threadSubject
        self.messageCount = messageCount
        self.drift = drift
    }
}

public struct Phase01DriftSummary: Codable, Equatable, Sendable {
    public let draftCount: Int
    public let stableCount: Int
    public let reviewCount: Int
    public let reviseCount: Int
    public let meanDriftScore: Double?

    public init(
        draftCount: Int,
        stableCount: Int,
        reviewCount: Int,
        reviseCount: Int,
        meanDriftScore: Double?
    ) {
        self.draftCount = draftCount
        self.stableCount = stableCount
        self.reviewCount = reviewCount
        self.reviseCount = reviseCount
        self.meanDriftScore = meanDriftScore
    }
}

/// Phase 0.1 validation bundle: structural coherence plus per-draft drift instruments.
public struct Phase01ValidationReport: Codable, Equatable, Sendable {
    public static let currentVersion = 1

    public let version: Int
    public let mboxDisplayName: String
    public let importScope: String
    public let mboxImportID: UUID
    public let generatedAt: Date
    public let coherenceReport: CoherenceReport
    public let draftDriftReports: [Phase01DraftDriftReport]
    public let driftSummary: Phase01DriftSummary

    public init(
        version: Int = Phase01ValidationReport.currentVersion,
        mboxDisplayName: String,
        importScope: String,
        mboxImportID: UUID,
        generatedAt: Date = Date(),
        coherenceReport: CoherenceReport,
        draftDriftReports: [Phase01DraftDriftReport],
        driftSummary: Phase01DriftSummary
    ) {
        self.version = version
        self.mboxDisplayName = mboxDisplayName
        self.importScope = importScope
        self.mboxImportID = mboxImportID
        self.generatedAt = generatedAt
        self.coherenceReport = coherenceReport
        self.draftDriftReports = draftDriftReports
        self.driftSummary = driftSummary
    }
}
