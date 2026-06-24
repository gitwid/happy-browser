import CoreData
import Foundation
import HappyLabsCore
import SwiftUI

struct ConnectomeGraph {
    struct Origin: Identifiable {
        let id: UUID
        let fileName: String
        let position: CGPoint
    }

    struct Node: Identifiable {
        let id: UUID
        let title: String
        let threadPosition: CGPoint
        let entryPosition: CGPoint
        let messageCount: Int
        let status: JournalEntryStatus
        let originID: UUID
    }

    let origins: [Origin]
    let nodes: [Node]
    let totalEntryCount: Int
    let displayedEntryCount: Int
    let totalArchivedCount: Int
    let totalReviewCount: Int

    var originCaption: String {
        if origins.count == 1 {
            return origins[0].fileName
        }
        return "\(origins.count) mailboxes"
    }

    func originPosition(for id: UUID) -> CGPoint? {
        origins.first(where: { $0.id == id })?.position
    }

    var countLine: String {
        if displayedEntryCount < totalEntryCount {
            return "\(totalEntryCount) ENTRIES · SHOWING \(displayedEntryCount) · \(totalArchivedCount) ARCHIVED · \(totalReviewCount) IN REVIEW"
        }
        return "\(totalEntryCount) ENTRIES · \(totalArchivedCount) ARCHIVED · \(totalReviewCount) IN REVIEW"
    }
}

enum ConnectomeGraphBuilder {
    static let layoutSize = CGSize(width: 360, height: 344)
    static let maxDisplayedNodes = 80

    static func build(context: NSManagedObjectContext) -> ConnectomeGraph? {
        let repo = EntityRepository(context: context)
        guard let entries = try? repo.fetchJournalEntries(), !entries.isEmpty else {
            return nil
        }

        let storyIDs = entries.map(\.storyCandidateID)
        let stories = fetchStoryCandidates(ids: storyIDs, context: context)
        let storyByID = Dictionary(uniqueKeysWithValues: stories.map { ($0.provenanceID, $0) })
        let threadIDs = stories.map(\.emailThreadID)
        let threads = fetchThreads(ids: threadIDs, context: context)
        let threadByID = Dictionary(uniqueKeysWithValues: threads.map { ($0.provenanceID, $0) })

        let entryOriginIDs = originIDs(
            for: entries,
            storyByID: storyByID,
            threadByID: threadByID,
            context: context
        )
        let origins = layoutOrigins(from: entryOriginIDs, context: context)

        let sorted = entries.sorted { lhs, rhs in
            sortKey(for: lhs, storyByID: storyByID, threadByID: threadByID) >
                sortKey(for: rhs, storyByID: storyByID, threadByID: threadByID)
        }

        let displayed = Array(sorted.prefix(maxDisplayedNodes))
        let center = CGPoint(x: layoutSize.width / 2, y: layoutSize.height * 0.46)
        let count = displayed.count

        let nodes: [ConnectomeGraph.Node] = displayed.enumerated().map { index, entry in
            let angle = (Double(index) / Double(max(count, 1))) * 2 * .pi - .pi / 2
            let threadPoint = CGPoint(
                x: center.x + CGFloat(cos(angle)) * 112,
                y: center.y + CGFloat(sin(angle)) * 88
            )
            let entryPoint = CGPoint(
                x: threadPoint.x + CGFloat(cos(angle)) * 20,
                y: threadPoint.y + CGFloat(sin(angle)) * 16
            )
            let thread = storyByID[entry.storyCandidateID].flatMap { threadByID[$0.emailThreadID] }
            let title = entry.title.trimmingCharacters(in: .whitespacesAndNewlines)
            let shortTitle = title.count > 42 ? String(title.prefix(39)) + "…" : title
            let originID = entryOriginIDs[entry.provenanceID] ?? origins.first?.id ?? UUID()
            return ConnectomeGraph.Node(
                id: entry.provenanceID,
                title: shortTitle,
                threadPosition: threadPoint,
                entryPosition: entryPoint,
                messageCount: thread?.rawEmailIDs.count ?? 1,
                status: entry.entryStatus,
                originID: originID
            )
        }

        let totalArchived = entries.filter { $0.entryStatus == .archived }.count
        let totalReview = entries.filter { $0.entryStatus == .draft || $0.entryStatus == .retained }.count

        return ConnectomeGraph(
            origins: origins,
            nodes: nodes,
            totalEntryCount: entries.count,
            displayedEntryCount: displayed.count,
            totalArchivedCount: totalArchived,
            totalReviewCount: totalReview
        )
    }

    private static func layoutOrigins(
        from entryOriginIDs: [UUID: UUID],
        context: NSManagedObjectContext
    ) -> [ConnectomeGraph.Origin] {
        let uniqueIDs = Array(Set(entryOriginIDs.values)).sorted { $0.uuidString < $1.uuidString }
        let originY = layoutSize.height - 54
        if uniqueIDs.isEmpty {
            return [
                ConnectomeGraph.Origin(
                    id: UUID(),
                    fileName: "imported mailbox",
                    position: CGPoint(x: layoutSize.width / 2, y: originY)
                )
            ]
        }

        return uniqueIDs.enumerated().map { index, importID in
            let x = layoutSize.width * CGFloat(index + 1) / CGFloat(uniqueIDs.count + 1)
            let fileName = fetchMboxImport(id: importID, context: context)?.fileDisplayName ?? "imported mailbox"
            return ConnectomeGraph.Origin(
                id: importID,
                fileName: fileName,
                position: CGPoint(x: x, y: originY)
            )
        }
    }

    private static func originIDs(
        for entries: [JournalEntryEntity],
        storyByID: [UUID: StoryCandidateEntity],
        threadByID: [UUID: EmailThreadEntity],
        context: NSManagedObjectContext
    ) -> [UUID: UUID] {
        var map: [UUID: UUID] = [:]
        for entry in entries {
            guard let story = storyByID[entry.storyCandidateID],
                  let thread = threadByID[story.emailThreadID],
                  let emailID = thread.rawEmailIDs.first,
                  let email = fetchRawEmail(id: emailID, context: context) else {
                continue
            }
            map[entry.provenanceID] = email.mboxImportID
        }
        return map
    }

    private static func sortKey(
        for entry: JournalEntryEntity,
        storyByID: [UUID: StoryCandidateEntity],
        threadByID: [UUID: EmailThreadEntity]
    ) -> Date {
        if let story = storyByID[entry.storyCandidateID],
           let thread = threadByID[story.emailThreadID],
           let latest = thread.latestDate {
            return latest
        }
        return entry.archivedAt ?? .distantPast
    }

    private static func fetchStoryCandidates(ids: [UUID], context: NSManagedObjectContext) -> [StoryCandidateEntity] {
        guard !ids.isEmpty else { return [] }
        let request = NSFetchRequest<StoryCandidateEntity>(entityName: "StoryCandidateEntity")
        request.predicate = NSPredicate(format: "provenanceID IN %@", ids)
        return (try? context.fetch(request)) ?? []
    }

    private static func fetchThreads(ids: [UUID], context: NSManagedObjectContext) -> [EmailThreadEntity] {
        guard !ids.isEmpty else { return [] }
        let request = NSFetchRequest<EmailThreadEntity>(entityName: "EmailThreadEntity")
        request.predicate = NSPredicate(format: "provenanceID IN %@", ids)
        return (try? context.fetch(request)) ?? []
    }

    private static func fetchRawEmail(id: UUID, context: NSManagedObjectContext) -> RawEmailEntity? {
        let request = NSFetchRequest<RawEmailEntity>(entityName: "RawEmailEntity")
        request.predicate = NSPredicate(format: "provenanceID == %@", id as CVarArg)
        request.fetchLimit = 1
        return try? context.fetch(request).first
    }

    private static func fetchMboxImport(id: UUID, context: NSManagedObjectContext) -> MboxImportEntity? {
        let request = NSFetchRequest<MboxImportEntity>(entityName: "MboxImportEntity")
        request.predicate = NSPredicate(format: "provenanceID == %@", id as CVarArg)
        request.fetchLimit = 1
        return try? context.fetch(request).first
    }
}
