import Foundation
import SQLite3

public enum MorningstarStoreError: Error, LocalizedError {
    case database(String)
    case captureNotFound
    case journalEntryNotFound
    case invalidStoredContext

    public var errorDescription: String? {
        switch self {
        case let .database(message): return "Morningstar store error: \(message)"
        case .captureNotFound: return "Morningstar capture not found."
        case .journalEntryNotFound: return "Journal entry not found."
        case .invalidStoredContext: return "A Morningstar capture contains invalid stored context."
        }
    }
}

/// A single-process, append-only Morningstar evidence store.
///
/// Evidence lives outside Happy Journal's Core Data store. SQLite triggers reject
/// UPDATE and DELETE even if another code path obtains the database connection.
public final class MorningstarStore: @unchecked Sendable {
    private var database: OpaquePointer?
    private let lock = NSRecursiveLock()

    public init(url: URL) throws {
        let databasePath = url.lastPathComponent == ":memory:" ? ":memory:" : url.path
        if databasePath != ":memory:" {
            try FileManager.default.createDirectory(
                at: url.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
        }
        guard sqlite3_open(databasePath, &database) == SQLITE_OK else {
            let message = database.map { String(cString: sqlite3_errmsg($0)) } ?? "could not open database"
            sqlite3_close(database)
            database = nil
            throw MorningstarStoreError.database(message)
        }
        do {
            try execute("PRAGMA foreign_keys = ON")
            try execute("PRAGMA journal_mode = WAL")
            try createSchema()
        } catch {
            sqlite3_close(database)
            database = nil
            throw error
        }
    }

    deinit {
        sqlite3_close(database)
    }

    public static func defaultStoreURL() -> URL {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return support
            .appendingPathComponent("HappyLabs", isDirectory: true)
            .appendingPathComponent("Morningstar.sqlite")
    }

    public static func inMemory() throws -> MorningstarStore {
        try MorningstarStore(url: URL(fileURLWithPath: ":memory:"))
    }

    @discardableResult
    public func commitCapture(
        _ input: MorningstarCaptureInput,
        now: Date = Date(),
        id: UUID = UUID(),
        captureSource: String = "happy-journal-native"
    ) throws -> MorningstarCapture {
        try synchronized {
            let previous = try lastCapture()
            let sequence = (previous?.sequenceNumber ?? 0) + 1
            let timestamp = Self.timestamp(now)
            let timezone = TimeZone.current.identifier
            let context: MorningstarJSON = .object([
                "automatic": .object([
                    "captured_at_utc": .string(timestamp),
                    "timezone": .string(timezone),
                    "utc_offset_minutes": .int(Int64(TimeZone.current.secondsFromGMT(for: now) / 60)),
                    "protocol_version": .string(MorningstarProtocol.version),
                    "schema_version": .string(MorningstarProtocol.schemaVersion),
                    "capture_source": .string(captureSource),
                    "elapsed_since_previous_capture_seconds": .null
                ]),
                "stated": .object(input.statedContext.mapValues(MorningstarJSON.string))
            ])
            var capture = MorningstarCapture(
                id: id,
                sequenceNumber: sequence,
                createdAt: timestamp,
                recordedAt: Self.nonEmpty(input.recordedAt),
                timezone: timezone,
                observation: input.observation,
                phenomenology: input.phenomenology,
                action: input.action,
                source: Self.nonEmpty(input.source),
                recallLatency: Self.nonEmpty(input.recallLatency),
                protocolVersion: MorningstarProtocol.version,
                schemaVersion: MorningstarProtocol.schemaVersion,
                context: context,
                previousHash: previous?.integrityHash ?? MorningstarProtocol.genesisHash,
                committedAt: timestamp,
                integrityHash: ""
            )
            capture = try capture.withIntegrityHash(MorningstarCanonicalJSON.sha256(capture.canonicalContent))

            try transaction {
                let statement = try prepare(
                    """
                    INSERT INTO captures
                    (id, sequence_number, created_at, recorded_at, timezone, observation,
                     phenomenology, action, source, recall_latency, protocol_version,
                     schema_version, context_snapshot, previous_hash, committed_at, integrity_hash)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """
                )
                defer { sqlite3_finalize(statement) }
                try bind([
                    capture.id.uuidString.lowercased(), capture.sequenceNumber, capture.createdAt,
                    capture.recordedAt, capture.timezone, capture.observation,
                    capture.phenomenology, capture.action, capture.source, capture.recallLatency,
                    capture.protocolVersion, capture.schemaVersion,
                    try MorningstarCanonicalJSON.string(capture.context), capture.previousHash,
                    capture.committedAt, capture.integrityHash
                ], to: statement)
                try stepDone(statement)

                var payload = capture.canonicalContent.objectValue
                payload["integrity_hash"] = .string(capture.integrityHash)
                try appendEvent(type: "capture_committed", payload: .object(payload), timestamp: timestamp)
            }
            return capture
        }
    }

    public func captures() throws -> [MorningstarCapture] {
        try synchronized {
            let statement = try prepare("SELECT * FROM captures ORDER BY sequence_number")
            defer { sqlite3_finalize(statement) }
            var result: [MorningstarCapture] = []
            while sqlite3_step(statement) == SQLITE_ROW {
                result.append(try capture(from: statement))
            }
            return result
        }
    }

    public func capture(id: UUID) throws -> MorningstarCapture {
        try synchronized {
            let statement = try prepare("SELECT * FROM captures WHERE id = ? LIMIT 1")
            defer { sqlite3_finalize(statement) }
            try bind([id.uuidString.lowercased()], to: statement)
            guard sqlite3_step(statement) == SQLITE_ROW else { throw MorningstarStoreError.captureNotFound }
            return try capture(from: statement)
        }
    }

    @discardableResult
    public func annotate(
        captureID: UUID,
        kind: MorningstarAnnotation.Kind,
        body: String,
        now: Date = Date(),
        id: UUID = UUID()
    ) throws -> MorningstarAnnotation {
        try synchronized {
            _ = try capture(id: captureID)
            let timestamp = Self.timestamp(now)
            let content: MorningstarJSON = .object([
                "id": .string(id.uuidString.lowercased()),
                "capture_id": .string(captureID.uuidString.lowercased()),
                "created_at": .string(timestamp),
                "type": .string(kind.rawValue),
                "body": .string(body)
            ])
            let hash = try MorningstarCanonicalJSON.sha256(content)
            let annotation = MorningstarAnnotation(
                id: id,
                captureID: captureID,
                createdAt: timestamp,
                kind: kind,
                body: body,
                integrityHash: hash
            )
            try transaction {
                let statement = try prepare(
                    "INSERT INTO annotations (id, capture_id, created_at, type, body, protocol_version, integrity_hash) VALUES (?, ?, ?, ?, ?, ?, ?)"
                )
                defer { sqlite3_finalize(statement) }
                try bind([
                    id.uuidString.lowercased(), captureID.uuidString.lowercased(), timestamp,
                    kind.rawValue, body, MorningstarProtocol.version, hash
                ], to: statement)
                try stepDone(statement)
                var payload = content.objectValue
                payload["integrity_hash"] = .string(hash)
                try appendEvent(
                    type: kind == .correction ? "capture_correction_proposed" : "annotation_added",
                    payload: .object(payload),
                    timestamp: timestamp
                )
            }
            return annotation
        }
    }

    public func annotations(captureID: UUID) throws -> [MorningstarAnnotation] {
        try synchronized {
            let statement = try prepare("SELECT * FROM annotations WHERE capture_id = ? ORDER BY created_at, id")
            defer { sqlite3_finalize(statement) }
            try bind([captureID.uuidString.lowercased()], to: statement)
            var result: [MorningstarAnnotation] = []
            while sqlite3_step(statement) == SQLITE_ROW {
                result.append(MorningstarAnnotation(
                    id: try uuid(statement, "id"),
                    captureID: try uuid(statement, "capture_id"),
                    createdAt: text(statement, "created_at"),
                    kind: MorningstarAnnotation.Kind(rawValue: text(statement, "type")) ?? .note,
                    body: text(statement, "body"),
                    integrityHash: text(statement, "integrity_hash")
                ))
            }
            return result
        }
    }

    @discardableResult
    public func attach(
        captureID: UUID,
        toJournalEntryID journalEntryID: UUID,
        now: Date = Date(),
        id: UUID = UUID()
    ) throws -> MorningstarJournalAttachment {
        try synchronized {
            _ = try capture(id: captureID)
            if let existing = try attachment(captureID: captureID, journalEntryID: journalEntryID) {
                return existing
            }
            let timestamp = Self.timestamp(now)
            let content: MorningstarJSON = .object([
                "id": .string(id.uuidString.lowercased()),
                "capture_id": .string(captureID.uuidString.lowercased()),
                "journal_entry_id": .string(journalEntryID.uuidString.lowercased()),
                "attached_at": .string(timestamp)
            ])
            let hash = try MorningstarCanonicalJSON.sha256(content)
            let attachment = MorningstarJournalAttachment(
                id: id,
                captureID: captureID,
                journalEntryID: journalEntryID,
                attachedAt: timestamp,
                integrityHash: hash
            )
            try transaction {
                let statement = try prepare(
                    "INSERT INTO journal_attachments (id, capture_id, journal_entry_id, attached_at, protocol_version, integrity_hash) VALUES (?, ?, ?, ?, ?, ?)"
                )
                defer { sqlite3_finalize(statement) }
                try bind([
                    id.uuidString.lowercased(), captureID.uuidString.lowercased(),
                    journalEntryID.uuidString.lowercased(), timestamp,
                    MorningstarProtocol.version, hash
                ], to: statement)
                try stepDone(statement)
                var payload = content.objectValue
                payload["integrity_hash"] = .string(hash)
                try appendEvent(type: "capture_attached_to_journal", payload: .object(payload), timestamp: timestamp)
            }
            return attachment
        }
    }

    public func attachments(journalEntryID: UUID) throws -> [MorningstarJournalAttachment] {
        try synchronized {
            let statement = try prepare(
                "SELECT * FROM journal_attachments WHERE journal_entry_id = ? ORDER BY attached_at, id"
            )
            defer { sqlite3_finalize(statement) }
            try bind([journalEntryID.uuidString.lowercased()], to: statement)
            var result: [MorningstarJournalAttachment] = []
            while sqlite3_step(statement) == SQLITE_ROW {
                result.append(try attachment(from: statement))
            }
            return result
        }
    }

    /// Each attachment on a journal entry paired with the capture it addresses.
    ///
    /// Callers that previously reduced attachments to `captureID` for evidence
    /// references take `capture.integrityHash` instead: the reference then names
    /// capture *content*, not a row that must be trusted at read time.
    public func attachedCaptures(journalEntryID: UUID) throws
        -> [(attachment: MorningstarJournalAttachment, capture: MorningstarCapture)] {
        try synchronized {
            try attachments(journalEntryID: journalEntryID).map { attachment in
                (attachment: attachment, capture: try capture(id: attachment.captureID))
            }
        }
    }

    public func verify() throws -> MorningstarVerificationReport {
        try synchronized {
            let allCaptures = try captures()
            var expectedPrevious = MorningstarProtocol.genesisHash
            var captureReports: [MorningstarCaptureVerification] = []
            var errors: [String] = []

            for (index, capture) in allCaptures.enumerated() {
                var messages: [String] = []
                if capture.sequenceNumber != index + 1 {
                    messages.append("sequence is not contiguous")
                }
                if capture.previousHash != expectedPrevious {
                    messages.append("previous capture hash does not match")
                }
                let calculated = try MorningstarCanonicalJSON.sha256(capture.canonicalContent)
                if capture.integrityHash != calculated {
                    messages.append("capture content hash does not match")
                }
                if capture.protocolVersion != MorningstarProtocol.version {
                    messages.append("unsupported protocol \(capture.protocolVersion)")
                }
                expectedPrevious = capture.integrityHash
                captureReports.append(MorningstarCaptureVerification(
                    captureID: capture.id,
                    verified: messages.isEmpty,
                    messages: messages
                ))
                errors += messages.map { "Capture \(capture.sequenceNumber): \($0)" }
            }

            let eventResult = try verifyEvents()
            errors += eventResult.errors
            return MorningstarVerificationReport(
                verified: errors.isEmpty,
                captureCount: allCaptures.count,
                eventCount: eventResult.count,
                captures: captureReports,
                errors: errors
            )
        }
    }

    // MARK: - Schema

    private func createSchema() throws {
        try execute(
            """
            CREATE TABLE IF NOT EXISTS captures (
                id TEXT PRIMARY KEY,
                sequence_number INTEGER NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                recorded_at TEXT,
                timezone TEXT NOT NULL,
                observation TEXT NOT NULL,
                phenomenology TEXT NOT NULL,
                action TEXT NOT NULL,
                source TEXT,
                recall_latency TEXT,
                protocol_version TEXT NOT NULL,
                schema_version TEXT NOT NULL,
                context_snapshot TEXT NOT NULL,
                previous_hash TEXT NOT NULL,
                committed_at TEXT NOT NULL,
                integrity_hash TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS annotations (
                id TEXT PRIMARY KEY,
                capture_id TEXT NOT NULL REFERENCES captures(id),
                created_at TEXT NOT NULL,
                type TEXT NOT NULL,
                body TEXT NOT NULL,
                protocol_version TEXT NOT NULL,
                integrity_hash TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS journal_attachments (
                id TEXT PRIMARY KEY,
                capture_id TEXT NOT NULL REFERENCES captures(id),
                journal_entry_id TEXT NOT NULL,
                attached_at TEXT NOT NULL,
                protocol_version TEXT NOT NULL,
                integrity_hash TEXT NOT NULL,
                UNIQUE(capture_id, journal_entry_id)
            );
            CREATE TABLE IF NOT EXISTS events (
                seq INTEGER PRIMARY KEY,
                id TEXT NOT NULL UNIQUE,
                event_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                payload TEXT NOT NULL,
                protocol_version TEXT NOT NULL,
                schema_version TEXT NOT NULL,
                previous_hash TEXT NOT NULL,
                integrity_hash TEXT NOT NULL
            );
            """
        )
        for table in ["captures", "annotations", "journal_attachments", "events"] {
            try execute(
                """
                CREATE TRIGGER IF NOT EXISTS \(table)_immutable_update
                BEFORE UPDATE ON \(table)
                BEGIN SELECT RAISE(ABORT, '\(table) is append-only'); END;
                CREATE TRIGGER IF NOT EXISTS \(table)_immutable_delete
                BEFORE DELETE ON \(table)
                BEGIN SELECT RAISE(ABORT, '\(table) is append-only'); END;
                """
            )
        }
    }

    // MARK: - Event ledger

    private func appendEvent(type: String, payload: MorningstarJSON, timestamp: String) throws {
        let last = try lastEventHead()
        let sequence = last.sequence + 1
        let id = UUID()
        let content: MorningstarJSON = .object([
            "id": .string(id.uuidString.lowercased()),
            "seq": .int(Int64(sequence)),
            "event_type": .string(type),
            "created_at": .string(timestamp),
            "payload": payload,
            "protocol_version": .string(MorningstarProtocol.version),
            "schema_version": .string(MorningstarProtocol.schemaVersion),
            "previous_hash": .string(last.hash)
        ])
        let hash = try MorningstarCanonicalJSON.sha256(content)
        let statement = try prepare(
            "INSERT INTO events (seq, id, event_type, created_at, payload, protocol_version, schema_version, previous_hash, integrity_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        defer { sqlite3_finalize(statement) }
        try bind([
            sequence, id.uuidString.lowercased(), type, timestamp,
            try MorningstarCanonicalJSON.string(payload), MorningstarProtocol.version,
            MorningstarProtocol.schemaVersion, last.hash, hash
        ], to: statement)
        try stepDone(statement)
    }

    private func lastEventHead() throws -> (sequence: Int, hash: String) {
        let statement = try prepare("SELECT seq, integrity_hash FROM events ORDER BY seq DESC LIMIT 1")
        defer { sqlite3_finalize(statement) }
        guard sqlite3_step(statement) == SQLITE_ROW else {
            return (0, MorningstarProtocol.genesisHash)
        }
        return (Int(sqlite3_column_int64(statement, 0)), String(cString: sqlite3_column_text(statement, 1)))
    }

    private func verifyEvents() throws -> (count: Int, errors: [String]) {
        let statement = try prepare("SELECT * FROM events ORDER BY seq")
        defer { sqlite3_finalize(statement) }
        var expectedSequence = 1
        var expectedPrevious = MorningstarProtocol.genesisHash
        var errors: [String] = []
        var count = 0
        while sqlite3_step(statement) == SQLITE_ROW {
            count += 1
            let sequence = Int(integer(statement, "seq"))
            let previousHash = text(statement, "previous_hash")
            let payloadText = text(statement, "payload")
            let payload = try MorningstarCanonicalJSON.parse(Data(payloadText.utf8))
            let content: MorningstarJSON = .object([
                "id": .string(text(statement, "id")),
                "seq": .int(Int64(sequence)),
                "event_type": .string(text(statement, "event_type")),
                "created_at": .string(text(statement, "created_at")),
                "payload": payload,
                "protocol_version": .string(text(statement, "protocol_version")),
                "schema_version": .string(text(statement, "schema_version")),
                "previous_hash": .string(previousHash)
            ])
            if sequence != expectedSequence { errors.append("Event \(sequence): sequence is not contiguous") }
            if previousHash != expectedPrevious { errors.append("Event \(sequence): previous hash does not match") }
            let calculated = try MorningstarCanonicalJSON.sha256(content)
            let stored = text(statement, "integrity_hash")
            if calculated != stored { errors.append("Event \(sequence): content hash does not match") }
            expectedSequence += 1
            expectedPrevious = stored
        }
        return (count, errors)
    }

    // MARK: - Row decoding

    private func lastCapture() throws -> MorningstarCapture? {
        let statement = try prepare("SELECT * FROM captures ORDER BY sequence_number DESC LIMIT 1")
        defer { sqlite3_finalize(statement) }
        guard sqlite3_step(statement) == SQLITE_ROW else { return nil }
        return try capture(from: statement)
    }

    private func capture(from statement: OpaquePointer) throws -> MorningstarCapture {
        let contextText = text(statement, "context_snapshot")
        let context = try MorningstarCanonicalJSON.parse(Data(contextText.utf8))
        return MorningstarCapture(
            id: try uuid(statement, "id"),
            sequenceNumber: Int(integer(statement, "sequence_number")),
            createdAt: text(statement, "created_at"),
            recordedAt: optionalText(statement, "recorded_at"),
            timezone: text(statement, "timezone"),
            observation: text(statement, "observation"),
            phenomenology: text(statement, "phenomenology"),
            action: text(statement, "action"),
            source: optionalText(statement, "source"),
            recallLatency: optionalText(statement, "recall_latency"),
            protocolVersion: text(statement, "protocol_version"),
            schemaVersion: text(statement, "schema_version"),
            context: context,
            previousHash: text(statement, "previous_hash"),
            committedAt: text(statement, "committed_at"),
            integrityHash: text(statement, "integrity_hash")
        )
    }

    private func attachment(captureID: UUID, journalEntryID: UUID) throws -> MorningstarJournalAttachment? {
        let statement = try prepare(
            "SELECT * FROM journal_attachments WHERE capture_id = ? AND journal_entry_id = ? LIMIT 1"
        )
        defer { sqlite3_finalize(statement) }
        try bind([captureID.uuidString.lowercased(), journalEntryID.uuidString.lowercased()], to: statement)
        guard sqlite3_step(statement) == SQLITE_ROW else { return nil }
        return try attachment(from: statement)
    }

    private func attachment(from statement: OpaquePointer) throws -> MorningstarJournalAttachment {
        MorningstarJournalAttachment(
            id: try uuid(statement, "id"),
            captureID: try uuid(statement, "capture_id"),
            journalEntryID: try uuid(statement, "journal_entry_id"),
            attachedAt: text(statement, "attached_at"),
            integrityHash: text(statement, "integrity_hash")
        )
    }

    // MARK: - SQLite helpers

    private func synchronized<T>(_ work: () throws -> T) throws -> T {
        lock.lock()
        defer { lock.unlock() }
        return try work()
    }

    private func transaction<T>(_ work: () throws -> T) throws -> T {
        try execute("BEGIN IMMEDIATE")
        do {
            let result = try work()
            try execute("COMMIT")
            return result
        } catch {
            try? execute("ROLLBACK")
            throw error
        }
    }

    private func execute(_ sql: String) throws {
        var errorMessage: UnsafeMutablePointer<CChar>?
        guard sqlite3_exec(database, sql, nil, nil, &errorMessage) == SQLITE_OK else {
            let message = errorMessage.map { String(cString: $0) } ?? currentError()
            sqlite3_free(errorMessage)
            throw MorningstarStoreError.database(message)
        }
    }

    private func prepare(_ sql: String) throws -> OpaquePointer {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
            throw MorningstarStoreError.database(currentError())
        }
        return statement
    }

    private func bind(_ values: [Any?], to statement: OpaquePointer) throws {
        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        for (offset, value) in values.enumerated() {
            let index = Int32(offset + 1)
            let code: Int32
            switch value {
            case nil:
                code = sqlite3_bind_null(statement, index)
            case let value as String:
                code = sqlite3_bind_text(statement, index, value, -1, transient)
            case let value as Int:
                code = sqlite3_bind_int64(statement, index, sqlite3_int64(value))
            case let value as Int64:
                code = sqlite3_bind_int64(statement, index, sqlite3_int64(value))
            default:
                throw MorningstarStoreError.database("unsupported SQLite binding")
            }
            guard code == SQLITE_OK else { throw MorningstarStoreError.database(currentError()) }
        }
    }

    private func stepDone(_ statement: OpaquePointer) throws {
        guard sqlite3_step(statement) == SQLITE_DONE else {
            throw MorningstarStoreError.database(currentError())
        }
    }

    private func currentError() -> String {
        database.map { String(cString: sqlite3_errmsg($0)) } ?? "database unavailable"
    }

    private func columnIndex(_ statement: OpaquePointer, _ name: String) -> Int32 {
        for index in 0..<sqlite3_column_count(statement) {
            if String(cString: sqlite3_column_name(statement, index)) == name { return index }
        }
        return -1
    }

    private func text(_ statement: OpaquePointer, _ name: String) -> String {
        let index = columnIndex(statement, name)
        guard index >= 0, let value = sqlite3_column_text(statement, index) else { return "" }
        return String(cString: value)
    }

    private func optionalText(_ statement: OpaquePointer, _ name: String) -> String? {
        let index = columnIndex(statement, name)
        guard index >= 0, sqlite3_column_type(statement, index) != SQLITE_NULL else { return nil }
        return text(statement, name)
    }

    private func integer(_ statement: OpaquePointer, _ name: String) -> Int64 {
        sqlite3_column_int64(statement, columnIndex(statement, name))
    }

    private func uuid(_ statement: OpaquePointer, _ name: String) throws -> UUID {
        guard let value = UUID(uuidString: text(statement, name)) else {
            throw MorningstarStoreError.database("invalid UUID in \(name)")
        }
        return value
    }

    private static func timestamp(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter.string(from: date)
    }

    private static func nonEmpty(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else { return nil }
        return trimmed
    }
}

private extension MorningstarCapture {
    func withIntegrityHash(_ hash: String) -> MorningstarCapture {
        MorningstarCapture(
            id: id,
            sequenceNumber: sequenceNumber,
            createdAt: createdAt,
            recordedAt: recordedAt,
            timezone: timezone,
            observation: observation,
            phenomenology: phenomenology,
            action: action,
            source: source,
            recallLatency: recallLatency,
            protocolVersion: protocolVersion,
            schemaVersion: schemaVersion,
            context: context,
            previousHash: previousHash,
            committedAt: committedAt,
            integrityHash: hash
        )
    }
}

private extension MorningstarJSON {
    var objectValue: [String: MorningstarJSON] {
        if case let .object(value) = self { return value }
        return [:]
    }
}
