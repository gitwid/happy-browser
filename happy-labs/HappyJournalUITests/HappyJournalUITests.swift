import XCTest

final class HappyJournalUITests: XCTestCase {
    func testSeededFixtureApprovesDraftThroughHumanReviewGate() {
        let app = XCUIApplication()
        app.launchArguments = ["--seed-local-fixture"]
        app.launch()

        XCTAssertTrue(app.staticTexts["2 entries · 1 captured · 1 attached · 1 archived"].waitForExistence(timeout: 5))

        let approveButton = app.buttons["approveFirstDraftButton"]
        XCTAssertTrue(approveButton.waitForExistence(timeout: 5))
        approveButton.tap()

        XCTAssertTrue(app.staticTexts["2 entries · 1 captured · 1 attached · 2 archived"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["approveFirstDraftButton"].exists)
    }
}
