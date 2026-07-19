import Foundation

public enum MorningstarProtocol {
    public static let version = "0.2"
    public static let schemaVersion = "0.2"
    public static let genesisHash = String(repeating: "0", count: 64)
}

public struct MorningstarCaptureInput: Equatable, Sendable {
    public let observation: String
    public let phenomenology: String
    public let action: String
    public let recordedAt: String?
    public let source: String?
    public let recallLatency: String?
    public let statedContext: [String: String]

    public init(
        observation: String,
        phenomenology: String,
        action: String,
        recordedAt: String? = nil,
        source: String? = nil,
        recallLatency: String? = nil,
        statedContext: [String: String] = [:]
    ) {
        self.observation = observation
        self.phenomenology = phenomenology
        self.action = action
        self.recordedAt = recordedAt
        self.source = source
        self.recallLatency = recallLatency
        self.statedContext = statedContext
    }
}

public struct MorningstarCapture: Identifiable, Equatable, Sendable {
    public let id: UUID
    public let sequenceNumber: Int
    public let createdAt: String
    public let recordedAt: String?
    public let timezone: String
    public let observation: String
    public let phenomenology: String
    public let action: String
    public let source: String?
    public let recallLatency: String?
    public let protocolVersion: String
    public let schemaVersion: String
    public let context: MorningstarJSON
    public let previousHash: String
    public let committedAt: String
    public let integrityHash: String
}

public struct MorningstarAnnotation: Identifiable, Equatable, Sendable {
    public enum Kind: String, CaseIterable, Sendable {
        case note
        case correction
        case context
    }

    public let id: UUID
    public let captureID: UUID
    public let createdAt: String
    public let kind: Kind
    public let body: String
    public let integrityHash: String
}

public struct MorningstarJournalAttachment: Identifiable, Equatable, Sendable {
    public let id: UUID
    public let captureID: UUID
    public let journalEntryID: UUID
    public let attachedAt: String
    public let integrityHash: String
}

public struct MorningstarCaptureVerification: Equatable, Sendable {
    public let captureID: UUID
    public let verified: Bool
    public let messages: [String]
}

public struct MorningstarVerificationReport: Equatable, Sendable {
    public let verified: Bool
    public let captureCount: Int
    public let eventCount: Int
    public let captures: [MorningstarCaptureVerification]
    public let errors: [String]
}

public struct MorningstarLeakageWarning: Identifiable, Equatable, Sendable {
    public let id: String
    public let channel: String
    public let phrase: String
    public let explanation: String
}

public enum MorningstarLeakageChecker {
    public static func check(_ input: MorningstarCaptureInput) -> [MorningstarLeakageWarning] {
        var warnings: [MorningstarLeakageWarning] = []
        warnings += check(channel: "Observation", text: input.observation)
        warnings += check(channel: "Action", text: input.action)
        return warnings
    }

    private static func check(channel: String, text: String) -> [MorningstarLeakageWarning] {
        let rules: [(String, String, String)] = [
            ("because", "because", "Causal explanation is an interpretation; consider recording only what was observable here."),
            ("motive", "wanted to", "A claim about motive may belong in a later interpretation."),
            ("motive", "trying to", "A claim about motive may belong in a later interpretation."),
            ("prediction", "will probably", "A prediction is not yet observed evidence."),
            ("should", "should", "A judgment about what ought to happen is separate from what happened.")
        ]
        let lowered = text.lowercased()
        return rules.compactMap { rule, phrase, explanation in
            guard lowered.contains(phrase) else { return nil }
            return MorningstarLeakageWarning(
                id: "\(channel)-\(rule)-\(phrase)",
                channel: channel,
                phrase: phrase,
                explanation: explanation
            )
        }
    }
}

extension MorningstarCapture {
    var canonicalContent: MorningstarJSON {
        .object([
            "id": .string(id.uuidString.lowercased()),
            "sequence_number": .int(Int64(sequenceNumber)),
            "created_at": .string(createdAt),
            "recorded_at": recordedAt.map(MorningstarJSON.string) ?? .null,
            "timezone": .string(timezone),
            "observation": .string(observation),
            "phenomenology": .string(phenomenology),
            "action": .string(action),
            "source": source.map(MorningstarJSON.string) ?? .null,
            "recall_latency": recallLatency.map(MorningstarJSON.string) ?? .null,
            "protocol_version": .string(protocolVersion),
            "schema_version": .string(schemaVersion),
            "context_snapshot": context,
            "previous_hash": .string(previousHash),
            "committed_at": .string(committedAt)
        ])
    }
}
