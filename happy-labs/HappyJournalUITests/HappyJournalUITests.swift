import XCTest

final class HappyJournalUITests: XCTestCase {
    func testRecoverabilityBuilderCreatesPacketFromMemoryBaseline() {
        let app = XCUIApplication()
        app.launch()

        let openBuilder = app.buttons["openRecoverabilityBuilderButton"]
        XCTAssertTrue(openBuilder.waitForExistence(timeout: 5))
        openBuilder.tap()

        let baselineEditor = app.textViews["memoryBaselineEditor"]
        XCTAssertTrue(baselineEditor.waitForExistence(timeout: 5))
        baselineEditor.tap()
        baselineEditor.typeText("There was an uncertain rehabilitation arc before approval. The approval changed the logistics and made the next practical steps possible.")

        app.swipeUp()

        let createButton = app.buttons["createRecoveryPacketButton"]
        XCTAssertTrue(createButton.waitForExistence(timeout: 5))
        createButton.tap()

        let status = app.staticTexts["recoveryStatusMessage"]
        XCTAssertTrue(status.waitForExistence(timeout: 5))
        let createdPredicate = NSPredicate(format: "label CONTAINS %@", "Created Rehabilitation packet")
        expectation(for: createdPredicate, evaluatedWith: status)
        waitForExpectations(timeout: 5)

        XCTAssertTrue(app.staticTexts["recoveryPacketPath"].waitForExistence(timeout: 5))
    }

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
