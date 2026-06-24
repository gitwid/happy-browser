import Foundation

public enum ImportScope: String, CaseIterable, Sendable, Equatable, Identifiable {
    case lastWeek
    case lastMonth
    case lastThreeMonths
    case lastYear
    case everything

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .lastWeek: return "Last week"
        case .lastMonth: return "Last month"
        case .lastThreeMonths: return "Last 3 months"
        case .lastYear: return "Last year"
        case .everything: return "Everything"
        }
    }

    public var subtitle: String {
        switch self {
        case .lastWeek:
            return "Keeps messages from the past 7 days. The mailbox is still scanned in full."
        case .lastMonth:
            return "Keeps messages from the past month. Recommended first import."
        case .lastThreeMonths:
            return "Keeps messages from the past 3 months. The mailbox is still scanned in full."
        case .lastYear:
            return "Keeps messages from the past year. Large mailboxes may take several minutes."
        case .everything:
            return "Full archive — can take a long time on large mailboxes."
        }
    }

    public var isLongRunning: Bool {
        switch self {
        case .lastWeek, .lastMonth: return false
        case .lastThreeMonths, .lastYear, .everything: return true
        }
    }

    public func earliestIncludedDate(relativeTo now: Date = Date()) -> Date? {
        let calendar = Calendar.current
        switch self {
        case .lastWeek:
            return calendar.date(byAdding: .day, value: -7, to: now)
        case .lastMonth:
            return calendar.date(byAdding: .month, value: -1, to: now)
        case .lastThreeMonths:
            return calendar.date(byAdding: .month, value: -3, to: now)
        case .lastYear:
            return calendar.date(byAdding: .year, value: -1, to: now)
        case .everything:
            return nil
        }
    }

    public func includes(messageDate: Date?, relativeTo now: Date = Date()) -> Bool {
        guard let cutoff = earliestIncludedDate(relativeTo: now) else { return true }
        guard let messageDate else { return false }
        return messageDate >= cutoff
    }
}

public struct ImportProgressUpdate: Sendable {
    public enum Stage: String, Sendable {
        case readingFile
        case parsingMessages
        case savingEmails
        case clusteringThreads
        case extractingStories
        case draftingJournal
        case finishing
    }

    public let stage: Stage
    public let message: String

    public init(stage: Stage, message: String) {
        self.stage = stage
        self.message = message
    }
}
