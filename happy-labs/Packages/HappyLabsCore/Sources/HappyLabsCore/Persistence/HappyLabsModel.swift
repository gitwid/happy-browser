import CoreData
import Foundation

public enum JournalEntryStatus: String, CaseIterable, Sendable {
    case draft
    case retained
    case archived
    case discarded
}

public enum HumanDecisionAction: String, CaseIterable, Sendable {
    case approve
    case edit
    case retain
    case discard
}

public enum HappyLabsModel {
    public static let modelName = "HappyLabs"

    public static func makeModel() -> NSManagedObjectModel {
        let model = NSManagedObjectModel()

        let mboxImport = makeEntity(
            name: "MboxImportEntity",
            provenance: true,
            extra: [
                attr("importedAt", .dateAttributeType),
                attr("fileBookmarkData", .binaryDataAttributeType, optional: true),
                attr("fileDisplayName", .stringAttributeType),
                attr("messageCount", .integer32AttributeType)
            ]
        )

        let rawEmail = makeEntity(
            name: "RawEmailEntity",
            provenance: true,
            extra: [
                attr("messageID", .stringAttributeType),
                attr("inReplyTo", .stringAttributeType, optional: true),
                attr("referencesHeader", .stringAttributeType, optional: true),
                attr("subject", .stringAttributeType),
                attr("fromAddress", .stringAttributeType),
                attr("toAddresses", .stringAttributeType),
                attr("dateSent", .dateAttributeType, optional: true),
                attr("bodyPlain", .stringAttributeType),
                attr("bodyHTML", .stringAttributeType, optional: true),
                attr("mboxImportID", .UUIDAttributeType)
            ],
            indexes: [("bySourceClass", ["sourceClassRaw"]), ("byMboxImport", ["mboxImportID"])]
        )

        let emailThread = makeEntity(
            name: "EmailThreadEntity",
            provenance: true,
            extra: [
                attr("normalizedSubject", .stringAttributeType),
                attr("participantSummary", .stringAttributeType),
                attr("earliestDate", .dateAttributeType, optional: true),
                attr("latestDate", .dateAttributeType, optional: true),
                attr("rawEmailIDsJSON", .stringAttributeType),
                attr("isOrphan", .booleanAttributeType)
            ]
        )

        let storyCandidate = makeEntity(
            name: "StoryCandidateEntity",
            provenance: true,
            extra: [
                attr("title", .stringAttributeType),
                attr("summary", .stringAttributeType),
                attr("keyQuotesJSON", .stringAttributeType),
                attr("emailThreadID", .UUIDAttributeType),
                attr("modelUsed", .stringAttributeType)
            ]
        )

        let journalEntry = makeEntity(
            name: "JournalEntryEntity",
            provenance: true,
            extra: [
                attr("title", .stringAttributeType),
                attr("bodyMarkdown", .stringAttributeType),
                attr("tagsJSON", .stringAttributeType),
                attr("status", .stringAttributeType),
                attr("storyCandidateID", .UUIDAttributeType),
                attr("archivedAt", .dateAttributeType, optional: true)
            ],
            indexes: [("byStatus", ["status"]), ("bySourceClassJournal", ["sourceClassRaw"])]
        )

        let transformationLog = makeEntity(
            name: "TransformationLogEntity",
            provenance: true,
            extra: [
                attr("codecName", .stringAttributeType),
                attr("codecVersion", .stringAttributeType),
                attr("inputEntityIDsJSON", .stringAttributeType),
                attr("outputEntityIDsJSON", .stringAttributeType),
                attr("inputHash", .stringAttributeType),
                attr("outputHash", .stringAttributeType),
                attr("durationMs", .doubleAttributeType),
                attr("modelUsed", .stringAttributeType, optional: true),
                attr("loggedAt", .dateAttributeType)
            ]
        )

        let humanDecision = makeEntity(
            name: "HumanDecisionEntity",
            provenance: true,
            extra: [
                attr("journalEntryID", .UUIDAttributeType),
                attr("action", .stringAttributeType),
                attr("editedTitle", .stringAttributeType, optional: true),
                attr("editedBodyMarkdown", .stringAttributeType, optional: true),
                attr("decidedAt", .dateAttributeType)
            ]
        )

        let discardedArtifact = makeEntity(
            name: "DiscardedArtifactEntity",
            provenance: true,
            extra: [
                attr("journalEntryID", .UUIDAttributeType),
                attr("storyCandidateID", .UUIDAttributeType),
                attr("discardedAt", .dateAttributeType),
                attr("reason", .stringAttributeType, optional: true)
            ]
        )

        model.entities = [
            mboxImport,
            rawEmail,
            emailThread,
            storyCandidate,
            journalEntry,
            transformationLog,
            humanDecision,
            discardedArtifact
        ]

        return model
    }

    private static func provenanceAttributes() -> [NSAttributeDescription] {
        [
            attr("provenanceID", .UUIDAttributeType),
            attr("originRef", .UUIDAttributeType),
            attr("sourceClassRaw", .stringAttributeType),
            attr("codecPathJSON", .stringAttributeType),
            attr("contentFingerprint", .stringAttributeType)
        ]
    }

    private static func makeEntity(
        name: String,
        provenance: Bool,
        extra: [NSAttributeDescription],
        indexes indexSpecs: [(String, [String])] = [("bySourceClass", ["sourceClassRaw"])]
    ) -> NSEntityDescription {
        let entity = NSEntityDescription()
        entity.name = name
        entity.managedObjectClassName = name
        var properties: [NSAttributeDescription] = []
        if provenance {
            properties.append(contentsOf: provenanceAttributes())
        }
        properties.append(contentsOf: extra)
        entity.properties = properties
        entity.indexes = indexSpecs.map { spec in
            NSFetchIndexDescription(name: spec.0, elements: spec.1.map {
                NSFetchIndexElementDescription(property: entity.propertiesByName[$0]!, collationType: .binary)
            })
        }
        return entity
    }

    private static func attr(
        _ name: String,
        _ type: NSAttributeType,
        optional: Bool = false
    ) -> NSAttributeDescription {
        let attribute = NSAttributeDescription()
        attribute.name = name
        attribute.attributeType = type
        attribute.isOptional = optional
        return attribute
    }
}
