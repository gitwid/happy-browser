import CoreData
import Foundation

public struct DataResetService: Sendable {
    public let persistence: PersistenceController

    public init(persistence: PersistenceController = .shared) {
        self.persistence = persistence
    }

    /// Removes all Happy Labs data from the local store. For dev resets and rare user "start over".
    public func clearAllData() throws {
        let context = persistence.newBackgroundContext()
        try context.performAndWait {
            let entityNames = [
                "DiscardedArtifactEntity",
                "HumanDecisionEntity",
                "TransformationLogEntity",
                "ContinuitySource",
                "JournalEntryEntity",
                "StoryCandidateEntity",
                "EmailThreadEntity",
                "RawEmailEntity",
                "MboxImportEntity"
            ]

            for name in entityNames {
                let request = NSFetchRequest<NSManagedObject>(entityName: name)
                let objects = try context.fetch(request)
                for object in objects {
                    context.delete(object)
                }
            }

            try persistence.save(context)
        }
        persistence.container.viewContext.reset()
    }
}
