import HappyLabsCore
import SQLite3
import XCTest

final class MorningstarCanonicalJSONTests: XCTestCase {
    /// Byte-exact copies of Morningstar protocol 0.2's RFC 8785 golden vectors.
    func testProtocol02GoldenVectors() throws {
        let vectors: [(MorningstarJSON, String, String)] = [
            (
                .object(["b": .int(2), "a": .int(1), "A": .int(0)]),
                "{\"A\":0,\"a\":1,\"b\":2}",
                "5f05c47104ba1ac24d8cb54dd5f23b15487f4770c9eb767c1c64b64aefba6501"
            ),
            (
                .object(["text": .string("émotions ✓ — fin de partie")]),
                "{\"text\":\"émotions ✓ — fin de partie\"}",
                "82343e68314c0477914a3e25cc654fda4154d740a40e34de31795a7b0f0a285c"
            ),
            (
                .object(["s": .string("\u{0000}\u{001f}\u{007f}\u{0008}\t\n\u{000c}\r\u{001f}\"\\")]),
                "{\"s\":\"\\u0000\\u001f\u{007f}\\b\\t\\n\\f\\r\\u001f\\\"\\\\\"}",
                "eeead41e6b278b3dd73f5459e0feebdb2fc87749509958bae0ac09c553a729b8"
            ),
            (
                .object(["！": .string("bmp"), "😀": .string("non-bmp")]),
                "{\"😀\":\"non-bmp\",\"！\":\"bmp\"}",
                "d6338b701cd6f66bb109440edb0a25114a3cb2c4de4733dfa810fa2551f3de25"
            ),
            (
                .object([
                    "zero": .double(0), "neg_zero": .double(-0.0), "int_like": .double(1),
                    "half": .double(0.5), "rfc_45": .double(4.5), "milli": .double(0.002),
                    "huge": .double(1e21), "edge_int": .double(1e20), "micro": .double(1e-6),
                    "sub_micro": .double(1e-7), "pi": .double(3.141592653589793),
                    "rfc_long": .double(333333333.3333333), "denormal_min": .double(5e-324),
                    "double_max": .double(1.7976931348623157e308), "neg": .double(-42.75),
                    "max_safe_int": .int(9_007_199_254_740_991)
                ]),
                "{\"denormal_min\":5e-324,\"double_max\":1.7976931348623157e+308,\"edge_int\":100000000000000000000,\"half\":0.5,\"huge\":1e+21,\"int_like\":1,\"max_safe_int\":9007199254740991,\"micro\":0.000001,\"milli\":0.002,\"neg\":-42.75,\"neg_zero\":0,\"pi\":3.141592653589793,\"rfc_45\":4.5,\"rfc_long\":333333333.3333333,\"sub_micro\":1e-7,\"zero\":0}",
                "9a342c200c45d37393f79039f1fa08de20ab2bb710cf4517728fc2374d2cb0c9"
            ),
            (
                .object([
                    "arr": .array([.null, .bool(true), .bool(false), .object([:]), .array([])]),
                    "nested": .object(["z": .array([.int(1), .int(2)]), "a": .string("x")])
                ]),
                "{\"arr\":[null,true,false,{},[]],\"nested\":{\"a\":\"x\",\"z\":[1,2]}}",
                "f92bf8c5797d5f4223fada40ba42f922b826aaa70cf54a7769a28c82a2c671d9"
            )
        ]

        for (value, canonical, hash) in vectors {
            XCTAssertEqual(try MorningstarCanonicalJSON.string(value), canonical)
            XCTAssertEqual(try MorningstarCanonicalJSON.sha256(value), hash)
        }
    }
}

final class MorningstarStoreTests: XCTestCase {
    func testCapturePersistsAcrossRestartAndVerifies() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("morningstar-\(UUID().uuidString)", isDirectory: true)
        let url = directory.appendingPathComponent("Morningstar.sqlite")
        defer { try? FileManager.default.removeItem(at: directory) }

        let captureID: UUID
        do {
            let store = try MorningstarStore(url: url)
            let first = try store.commitCapture(
                MorningstarCaptureInput(
                    observation: "08:47 received a message.",
                    phenomenology: "Disappointment.",
                    action: "Closed the conversation.",
                    recordedAt: "this morning",
                    source: "stated by user"
                ),
                now: Date(timeIntervalSince1970: 1_800_000_000)
            )
            let second = try store.commitCapture(
                MorningstarCaptureInput(
                    observation: "The room was quiet.",
                    phenomenology: "Calmer.",
                    action: "Made tea."
                ),
                now: Date(timeIntervalSince1970: 1_800_000_060)
            )
            captureID = first.id
            XCTAssertEqual(first.sequenceNumber, 1)
            XCTAssertEqual(second.sequenceNumber, 2)
            XCTAssertEqual(second.previousHash, first.integrityHash)
        }

        let reopened = try MorningstarStore(url: url)
        XCTAssertEqual(try reopened.capture(id: captureID).observation, "08:47 received a message.")
        let report = try reopened.verify()
        XCTAssertTrue(report.verified, report.errors.joined(separator: "\n"))
        XCTAssertEqual(report.captureCount, 2)
        XCTAssertEqual(report.eventCount, 2)
    }

    func testAttachmentIsExplicitAppendOnlyAndIdempotent() throws {
        let store = try MorningstarStore.inMemory()
        let capture = try store.commitCapture(
            MorningstarCaptureInput(observation: "Observed.", phenomenology: "Felt.", action: "Acted.")
        )
        let journalID = UUID()
        let first = try store.attach(captureID: capture.id, toJournalEntryID: journalID)
        let second = try store.attach(captureID: capture.id, toJournalEntryID: journalID)
        XCTAssertEqual(first, second)
        XCTAssertEqual(try store.attachments(journalEntryID: journalID).count, 1)
        XCTAssertTrue(try store.verify().verified)
    }

    func testSQLiteTriggerRejectsEvidenceMutation() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("morningstar-guard-\(UUID().uuidString)", isDirectory: true)
        let url = directory.appendingPathComponent("Morningstar.sqlite")
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = try MorningstarStore(url: url)
        _ = try store.commitCapture(
            MorningstarCaptureInput(observation: "Original", phenomenology: "", action: "")
        )

        var database: OpaquePointer?
        XCTAssertEqual(sqlite3_open(url.path, &database), SQLITE_OK)
        defer { sqlite3_close(database) }
        XCTAssertNotEqual(
            sqlite3_exec(database, "UPDATE captures SET observation='rewritten'", nil, nil, nil),
            SQLITE_OK
        )
    }

    func testLeakageWarningsNeverBlockCapture() throws {
        let input = MorningstarCaptureInput(
            observation: "They left because they wanted to punish me.",
            phenomenology: "I felt rejected.",
            action: "I should have stayed."
        )
        XCTAssertFalse(MorningstarLeakageChecker.check(input).isEmpty)
        let store = try MorningstarStore.inMemory()
        XCTAssertNoThrow(try store.commitCapture(input))
    }

    /// Mirrors the UI path: New Capture → Review → Commit → Evidence library.
    func testMinimalCaptureReviewCommitAndEvidenceLibrary() throws {
        let input = MorningstarCaptureInput(
            observation: "The kitchen light was on.",
            phenomenology: "I felt unsettled.",
            action: "I turned it off."
        )
        XCTAssertTrue(MorningstarLeakageChecker.check(input).isEmpty)

        let store = try MorningstarStore.inMemory()
        let capture = try store.commitCapture(input)
        let evidence = try store.captures()
        let report = try store.verify()

        XCTAssertEqual(evidence.count, 1)
        XCTAssertEqual(evidence[0].id, capture.id)
        XCTAssertEqual(evidence[0].observation, "The kitchen light was on.")
        XCTAssertEqual(evidence[0].protocolVersion, MorningstarProtocol.version)
        XCTAssertFalse(evidence[0].integrityHash.isEmpty)
        XCTAssertTrue(report.verified, report.errors.joined(separator: "\n"))
        XCTAssertEqual(report.captureCount, 1)
    }

    /// The evidence reference is a content coordinate: it resolves to exactly the
    /// capture whose content produced it, and a reference naming any other content
    /// resolves to nothing. This is the property `evidenceReferences` now carries.
    func testAttachedCapturesYieldContentAddressedReferences() throws {
        let store = try MorningstarStore.inMemory()
        let journalID = UUID()
        let capture = try store.commitCapture(
            MorningstarCaptureInput(observation: "Witnessed.", phenomenology: "Noted.", action: "Recorded.")
        )
        try store.attach(captureID: capture.id, toJournalEntryID: journalID)

        // What HappyLabsApp now folds into a revision's evidenceReferences.
        let pairs = try store.attachedCaptures(journalEntryID: journalID)
        XCTAssertEqual(pairs.count, 1)
        XCTAssertEqual(pairs[0].attachment.captureID, capture.id)
        let references = pairs.map { $0.capture.integrityHash }
        XCTAssertEqual(references, [capture.integrityHash])

        // The hash resolves back to the one capture whose content produced it.
        let resolved = try store.captures().first { $0.integrityHash == references[0] }
        XCTAssertEqual(resolved?.id, capture.id)

        // A coordinate naming altered content — differing by one hex digit — cannot resolve.
        let last = references[0].last!
        let tampered = String(references[0].dropLast()) + (last == "0" ? "1" : "0")
        XCTAssertNotEqual(tampered, references[0])
        XCTAssertNil(
            try store.captures().first { $0.integrityHash == tampered },
            "A reference to content other than what is stored must not resolve."
        )
    }

    /// Mirrors the full vertical slice: Import .mbox → attach → provenance/Connectome inputs.
    func testFullSliceAttachAfterMboxImport() throws {
        let persistence = PersistenceController(inMemory: true)
        let orchestrator = PipelineOrchestrator(
            persistence: persistence,
            summarizationProvider: ExtractiveFallbackProvider()
        )
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("morningstar-slice-\(UUID().uuidString).mbox")
        defer { try? FileManager.default.removeItem(at: tempURL) }

        try """
        From alice@example.com Mon Jun 16 12:00:00 2026
        From: alice@example.com
        To: bob@example.com
        Subject: Morningstar fixture thread
        Message-ID: <morningstar-1@example.com>
        Date: Mon, 16 Jun 2026 12:00:00 +0000

        A short thread so journal drafts exist for attachment.

        From bob@example.com Mon Jun 16 13:00:00 2026
        From: bob@example.com
        To: alice@example.com
        Subject: Re: Morningstar fixture thread
        Message-ID: <morningstar-2@example.com>
        In-Reply-To: <morningstar-1@example.com>
        References: <morningstar-1@example.com>
        Date: Mon, 16 Jun 2026 13:00:00 +0000

        Thanks — noted.

        """.write(to: tempURL, atomically: true, encoding: .utf8)

        let importOutput = try orchestrator.importMbox(at: tempURL)
        let pipelineOutput = try orchestrator.runFullPipeline(mboxImportID: importOutput.importEntityID)
        let journalEntryIDs = pipelineOutput.journalDraft.journalEntryIDs
        XCTAssertFalse(journalEntryIDs.isEmpty, "mbox import should produce journal drafts for attach")

        let journalEntryID = journalEntryIDs[0]
        let store = try MorningstarStore.inMemory()
        let capture = try store.commitCapture(
            MorningstarCaptureInput(
                observation: "Opened the imported journal draft.",
                phenomenology: "Curious.",
                action: "Attached this capture explicitly."
            )
        )
        let attachment = try store.attach(captureID: capture.id, toJournalEntryID: journalEntryID)

        let attachments = try store.attachments(journalEntryID: journalEntryID)
        XCTAssertEqual(attachments.count, 1)
        XCTAssertEqual(attachments[0].id, attachment.id)
        XCTAssertEqual(attachments[0].captureID, capture.id)

        let reloaded = try store.capture(id: capture.id)
        XCTAssertEqual(reloaded.observation, "Opened the imported journal draft.")
        XCTAssertTrue(try store.verify().verified)

        // Connectome witness branches and provenance plates are built from this pair.
        XCTAssertEqual(attachment.journalEntryID, journalEntryID)
    }
}

final class JournalRevisionTests: XCTestCase {
    func testEditingAppendsRevisionsBeforeUpdatingProjection() throws {
        let persistence = PersistenceController(inMemory: true)
        let context = persistence.container.viewContext
        let repo = EntityRepository(context: context)
        let entryID = UUID()
        _ = repo.insertJournalEntry(
            title: "First reading",
            bodyMarkdown: "The original interpretation.",
            tags: [],
            status: .draft,
            storyCandidateID: UUID(),
            provenance: ProvenanceFields(
                provenanceID: entryID,
                originRef: entryID,
                sourceClass: .userHeld,
                contentFingerprint: ContentFingerprint.hash("First reading", "The original interpretation.")
            )
        )
        try persistence.save(context)

        try HumanReviewService(persistence: persistence).applyDecision(
            journalEntryID: entryID,
            action: .edit,
            editedTitle: "Second reading",
            editedBodyMarkdown: "A revised interpretation.",
            evidenceReferences: ["capture-001"]
        )

        context.refreshAllObjects()
        let revisions = try repo.fetchJournalRevisions(journalEntryID: entryID)
        XCTAssertEqual(revisions.map(\.revisionNumber), [1, 2])
        XCTAssertEqual(revisions.map(\.title), ["First reading", "Second reading"])
        XCTAssertEqual(revisions[1].evidenceReferences, ["capture-001"])
        XCTAssertEqual(try repo.fetchJournalEntries().first?.title, "Second reading")

        // The baseline is the entry as it arrived; only the edit is the human's.
        XCTAssertEqual(revisions.map(\.author), [.pipeline, .human])
    }

    func testAgentAuthoredRevisionIsDistinguishableFromHuman() throws {
        let persistence = PersistenceController(inMemory: true)
        let context = persistence.container.viewContext
        let repo = EntityRepository(context: context)
        let entryID = UUID()
        _ = repo.insertJournalEntry(
            title: "First reading",
            bodyMarkdown: "The original interpretation.",
            tags: [],
            status: .draft,
            storyCandidateID: UUID(),
            provenance: ProvenanceFields(
                provenanceID: entryID,
                originRef: entryID,
                sourceClass: .userHeld,
                contentFingerprint: ContentFingerprint.hash("First reading", "The original interpretation.")
            )
        )
        try persistence.save(context)

        try HumanReviewService(persistence: persistence).applyDecision(
            journalEntryID: entryID,
            action: .edit,
            editedTitle: "Instrument reading",
            editedBodyMarkdown: "Drafted by an instrument.",
            evidenceReferences: [],
            author: .agent
        )

        context.refreshAllObjects()
        let revisions = try repo.fetchJournalRevisions(journalEntryID: entryID)
        XCTAssertEqual(revisions.map(\.author), [.pipeline, .agent])

        // The point of the field: divergence can tell a reconsideration from a rewrite.
        XCTAssertNotEqual(revisions[1].author, .human)
    }

    func testAbsentAuthorReadsAsUnattributedRatherThanHuman() throws {
        let persistence = PersistenceController(inMemory: true)
        let context = persistence.container.viewContext
        let repo = EntityRepository(context: context)
        let entryID = UUID()
        let revision = repo.insertJournalRevision(
            journalEntryID: entryID,
            revisionNumber: 1,
            title: "Pre-0.3 revision",
            bodyMarkdown: "Written before authorship was recorded.",
            evidenceReferences: [],
            author: .human,
            provenance: ProvenanceFields(
                originRef: entryID,
                sourceClass: .userHeld,
                contentFingerprint: ContentFingerprint.hash("Pre-0.3 revision", "Written before authorship was recorded.")
            )
        )

        // Simulate a row written before the column existed.
        revision.authorRaw = nil
        try persistence.save(context)
        context.refreshAllObjects()

        let stored = try repo.fetchJournalRevisions(journalEntryID: entryID)
        XCTAssertNil(stored.first?.author, "An unattributed revision must never read as human.")

        // An unrecognised value is also unattributed, not silently coerced.
        stored.first?.authorRaw = "committee"
        XCTAssertNil(stored.first?.author)
    }
}
