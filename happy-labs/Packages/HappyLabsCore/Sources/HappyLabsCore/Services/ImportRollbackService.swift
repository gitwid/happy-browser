import CoreData
import Foundation

public struct ImportRollbackService: Sendable {
    public let persistence: PersistenceController

    public init(persistence: PersistenceController = .shared) {
        self.persistence = persistence
    }

    /// Removes one mbox import and every entity produced from it (partial pipeline rollback).
    public func rollback(mboxImportID: UUID) throws {
        let context = persistence.newBackgroundContext()
        try context.performAndWait {
            let repo = EntityRepository(context: context)

            let rawEmails = try repo.fetchRawEmails(mboxImportID: mboxImportID)
            let rawEmailIDs = Set(rawEmails.map(\.provenanceID))

            let threads = try repo.fetchEmailThreads().filter { thread in
                thread.rawEmailIDs.contains { rawEmailIDs.contains($0) }
            }
            let threadIDs = Set(threads.map(\.provenanceID))

            let storyRequest = NSFetchRequest<StoryCandidateEntity>(entityName: "StoryCandidateEntity")
            storyRequest.predicate = NSPredicate(format: "emailThreadID IN %@", Array(threadIDs))
            let stories = try context.fetch(storyRequest)
            let storyIDs = Set(stories.map(\.provenanceID))

            let journalRequest = NSFetchRequest<JournalEntryEntity>(entityName: "JournalEntryEntity")
            journalRequest.predicate = NSPredicate(format: "storyCandidateID IN %@", Array(storyIDs))
            let journalEntries = try context.fetch(journalRequest)
            let journalEntryIDs = Set(journalEntries.map(\.provenanceID))

            let trackedIDs = rawEmailIDs
                .union(threadIDs)
                .union(storyIDs)
                .union(journalEntryIDs)
                .union([mboxImportID])

            if !journalEntryIDs.isEmpty {
                let decisionRequest = NSFetchRequest<HumanDecisionEntity>(entityName: "HumanDecisionEntity")
                decisionRequest.predicate = NSPredicate(format: "journalEntryID IN %@", Array(journalEntryIDs))
                try context.fetch(decisionRequest).forEach(context.delete)

                let discardRequest = NSFetchRequest<DiscardedArtifactEntity>(entityName: "DiscardedArtifactEntity")
                discardRequest.predicate = NSPredicate(format: "journalEntryID IN %@", Array(journalEntryIDs))
                try context.fetch(discardRequest).forEach(context.delete)
            }

            journalEntries.forEach(context.delete)
            stories.forEach(context.delete)
            threads.forEach(context.delete)
            rawEmails.forEach(context.delete)

            let logs = try repo.fetchTransformationLogs().filter { log in
                logTouchesEntitySet(log, entityIDs: trackedIDs)
            }
            logs.forEach(context.delete)

            if let importEntity = try repo.fetchMboxImport(id: mboxImportID) {
                context.delete(importEntity)
            }

            try persistence.save(context)
        }
        persistence.container.viewContext.reset()
    }

    private func logTouchesEntitySet(_ log: TransformationLogEntity, entityIDs: Set<UUID>) -> Bool {
        log.inputEntityIDs.contains { entityIDs.contains($0) }
            || log.outputEntityIDs.contains { entityIDs.contains($0) }
    }
}

enum ImportCancellation {
    static func throwIfCancelled() throws {
        try Task.checkCancellation()
    }
}
