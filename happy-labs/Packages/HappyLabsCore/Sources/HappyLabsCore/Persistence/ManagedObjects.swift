import CoreData
import Foundation

public protocol ProvenancePersistable: AnyObject {
    var provenanceID: UUID { get set }
    var originRef: UUID { get set }
    var sourceClassRaw: String { get set }
    var codecPathJSON: String { get set }
    var contentFingerprint: String { get set }
}

public extension ProvenancePersistable {
    var sourceClass: SourceClass {
        get { SourceClass(rawValue: sourceClassRaw) ?? .userHeld }
        set { sourceClassRaw = newValue.rawValue }
    }

    var codecPath: [CodecPathEntry] {
        get {
            guard let data = codecPathJSON.data(using: .utf8),
                  let entries = try? JSONDecoder().decode([CodecPathEntry].self, from: data) else {
                return []
            }
            return entries
        }
        set {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            if let data = try? encoder.encode(newValue),
               let string = String(data: data, encoding: .utf8) {
                codecPathJSON = string
            } else {
                codecPathJSON = "[]"
            }
        }
    }

    func apply(_ provenance: ProvenanceFields) {
        provenanceID = provenance.provenanceID
        originRef = provenance.originRef
        sourceClass = provenance.sourceClass
        codecPath = provenance.codecPath
        contentFingerprint = provenance.contentFingerprint
    }
}

@objc(MboxImportEntity)
public final class MboxImportEntity: NSManagedObject, ProvenancePersistable {
    @NSManaged public var provenanceID: UUID
    @NSManaged public var originRef: UUID
    @NSManaged public var sourceClassRaw: String
    @NSManaged public var codecPathJSON: String
    @NSManaged public var contentFingerprint: String
    @NSManaged public var importedAt: Date
    @NSManaged public var fileBookmarkData: Data?
    @NSManaged public var fileDisplayName: String
    @NSManaged public var messageCount: Int32
}

@objc(RawEmailEntity)
public final class RawEmailEntity: NSManagedObject, ProvenancePersistable {
    @NSManaged public var provenanceID: UUID
    @NSManaged public var originRef: UUID
    @NSManaged public var sourceClassRaw: String
    @NSManaged public var codecPathJSON: String
    @NSManaged public var contentFingerprint: String
    @NSManaged public var messageID: String
    @NSManaged public var inReplyTo: String?
    @NSManaged public var referencesHeader: String?
    @NSManaged public var subject: String
    @NSManaged public var fromAddress: String
    @NSManaged public var toAddresses: String
    @NSManaged public var dateSent: Date?
    @NSManaged public var bodyPlain: String
    @NSManaged public var bodyHTML: String?
    @NSManaged public var mboxImportID: UUID
}

@objc(EmailThreadEntity)
public final class EmailThreadEntity: NSManagedObject, ProvenancePersistable {
    @NSManaged public var provenanceID: UUID
    @NSManaged public var originRef: UUID
    @NSManaged public var sourceClassRaw: String
    @NSManaged public var codecPathJSON: String
    @NSManaged public var contentFingerprint: String
    @NSManaged public var normalizedSubject: String
    @NSManaged public var participantSummary: String
    @NSManaged public var earliestDate: Date?
    @NSManaged public var latestDate: Date?
    @NSManaged public var rawEmailIDsJSON: String
    @NSManaged public var isOrphan: Bool
}

@objc(StoryCandidateEntity)
public final class StoryCandidateEntity: NSManagedObject, ProvenancePersistable {
    @NSManaged public var provenanceID: UUID
    @NSManaged public var originRef: UUID
    @NSManaged public var sourceClassRaw: String
    @NSManaged public var codecPathJSON: String
    @NSManaged public var contentFingerprint: String
    @NSManaged public var title: String
    @NSManaged public var summary: String
    @NSManaged public var keyQuotesJSON: String
    @NSManaged public var emailThreadID: UUID
    @NSManaged public var modelUsed: String
}

@objc(JournalEntryEntity)
public final class JournalEntryEntity: NSManagedObject, ProvenancePersistable {
    @NSManaged public var provenanceID: UUID
    @NSManaged public var originRef: UUID
    @NSManaged public var sourceClassRaw: String
    @NSManaged public var codecPathJSON: String
    @NSManaged public var contentFingerprint: String
    @NSManaged public var title: String
    @NSManaged public var bodyMarkdown: String
    @NSManaged public var tagsJSON: String
    @NSManaged public var status: String
    @NSManaged public var storyCandidateID: UUID
    @NSManaged public var archivedAt: Date?
    @NSManaged public var attachedSources: Set<ContinuitySource>

    public var entryStatus: JournalEntryStatus {
        get { JournalEntryStatus(rawValue: status) ?? .draft }
        set { status = newValue.rawValue }
    }
}

@objc(ContinuitySource)
public final class ContinuitySource: NSManagedObject, ProvenancePersistable {
    @NSManaged public var provenanceID: UUID
    @NSManaged public var originRef: UUID
    @NSManaged public var sourceClassRaw: String
    @NSManaged public var codecPathJSON: String
    @NSManaged public var contentFingerprint: String
    @NSManaged public var kindRaw: String
    @NSManaged public var title: String
    @NSManaged public var bodyText: String
    @NSManaged public var sourceURL: String?
    @NSManaged public var capturedAt: Date
    @NSManaged public var metadataJSON: String
    @NSManaged public var stateRaw: String
    @NSManaged public var attachedEntries: Set<JournalEntryEntity>

    public var kind: ContinuitySourceKind {
        get { ContinuitySourceKind(rawValue: kindRaw) ?? .browserContext }
        set { kindRaw = newValue.rawValue }
    }

    public var state: ContinuitySourceState {
        get { ContinuitySourceState(rawValue: stateRaw) ?? .captured }
        set { stateRaw = newValue.rawValue }
    }
}

@objc(TransformationLogEntity)
public final class TransformationLogEntity: NSManagedObject, ProvenancePersistable {
    @NSManaged public var provenanceID: UUID
    @NSManaged public var originRef: UUID
    @NSManaged public var sourceClassRaw: String
    @NSManaged public var codecPathJSON: String
    @NSManaged public var contentFingerprint: String
    @NSManaged public var codecName: String
    @NSManaged public var codecVersion: String
    @NSManaged public var inputEntityIDsJSON: String
    @NSManaged public var outputEntityIDsJSON: String
    @NSManaged public var inputHash: String
    @NSManaged public var outputHash: String
    @NSManaged public var durationMs: Double
    @NSManaged public var modelUsed: String?
    @NSManaged public var loggedAt: Date
}

@objc(HumanDecisionEntity)
public final class HumanDecisionEntity: NSManagedObject, ProvenancePersistable {
    @NSManaged public var provenanceID: UUID
    @NSManaged public var originRef: UUID
    @NSManaged public var sourceClassRaw: String
    @NSManaged public var codecPathJSON: String
    @NSManaged public var contentFingerprint: String
    @NSManaged public var journalEntryID: UUID
    @NSManaged public var action: String
    @NSManaged public var editedTitle: String?
    @NSManaged public var editedBodyMarkdown: String?
    @NSManaged public var decidedAt: Date

    public var decisionAction: HumanDecisionAction {
        get { HumanDecisionAction(rawValue: action) ?? .retain }
        set { action = newValue.rawValue }
    }
}

@objc(DiscardedArtifactEntity)
public final class DiscardedArtifactEntity: NSManagedObject, ProvenancePersistable {
    @NSManaged public var provenanceID: UUID
    @NSManaged public var originRef: UUID
    @NSManaged public var sourceClassRaw: String
    @NSManaged public var codecPathJSON: String
    @NSManaged public var contentFingerprint: String
    @NSManaged public var journalEntryID: UUID
    @NSManaged public var storyCandidateID: UUID
    @NSManaged public var discardedAt: Date
    @NSManaged public var reason: String?
}

public enum JSONStore {
    public static func encode<T: Encodable>(_ value: T) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        guard let data = try? encoder.encode(value),
              let string = String(data: data, encoding: .utf8) else {
            return "[]"
        }
        return string
    }

    public static func decode<T: Decodable>(_ type: T.Type, from json: String) -> T? {
        guard let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
}

extension EmailThreadEntity {
    public var rawEmailIDs: [UUID] {
        get { JSONStore.decode([UUID].self, from: rawEmailIDsJSON) ?? [] }
        set { rawEmailIDsJSON = JSONStore.encode(newValue) }
    }
}

extension StoryCandidateEntity {
    public var keyQuotes: [String] {
        get { JSONStore.decode([String].self, from: keyQuotesJSON) ?? [] }
        set { keyQuotesJSON = JSONStore.encode(newValue) }
    }
}

extension JournalEntryEntity {
    public var tags: [String] {
        get { JSONStore.decode([String].self, from: tagsJSON) ?? [] }
        set { tagsJSON = JSONStore.encode(newValue) }
    }
}

extension ContinuitySource {
    public var metadata: [String: String] {
        get { JSONStore.decode([String: String].self, from: metadataJSON) ?? [:] }
        set { metadataJSON = JSONStore.encode(newValue) }
    }
}

extension TransformationLogEntity {
    public var inputEntityIDs: [UUID] {
        get { JSONStore.decode([UUID].self, from: inputEntityIDsJSON) ?? [] }
        set { inputEntityIDsJSON = JSONStore.encode(newValue) }
    }

    public var outputEntityIDs: [UUID] {
        get { JSONStore.decode([UUID].self, from: outputEntityIDsJSON) ?? [] }
        set { outputEntityIDsJSON = JSONStore.encode(newValue) }
    }
}
