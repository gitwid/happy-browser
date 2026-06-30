import XCTest
import HappyLabsCore

final class Phase01ValidationTests: XCTestCase {
    func testSyntheticMailboxProducesValidationReport() throws {
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("phase01-\(UUID().uuidString).mbox")
        defer { try? FileManager.default.removeItem(at: tempURL) }
        try SyntheticCorpusGenerator.writeFixture(to: tempURL)

        let service = Phase01ValidationService()
        let report = try service.validate(mboxURL: tempURL, scope: .everything)

        XCTAssertEqual(report.coherenceReport.inputMessageCount, 500)
        XCTAssertGreaterThanOrEqual(report.driftSummary.draftCount, 18)
        XCTAssertLessThanOrEqual(report.driftSummary.draftCount, 24)
        XCTAssertEqual(report.draftDriftReports.count, report.driftSummary.draftCount)
        XCTAssertEqual(
            report.driftSummary.stableCount +
            report.driftSummary.reviewCount +
            report.driftSummary.reviseCount,
            report.driftSummary.draftCount
        )

        let json = try service.exportJSON(report: report)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(Phase01ValidationReport.self, from: json)
        XCTAssertEqual(decoded.mboxImportID, report.mboxImportID)
        XCTAssertEqual(decoded.driftSummary.draftCount, report.driftSummary.draftCount)

        let markdown = try service.exportMarkdown(report: report)
        XCTAssertTrue(markdown.contains("Phase 0.1 Validation Report"))
        XCTAssertTrue(markdown.contains("Qualitative review"))
        XCTAssertTrue(markdown.contains("Coherence Report"))
    }

    func testReportRegeneratesAfterHumanReview() throws {
        let persistence = PersistenceController(inMemory: true)
        let orchestrator = PipelineOrchestrator(
            persistence: persistence,
            summarizationProvider: ExtractiveFallbackProvider()
        )

        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("phase01-review-\(UUID().uuidString).mbox")
        defer { try? FileManager.default.removeItem(at: tempURL) }
        try SyntheticCorpusGenerator.writeFixture(to: tempURL)

        let importOutput = try orchestrator.importMbox(at: tempURL)
        let pipelineOutput = try orchestrator.runFullPipeline(mboxImportID: importOutput.importEntityID)
        XCTAssertGreaterThan(pipelineOutput.coherenceReport.humanReview.pendingReviewCount, 0)

        let entryID = pipelineOutput.journalDraft.journalEntryIDs[0]
        try HumanReviewService(persistence: persistence).applyDecision(
            journalEntryID: entryID,
            action: .approve,
            editedTitle: nil,
            editedBodyMarkdown: nil
        )

        let refreshedCoherence = try CoherenceReportService(persistence: persistence)
            .generate(mboxImportID: importOutput.importEntityID)
        XCTAssertEqual(
            refreshedCoherence.humanReview.pendingReviewCount,
            pipelineOutput.coherenceReport.humanReview.pendingReviewCount - 1
        )
        XCTAssertEqual(refreshedCoherence.humanReview.approvedCount, 1)
    }
}
