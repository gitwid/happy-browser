import HappyLabsCore
import XCTest

final class ProvenanceTests: XCTestCase {
    func testChildInheritsSourceClass() {
        let parent = ProvenanceFields(
            provenanceID: UUID(),
            originRef: UUID(),
            sourceClass: .userHeld,
            contentFingerprint: "abc"
        )
        let child = parent.child(contentFingerprint: "def")
        XCTAssertEqual(child.sourceClass, .userHeld)
        XCTAssertEqual(child.originRef, parent.provenanceID)
        XCTAssertNotEqual(child.provenanceID, parent.provenanceID)
    }

    func testNonFungibilityWithDifferentProvenance() {
        let a = ProvenanceFields(originRef: UUID(), sourceClass: .userHeld, contentFingerprint: "same")
        let b = ProvenanceFields(originRef: UUID(), sourceClass: .userHeld, contentFingerprint: "same")
        XCTAssertNotEqual(a.provenanceID, b.provenanceID)
    }
}

final class MboxParserTests: XCTestCase {
    func testParsesSimpleMbox() throws {
        let mbox = """
        From alice@example.com Mon Jun 16 12:00:00 2026
        From: alice@example.com
        To: bob@example.com
        Subject: Hello
        Message-ID: <1@example.com>
        Date: Mon, 16 Jun 2026 12:00:00 +0000

        Body text

        """
        let messages = try MboxParser.parse(text: mbox)
        XCTAssertEqual(messages.count, 1)
        XCTAssertEqual(messages[0].subject, "Hello")
        XCTAssertEqual(messages[0].messageID, "1@example.com")
    }

    func testImportsMailAppMboxDirectory() throws {
        let persistence = PersistenceController(inMemory: true)
        let orchestrator = PipelineOrchestrator(
            persistence: persistence,
            summarizationProvider: ExtractiveFallbackProvider()
        )
        let folderURL = FileManager.default.temporaryDirectory.appendingPathComponent("mail-export-\(UUID().uuidString).mbox")
        let payloadURL = folderURL.appendingPathComponent("mbox")
        defer { try? FileManager.default.removeItem(at: folderURL) }

        try FileManager.default.createDirectory(at: folderURL, withIntermediateDirectories: true)
        try """
        From alice@example.com Mon Jun 16 12:00:00 2026
        From: alice@example.com
        To: bob@example.com
        Subject: Folder Hello
        Message-ID: <folder-1@example.com>
        Date: Mon, 16 Jun 2026 12:00:00 +0000

        Body text

        """.write(to: payloadURL, atomically: true, encoding: .utf8)

        let output = try orchestrator.importMbox(at: folderURL)
        XCTAssertEqual(output.messageCount, 1)
    }

    func testImportScopeFiltersByDate() throws {
        let persistence = PersistenceController(inMemory: true)
        let orchestrator = PipelineOrchestrator(
            persistence: persistence,
            summarizationProvider: ExtractiveFallbackProvider()
        )
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("scope-\(UUID().uuidString).mbox")
        defer { try? FileManager.default.removeItem(at: tempURL) }

        try """
        From old@example.com Mon Jun 16 12:00:00 2020
        From: old@example.com
        To: bob@example.com
        Subject: Old
        Message-ID: <old@example.com>
        Date: Mon, 16 Jun 2020 12:00:00 +0000

        Old body

        From new@example.com Mon Jun 16 12:00:00 2026
        From: new@example.com
        To: bob@example.com
        Subject: New
        Message-ID: <new@example.com>
        Date: Mon, 16 Jun 2026 12:00:00 +0000

        New body

        """.write(to: tempURL, atomically: true, encoding: .utf8)

        let output = try orchestrator.importMbox(at: tempURL, scope: .lastMonth)
        XCTAssertEqual(output.totalParsedCount, 2)
        XCTAssertEqual(output.messageCount, 1)
    }

    func testParsesMailAppEmlxFile() throws {
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("sample-\(UUID().uuidString).emlx")
        defer { try? FileManager.default.removeItem(at: tempURL) }
        try """
        101030
        From: alice@example.com
        To: bob@example.com
        Subject: Emlx Hello
        Message-ID: <emlx-1@example.com>
        Date: Mon, 16 Jun 2026 12:00:00 +0000

        Body from emlx

        """.write(to: tempURL, atomically: true, encoding: .utf8)

        let data = try Data(contentsOf: tempURL)
        let parsed = MboxParser.parseEmlx(data: data)
        XCTAssertEqual(parsed?.subject, "Emlx Hello")
        XCTAssertEqual(parsed?.from, "alice@example.com")
    }

    func testDecodesMIMEEncodedSubject() throws {
        let encoded = "=?UTF-8?Q?We=E2=80=99d_love_to_hear_how_it_went_with_Apple_Support.?="
        XCTAssertEqual(
            MIMEHeaderDecoder.decode(encoded),
            "We’d love to hear how it went with Apple Support."
        )
    }

    func testDecodesMIMEEncodedGermanSubject() throws {
        let encoded = "=?UTF-8?Q?Ihre_Registrierung_bei_der_trans-o-flex_Empf=C3=A4nger_App?="
        XCTAssertEqual(
            MIMEHeaderDecoder.decode(encoded),
            "Ihre Registrierung bei der trans-o-flex Empfänger App"
        )
    }

    func testParsesMboxWithEncodedSubject() throws {
        let mbox = """
        From alice@example.com Mon Jun 16 12:00:00 2026
        From: alice@example.com
        To: bob@example.com
        Subject: =?UTF-8?Q?You=E2=80=99re_confirmed_for_a_WWDC26_Group_Interview?=
        Message-ID: <2@example.com>
        Date: Mon, 16 Jun 2026 12:00:00 +0000

        Body text

        """
        let messages = try MboxParser.parse(text: mbox)
        XCTAssertEqual(messages.count, 1)
        XCTAssertEqual(messages[0].subject, "You’re confirmed for a WWDC26 Group Interview")
    }

    func testDecodesMultipartQuotedPrintableBody() throws {
        let mbox = """
From notifications@facebookmail.com Mon Jun 16 12:00:00 2026
From: notifications@facebookmail.com
To: user@example.com
Subject: Facebook notification
Message-ID: <fb-1@example.com>
Date: Mon, 16 Jun 2026 12:00:00 +0000
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="fb_boundary_123"

--fb_boundary_123
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: quoted-printable

Hi there,=0A=0AYour friend posted an update.=3D=3D See it here.=0A
--fb_boundary_123
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: quoted-printable

<p>Hi there,</p><p>Your friend posted an update.</p>
--fb_boundary_123--

"""
        let messages = try MboxParser.parse(text: mbox)
        XCTAssertEqual(messages.count, 1)
        let body = messages[0].bodyPlain
        XCTAssertFalse(body.contains("=3D"))
        XCTAssertFalse(body.contains("fb_boundary_123"))
        XCTAssertTrue(body.contains("Hi there"))
        XCTAssertTrue(body.contains("Your friend posted an update."))
        XCTAssertTrue(body.contains("=="))
    }

    func testMailboxPreviewDetectsLegacyArchive() throws {
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("legacy-\(UUID().uuidString).mbox")
        defer { try? FileManager.default.removeItem(at: tempURL) }
        try """
        From old@example.com Mon Jun 16 12:00:00 2017
        From: old@example.com
        To: bob@example.com
        Subject: Old
        Message-ID: <old@example.com>
        Date: Mon, 16 Jun 2017 12:00:00 +0000

        Old body

        """.write(to: tempURL, atomically: true, encoding: .utf8)

        let preview = try MailboxPreviewReader.preview(at: tempURL)
        XCTAssertEqual(preview.messageCount, 1)
        XCTAssertTrue(preview.isLegacyArchive)
        XCTAssertFalse(preview.wouldIncludeMessages(for: .lastMonth))
    }

    func testDataResetClearsStore() throws {
        let persistence = PersistenceController(inMemory: true)
        let orchestrator = PipelineOrchestrator(
            persistence: persistence,
            summarizationProvider: ExtractiveFallbackProvider()
        )
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("reset-\(UUID().uuidString).mbox")
        defer { try? FileManager.default.removeItem(at: tempURL) }
        try """
        From alice@example.com Mon Jun 16 12:00:00 2026
        From: alice@example.com
        To: bob@example.com
        Subject: Reset me
        Message-ID: <reset@example.com>
        Date: Mon, 16 Jun 2026 12:00:00 +0000

        Body

        """.write(to: tempURL, atomically: true, encoding: .utf8)

        let importOutput = try orchestrator.importMbox(at: tempURL, scope: .everything)
        _ = try orchestrator.runFullPipeline(mboxImportID: importOutput.importEntityID)
        let repo = EntityRepository(context: persistence.container.viewContext)
        XCTAssertFalse(try repo.fetchJournalEntries().isEmpty)

        try DataResetService(persistence: persistence).clearAllData()
        XCTAssertTrue(try repo.fetchJournalEntries().isEmpty)
    }

    func testImportsMailAppLiveMailboxBundle() throws {
        let persistence = PersistenceController(inMemory: true)
        let orchestrator = PipelineOrchestrator(
            persistence: persistence,
            summarizationProvider: ExtractiveFallbackProvider()
        )
        let mailboxURL = FileManager.default.temporaryDirectory.appendingPathComponent("INBOX-\(UUID().uuidString).mbox")
        let messagesURL = mailboxURL
            .appendingPathComponent(UUID().uuidString)
            .appendingPathComponent("Data/Messages", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: mailboxURL) }

        try FileManager.default.createDirectory(at: messagesURL, withIntermediateDirectories: true)
        try Data("""
        <?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict/></plist>
        """.utf8).write(to: mailboxURL.appendingPathComponent("Info.plist"))
        try """
        120
        From: live@example.com
        To: bob@example.com
        Subject: Live mailbox message
        Message-ID: <live-1@example.com>
        Date: Mon, 16 Jun 2026 12:00:00 +0000

        Live body

        """.write(to: messagesURL.appendingPathComponent("1.emlx"), atomically: true, encoding: .utf8)

        let output = try orchestrator.importMbox(at: mailboxURL, scope: .everything)
        XCTAssertEqual(output.messageCount, 1)
    }
}

final class AcceptanceTests: XCTestCase {
    func testFiveHundredToTwentyPlumbing() throws {
        let persistence = PersistenceController(inMemory: true)
        let orchestrator = PipelineOrchestrator(
            persistence: persistence,
            summarizationProvider: ExtractiveFallbackProvider()
        )

        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("acceptance-\(UUID().uuidString).mbox")
        defer { try? FileManager.default.removeItem(at: tempURL) }
        try SyntheticCorpusGenerator.writeFixture(to: tempURL)

        let importOutput = try orchestrator.importMbox(at: tempURL)
        XCTAssertEqual(importOutput.messageCount, 500)

        let pipelineOutput = try orchestrator.runFullPipeline(mboxImportID: importOutput.importEntityID)
        let draftOutput = pipelineOutput.journalDraft

        let context = persistence.container.viewContext
        let storyRequest = NSFetchRequest<StoryCandidateEntity>(entityName: "StoryCandidateEntity")
        let stories = try context.fetch(storyRequest)
        XCTAssertGreaterThanOrEqual(stories.count, 18)
        XCTAssertLessThanOrEqual(stories.count, 24)

        let report = pipelineOutput.coherenceReport
        XCTAssertEqual(report.mboxImportID, importOutput.importEntityID)
        XCTAssertEqual(report.inputMessageCount, 500)
        XCTAssertEqual(report.storyCandidateCount, stories.count)
        XCTAssertEqual(report.journalDraftCount, draftOutput.journalEntryIDs.count)
        XCTAssertEqual(report.codecStages.count, 4)
        XCTAssertTrue(report.pipelineCompletedWithoutIntervention)
        if let messagesPerStory = report.messagesPerStory {
            XCTAssertEqual(messagesPerStory, 25, accuracy: 2)
        } else {
            XCTFail("Expected messagesPerStory")
        }
        XCTAssertEqual(report.humanReview.pendingReviewCount, draftOutput.journalEntryIDs.count)
        XCTAssertEqual(report.humanReview.resyncEventCount, 0)

        let logRequest = NSFetchRequest<TransformationLogEntity>(entityName: "TransformationLogEntity")
        let logs = try context.fetch(logRequest)
        XCTAssertGreaterThanOrEqual(logs.count, stories.count * 4)

        let repo = EntityRepository(context: context)
        XCTAssertTrue(try repo.allEntitiesHaveUserHeldSourceClass())

        let review = HumanReviewService(persistence: persistence)
        for entryID in draftOutput.journalEntryIDs.prefix(3) {
            try review.applyDecision(
                journalEntryID: entryID,
                action: .approve,
                editedTitle: nil,
                editedBodyMarkdown: nil
            )
        }

        let archived = try repo.fetchJournalEntries(status: .archived)
        XCTAssertEqual(archived.count, 3)
        for entry in archived {
            let decisions = try repo.fetchHumanDecisions(journalEntryID: entry.provenanceID)
            XCTAssertFalse(decisions.isEmpty)
        }

        let export = ExportService(persistence: persistence)
        let roundTrip = try export.roundTrip(entryID: archived[0].provenanceID)
        XCTAssertEqual(roundTrip.provenanceID, archived[0].provenanceID)
        XCTAssertEqual(roundTrip.sourceClass, SourceClass.userHeld.rawValue)
        XCTAssertEqual(roundTrip.contentFingerprint, archived[0].contentFingerprint)

        let refreshedReport = try CoherenceReportService(persistence: persistence).generate(mboxImportID: importOutput.importEntityID)
        XCTAssertEqual(refreshedReport.humanReview.resyncEventCount, 3)
        XCTAssertEqual(refreshedReport.humanReview.archivedCount, 3)
        XCTAssertEqual(refreshedReport.humanReview.recoveryRate, 1)
        XCTAssertEqual(refreshedReport.humanReview.pendingReviewCount, draftOutput.journalEntryIDs.count - 3)

        let coherenceService = CoherenceReportService(persistence: persistence)
        let reportJSON = try coherenceService.exportJSON(report: refreshedReport)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decodedReport = try decoder.decode(CoherenceReport.self, from: reportJSON)
        XCTAssertEqual(decodedReport.mboxImportID, importOutput.importEntityID)

        let reportMarkdown = coherenceService.exportMarkdown(report: refreshedReport)
        XCTAssertTrue(reportMarkdown.contains("H0: Attention volatility prevents completion."))
        XCTAssertTrue(reportMarkdown.contains("H1: Attention volatility can be compensated"))
        XCTAssertTrue(reportMarkdown.contains("Input messages: 500"))
    }
}
