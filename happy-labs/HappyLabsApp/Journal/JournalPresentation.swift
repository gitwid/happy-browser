import CoreData
import Foundation
import HappyLabsCore
import SwiftUI

struct JournalEntryRow: Identifiable {
    let id: UUID
    let number: String
    let title: String
    let essence: String
    let dateSpan: String
    let statusLabel: String
    let statusColor: Color
    let status: JournalEntryStatus
}

struct ContextSourceRow: Identifiable {
    let id: UUID
    let title: String
    let sourceURL: String
    let stateLabel: String
    let capturedLine: String
    let shortFingerprint: String
}

struct ContextSourceSummary: Identifiable {
    let id: UUID
    let title: String
    let kind: String
    let state: String
    let sourceURL: String?
    let fingerprint: String
    let shortFingerprint: String
}

struct ProvenanceRung: Identifiable {
    let id = UUID()
    let stage: String
    let phase: String
    let codec: String
    let io: String
    let detail: String
}

struct JournalEntryDetail: Identifiable {
    let id: UUID
    let overline: String
    let title: String
    let byline: String
    let bodyParagraphs: [String]
    let quote: String?
    let fingerprint: String
    let shortFingerprint: String
    let sourceClass: SourceClass
    let status: JournalEntryStatus
    let decisionField: String
    let decisionNote: String
    let isDiscarded: Bool
    let attachedContextSources: [ContextSourceSummary]
    let lineage: [ProvenanceRung]
}

enum JournalPresentationBuilder {
    static func contextRows(from sources: [ContinuitySource]) -> [ContextSourceRow] {
        sources.sorted { $0.capturedAt > $1.capturedAt }.map { source in
            ContextSourceRow(
                id: source.provenanceID,
                title: source.title,
                sourceURL: source.sourceURL ?? "local capture",
                stateLabel: source.state.rawValue.uppercased(),
                capturedLine: capturedLine(for: source.capturedAt),
                shortFingerprint: shortHash(source.contentFingerprint)
            )
        }
    }

    static func rows(from entries: [JournalEntryEntity], context: NSManagedObjectContext) -> [JournalEntryRow] {
        let storyIDs = entries.map(\.storyCandidateID)
        let stories = fetchStoryCandidates(ids: storyIDs, context: context)
        let storyByID = Dictionary(uniqueKeysWithValues: stories.map { ($0.provenanceID, $0) })
        let threadIDs = stories.map(\.emailThreadID)
        let threads = fetchThreads(ids: threadIDs, context: context)
        let threadByID = Dictionary(uniqueKeysWithValues: threads.map { ($0.provenanceID, $0) })

        let sorted = entries.sorted { lhs, rhs in
            sortKey(for: lhs, storyByID: storyByID, threadByID: threadByID) <
                sortKey(for: rhs, storyByID: storyByID, threadByID: threadByID)
        }
        return sorted.enumerated().map { index, entry in
            let meta = statusMeta(entry.entryStatus)
            let story = storyByID[entry.storyCandidateID]
            let thread = story.flatMap { threadByID[$0.emailThreadID] }
            return JournalEntryRow(
                id: entry.provenanceID,
                number: String(format: "%02d", index + 1),
                title: entry.title,
                essence: essence(from: story, entry: entry),
                dateSpan: dateSpan(for: thread),
                statusLabel: meta.label,
                statusColor: meta.color,
                status: entry.entryStatus
            )
        }
    }

    static func detail(for entry: JournalEntryEntity, context: NSManagedObjectContext) -> JournalEntryDetail {
        let story = fetchStoryCandidate(id: entry.storyCandidateID, context: context)
        let thread = story.flatMap { fetchThread(id: $0.emailThreadID, context: context) }
        let mbox = thread.flatMap { fetchMboxImport(for: $0, context: context) }
        let parsed = parseMarkdown(entry.bodyMarkdown)
        let decision = latestDecision(for: entry.provenanceID, context: context)
        let status = entry.entryStatus
        let copy = decisionCopy(status: status, decision: decision)

        return JournalEntryDetail(
            id: entry.provenanceID,
            overline: overline(thread: thread, entry: entry),
            title: entry.title,
            byline: byline(for: thread),
            bodyParagraphs: parsed.paragraphs,
            quote: parsed.quote ?? story?.keyQuotes.first,
            fingerprint: entry.contentFingerprint,
            shortFingerprint: shortHash(entry.contentFingerprint),
            sourceClass: entry.sourceClass,
            status: status,
            decisionField: copy.field,
            decisionNote: copy.note,
            isDiscarded: status == .discarded,
            attachedContextSources: attachedContextSummaries(for: entry),
            lineage: lineage(
                entry: entry,
                story: story,
                thread: thread,
                mbox: mbox,
                context: context
            )
        )
    }

    static func countLine(entries: [JournalEntryRow]) -> String {
        let archived = entries.filter { $0.status == .archived }.count
        let review = entries.filter { $0.status == .draft || $0.status == .retained }.count
        return "\(entries.count) ENTRIES · \(archived) ARCHIVED · \(review) IN REVIEW"
    }

    static func contextCountLine(rows: [ContextSourceRow]) -> String {
        "\(rows.count) CAPTURED · PRE-ARCHIVAL"
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

    private static func essence(from story: StoryCandidateEntity?, entry: JournalEntryEntity) -> String {
        if let summary = story?.summary.trimmingCharacters(in: .whitespacesAndNewlines), !summary.isEmpty {
            let sentence = summary.split(separator: ".").first.map(String.init) ?? summary
            return sentence.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        let first = parseMarkdown(entry.bodyMarkdown).paragraphs.first ?? entry.title
        return String(first.prefix(120))
    }

    private static func dateSpan(for thread: EmailThreadEntity?) -> String {
        guard let thread else { return "—" }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM ''yy"
        if let start = thread.earliestDate, let end = thread.latestDate {
            let startText = formatter.string(from: start)
            let endText = formatter.string(from: end)
            if startText == endText { return startText }
            return "\(startText)–\(endText)"
        }
        if let end = thread.latestDate {
            return formatter.string(from: end)
        }
        return "—"
    }

    private static func overline(thread: EmailThreadEntity?, entry: JournalEntryEntity) -> String {
        let season = seasonLabel(for: thread?.latestDate ?? thread?.earliestDate)
        let year = yearLabel(for: thread?.latestDate ?? thread?.earliestDate)
        let source = entry.sourceClass.rawValue.uppercased().replacingOccurrences(of: "PUBLICSOURCE", with: "PUBLIC")
        return "\(season) · \(year) · \(source.replacingOccurrences(of: "USERHELD", with: "USER-HELD"))"
    }

    private static func byline(for thread: EmailThreadEntity?) -> String {
        guard let thread else { return "a thread from your correspondence" }
        let names = thread.participantSummary
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .compactMap { participantName($0) }
        guard !names.isEmpty else { return "a thread from your correspondence" }
        if names.count == 1 { return "a thread with \(names[0])" }
        if names.count == 2 { return "a thread with \(names[0]) & \(names[1])" }
        return "a thread with \(names.dropLast().joined(separator: ", ")) & \(names.last!)"
    }

    private static func participantName(_ address: String) -> String? {
        let local = address.split(separator: "@").first.map(String.init) ?? address
        guard !local.isEmpty else { return nil }
        return local.prefix(1).uppercased() + local.dropFirst()
    }

    private static func seasonLabel(for date: Date?) -> String {
        guard let date else { return "CORRESPONDENCE" }
        let month = Calendar.current.component(.month, from: date)
        switch month {
        case 12, 1, 2: return "WINTER"
        case 3, 4, 5: return "SPRING"
        case 6, 7, 8: return "SUMMER"
        default: return "AUTUMN"
        }
    }

    private static func yearLabel(for date: Date?) -> String {
        guard let date else { return "USER-HELD" }
        return String(Calendar.current.component(.year, from: date))
    }

    private static func parseMarkdown(_ markdown: String) -> (paragraphs: [String], quote: String?) {
        var text = markdown
        if let range = text.range(of: "\n---") {
            text = String(text[..<range.lowerBound])
        }
        if text.hasPrefix("#") {
            text = text.components(separatedBy: "\n").dropFirst().joined(separator: "\n")
        }
        if let quotesRange = text.range(of: "## Key quotes", options: .caseInsensitive) {
            let bodyPart = String(text[..<quotesRange.lowerBound])
            let quotesPart = String(text[quotesRange.upperBound...])
            let quote = quotesPart
                .components(separatedBy: "\n")
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .first { $0.hasPrefix(">") }
                .map { String($0.dropFirst().trimmingCharacters(in: .whitespaces)) }
            let paragraphs = bodyPart
                .components(separatedBy: "\n\n")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty && !$0.hasPrefix("#") }
            return (paragraphs, quote)
        }
        let paragraphs = text
            .components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && !$0.hasPrefix("#") && !$0.hasPrefix(">") }
        return (paragraphs, nil)
    }

    private static func shortHash(_ hash: String) -> String {
        guard hash.count > 16 else { return hash }
        return "\(hash.prefix(8))…\(hash.suffix(8))"
    }

    private static func capturedLine(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private static func attachedContextSummaries(for entry: JournalEntryEntity) -> [ContextSourceSummary] {
        entry.attachedSources.sorted { $0.capturedAt < $1.capturedAt }.map { source in
            ContextSourceSummary(
                id: source.provenanceID,
                title: source.title,
                kind: source.kind.rawValue,
                state: source.state.rawValue,
                sourceURL: source.sourceURL,
                fingerprint: source.contentFingerprint,
                shortFingerprint: shortHash(source.contentFingerprint)
            )
        }
    }

    private static func lineage(
        entry: JournalEntryEntity,
        story: StoryCandidateEntity?,
        thread: EmailThreadEntity?,
        mbox: MboxImportEntity?,
        context: NSManagedObjectContext
    ) -> [ProvenanceRung] {
        var rungs: [ProvenanceRung] = []
        let phases = ["IMPORT", "CLUSTER", "EXTRACT", "DRAFT"]

        if let mbox {
            rungs.append(ProvenanceRung(
                stage: "01",
                phase: "IMPORT",
                codec: "MboxImportCodec · 0.1.0",
                io: "— → \(shortHash(mbox.contentFingerprint))",
                detail: "\(mbox.fileDisplayName) — \(mbox.messageCount) messages"
            ))
        }
        if let thread {
            rungs.append(ProvenanceRung(
                stage: "02",
                phase: "CLUSTER",
                codec: "ThreadClusterCodec · 0.1.0",
                io: "\(shortHash(thread.originRef.uuidString)) → \(shortHash(thread.contentFingerprint))",
                detail: "\(thread.rawEmailIDs.count) raw emails → 1 thread · “\(thread.normalizedSubject)”"
            ))
        }
        if let story {
            rungs.append(ProvenanceRung(
                stage: "03",
                phase: "EXTRACT",
                codec: "StoryExtractionCodec · 0.1.0",
                io: "\(shortHash(story.originRef.uuidString)) → \(shortHash(story.contentFingerprint))",
                detail: "\(story.modelUsed) — 1 candidate"
            ))
        }
        rungs.append(ProvenanceRung(
            stage: "04",
            phase: "DRAFT",
            codec: "JournalDraftCodec · 0.1.0",
            io: "\(shortHash(story?.contentFingerprint ?? entry.originRef.uuidString)) → \(shortHash(entry.contentFingerprint))",
            detail: "this entry"
        ))

        if rungs.isEmpty {
            for (index, step) in entry.codecPath.enumerated() {
                rungs.append(ProvenanceRung(
                    stage: String(format: "%02d", index + 1),
                    phase: phases[min(index, phases.count - 1)],
                    codec: "\(step.codecName) · \(step.codecVersion)",
                    io: "\(shortHash(step.inputHash)) → \(shortHash(step.outputHash))",
                    detail: "codec path step"
                ))
            }
        }
        return rungs
    }

    private static func latestDecision(for entryID: UUID, context: NSManagedObjectContext) -> HumanDecisionEntity? {
        let request = NSFetchRequest<HumanDecisionEntity>(entityName: "HumanDecisionEntity")
        request.predicate = NSPredicate(format: "journalEntryID == %@", entryID as CVarArg)
        request.sortDescriptors = [NSSortDescriptor(key: "decidedAt", ascending: false)]
        request.fetchLimit = 1
        return try? context.fetch(request).first
    }

    private static func decisionCopy(status: JournalEntryStatus, decision: HumanDecisionEntity?) -> (note: String, field: String) {
        if let decision {
            switch decision.decisionAction {
            case .approve: return ("Archived into the journal — woven, read, and kept.", "approve · archived")
            case .edit: return ("Archived with your edits.", "edit · archived")
            case .retain: return ("Kept for later. It stays in review until you decide.", "retain · in review")
            case .discard: return ("Discarded. The story is set aside; its lineage is not.", "discard · retained")
            }
        }
        switch status {
        case .archived: return ("Archived into the journal — woven, read, and kept.", "approve · archived")
        case .retained: return ("Kept for later. It stays in review until you decide.", "retain · in review")
        case .discarded: return ("Discarded. The story is set aside; its lineage is not.", "discard · retained")
        case .draft: return ("", "draft · pending")
        }
    }

    private static func statusMeta(_ status: JournalEntryStatus) -> (label: String, color: Color) {
        switch status {
        case .archived: return ("ARCHIVED", JournalTheme.accent)
        case .retained: return ("KEPT", JournalTheme.ink)
        case .discarded: return ("DISCARDED", Color(red: 0.761, green: 0.745, blue: 0.698))
        case .draft: return ("IN REVIEW", JournalTheme.label)
        }
    }

    private static func fetchStoryCandidate(id: UUID, context: NSManagedObjectContext) -> StoryCandidateEntity? {
        fetchStoryCandidates(ids: [id], context: context).first
    }

    private static func fetchStoryCandidates(ids: [UUID], context: NSManagedObjectContext) -> [StoryCandidateEntity] {
        guard !ids.isEmpty else { return [] }
        let request = NSFetchRequest<StoryCandidateEntity>(entityName: "StoryCandidateEntity")
        request.predicate = NSPredicate(format: "provenanceID IN %@", ids)
        return (try? context.fetch(request)) ?? []
    }

    private static func fetchThread(id: UUID, context: NSManagedObjectContext) -> EmailThreadEntity? {
        fetchThreads(ids: [id], context: context).first
    }

    private static func fetchThreads(ids: [UUID], context: NSManagedObjectContext) -> [EmailThreadEntity] {
        guard !ids.isEmpty else { return [] }
        let request = NSFetchRequest<EmailThreadEntity>(entityName: "EmailThreadEntity")
        request.predicate = NSPredicate(format: "provenanceID IN %@", ids)
        return (try? context.fetch(request)) ?? []
    }

    private static func fetchMboxImport(for thread: EmailThreadEntity, context: NSManagedObjectContext) -> MboxImportEntity? {
        guard let emailID = thread.rawEmailIDs.first else { return nil }
        let emailRequest = NSFetchRequest<RawEmailEntity>(entityName: "RawEmailEntity")
        emailRequest.predicate = NSPredicate(format: "provenanceID == %@", emailID as CVarArg)
        emailRequest.fetchLimit = 1
        guard let email = try? context.fetch(emailRequest).first else { return nil }
        let mboxRequest = NSFetchRequest<MboxImportEntity>(entityName: "MboxImportEntity")
        mboxRequest.predicate = NSPredicate(format: "provenanceID == %@", email.mboxImportID as CVarArg)
        mboxRequest.fetchLimit = 1
        return try? context.fetch(mboxRequest).first
    }
}
