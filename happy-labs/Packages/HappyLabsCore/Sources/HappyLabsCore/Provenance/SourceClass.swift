import CryptoKit
import Foundation

public enum SourceClass: String, Codable, CaseIterable, Sendable {
    case userHeld
    case thirdParty
    case publicSource = "public"

    public var displayName: String {
        switch self {
        case .userHeld: return "User-held"
        case .thirdParty: return "Third-party"
        case .publicSource: return "Public"
        }
    }
}

public struct CodecPathEntry: Codable, Equatable, Sendable {
    public let codecName: String
    public let codecVersion: String
    public let inputHash: String
    public let outputHash: String
    public let timestamp: Date

    public init(codecName: String, codecVersion: String, inputHash: String, outputHash: String, timestamp: Date = Date()) {
        self.codecName = codecName
        self.codecVersion = codecVersion
        self.inputHash = inputHash
        self.outputHash = outputHash
        self.timestamp = timestamp
    }
}

public struct ProvenanceFields: Sendable {
    public let provenanceID: UUID
    public let originRef: UUID
    public let sourceClass: SourceClass
    public let codecPath: [CodecPathEntry]
    public let contentFingerprint: String

    public init(
        provenanceID: UUID = UUID(),
        originRef: UUID,
        sourceClass: SourceClass,
        codecPath: [CodecPathEntry] = [],
        contentFingerprint: String
    ) {
        self.provenanceID = provenanceID
        self.originRef = originRef
        self.sourceClass = sourceClass
        self.codecPath = codecPath
        self.contentFingerprint = contentFingerprint
    }

    public func child(
        sourceClass: SourceClass? = nil,
        appendCodec: CodecPathEntry? = nil,
        contentFingerprint: String
    ) -> ProvenanceFields {
        var path = codecPath
        if let appendCodec {
            path.append(appendCodec)
        }
        return ProvenanceFields(
            provenanceID: UUID(),
            originRef: provenanceID,
            sourceClass: sourceClass ?? self.sourceClass,
            codecPath: path,
            contentFingerprint: contentFingerprint
        )
    }
}

public enum ContentFingerprint {
    public static func hash(_ parts: String...) -> String {
        let joined = parts.joined(separator: "\u{1f}")
        return sha256Hex(Data(joined.utf8))
    }

    public static func hashJSON<T: Encodable>(_ value: T) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(value)
        return sha256Hex(data)
    }

    private static func sha256Hex(_ data: Data) -> String {
        SHA256.hash(data: data).compactMap { String(format: "%02x", $0) }.joined()
    }
}
