import HappyLabsCore
import XCTest

final class RoundTripDriftMetricTests: XCTestCase {
    func testIdenticalTraversalHasNoDrift() {
        let text = "DAK approved rehabilitation on 27.02.2026. The Simssee confirmation turned uncertainty into a concrete plan."

        let report = RoundTripDriftMetric().evaluate(source: text, recovered: text)

        XCTAssertEqual(report.disposition, .stable)
        XCTAssertEqual(report.driftScore, 0, accuracy: 0.0001)
        XCTAssertEqual(report.sourcePreservation, 1, accuracy: 0.0001)
        XCTAssertEqual(report.orderPreservation, 1, accuracy: 0.0001)
        XCTAssertEqual(report.numericPreservation, 1, accuracy: 0.0001)
        XCTAssertTrue(report.signals.isEmpty)
    }

    func testMissingSourceMeaningForcesRevision() {
        let source = """
        DAK approved rehabilitation on 27.02.2026. Simssee confirmation became the turning point. Employer logistics and appointment timing depended on that approval.
        """
        let recovered = "A medical appointment happened later."

        let report = RoundTripDriftMetric().evaluate(source: source, recovered: recovered)

        XCTAssertEqual(report.disposition, .revise)
        XCTAssertGreaterThan(report.driftScore, 0.45)
        XCTAssertLessThan(report.sourcePreservation, 0.50)
        XCTAssertTrue(report.signals.contains { $0.kind == "source_omission" })
        XCTAssertTrue(report.signals.contains { $0.kind == "missing_anchors" })
    }

    func testNumericAndDateDriftIsFlagged() {
        let source = "Approval arrived on 27.02.2026 and the appointment was set for 03.03.2026."
        let recovered = "Approval arrived and the appointment was set."

        let report = RoundTripDriftMetric().evaluate(source: source, recovered: recovered)

        XCTAssertLessThan(report.numericPreservation, 1)
        XCTAssertTrue(report.signals.contains { $0.kind == "numeric_drift" })
    }

    func testIntroducedMaterialCreatesReviewPressure() {
        let source = "The clinic confirmation established a rehabilitation plan."
        let recovered = """
        The clinic confirmation established a rehabilitation plan. The insurer secretly rejected fraud, the employer retaliated, and a lawyer prepared litigation.
        """

        let report = RoundTripDriftMetric().evaluate(source: source, recovered: recovered)

        XCTAssertGreaterThan(report.contaminationRatio, 0.35)
        XCTAssertTrue(report.signals.contains { $0.kind == "introduced_material" })
        XCTAssertNotEqual(report.disposition, .stable)
    }

    func testNegationDriftIsFlagged() {
        let source = "The user did not authorize archival state without human review."
        let recovered = "The user authorized archival state with human review."

        let report = RoundTripDriftMetric().evaluate(source: source, recovered: recovered)

        XCTAssertLessThan(report.negationPreservation, 1)
        XCTAssertTrue(report.signals.contains { $0.kind == "modality_drift" })
    }
}
