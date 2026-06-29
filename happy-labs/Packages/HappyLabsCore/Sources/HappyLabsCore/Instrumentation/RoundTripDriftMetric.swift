import Foundation

public enum RoundTripDriftDisposition: String, Codable, Sendable {
    case stable
    case review
    case revise
}

public struct RoundTripDriftSignal: Codable, Equatable, Sendable {
    public let kind: String
    public let detail: String

    public init(kind: String, detail: String) {
        self.kind = kind
        self.detail = detail
    }
}

public struct RoundTripDriftReport: Codable, Equatable, Sendable {
    public let sourceTokenCount: Int
    public let recoveredTokenCount: Int
    public let sourcePreservation: Double
    public let orderPreservation: Double
    public let numericPreservation: Double
    public let negationPreservation: Double
    public let contaminationRatio: Double
    public let driftScore: Double
    public let disposition: RoundTripDriftDisposition
    public let missingAnchors: [String]
    public let introducedAnchors: [String]
    public let signals: [RoundTripDriftSignal]

    public init(
        sourceTokenCount: Int,
        recoveredTokenCount: Int,
        sourcePreservation: Double,
        orderPreservation: Double,
        numericPreservation: Double,
        negationPreservation: Double,
        contaminationRatio: Double,
        driftScore: Double,
        disposition: RoundTripDriftDisposition,
        missingAnchors: [String],
        introducedAnchors: [String],
        signals: [RoundTripDriftSignal]
    ) {
        self.sourceTokenCount = sourceTokenCount
        self.recoveredTokenCount = recoveredTokenCount
        self.sourcePreservation = sourcePreservation
        self.orderPreservation = orderPreservation
        self.numericPreservation = numericPreservation
        self.negationPreservation = negationPreservation
        self.contaminationRatio = contaminationRatio
        self.driftScore = driftScore
        self.disposition = disposition
        self.missingAnchors = missingAnchors
        self.introducedAnchors = introducedAnchors
        self.signals = signals
    }
}

/// A model-free first instrument for measuring how much meaning survives a
/// forward/reverse traversal. It compares observable text anchors rather than
/// asking the caller to accept PCA or any private framework vocabulary.
public struct RoundTripDriftMetric: Sendable {
    public init() {}

    public func evaluate(source: String, recovered: String) -> RoundTripDriftReport {
        let sourceTokens = Self.significantTokens(in: source)
        let recoveredTokens = Self.significantTokens(in: recovered)
        let sourceTokenSet = Set(sourceTokens)
        let recoveredTokenSet = Set(recoveredTokens)

        let missingAnchors = sourceTokenSet.subtracting(recoveredTokenSet).sorted()
        let introducedAnchors = recoveredTokenSet.subtracting(sourceTokenSet).sorted()

        let sourcePreservation = sourceTokenSet.isEmpty
            ? 1
            : Double(sourceTokenSet.intersection(recoveredTokenSet).count) / Double(sourceTokenSet.count)
        let contaminationRatio = recoveredTokenSet.isEmpty
            ? 0
            : Double(introducedAnchors.count) / Double(recoveredTokenSet.count)
        let orderPreservation = Self.orderPreservation(source: sourceTokens, recovered: recoveredTokens)
        let numericPreservation = Self.preservation(
            required: Self.numericAnchors(in: source),
            observed: Self.numericAnchors(in: recovered)
        )
        let negationPreservation = Self.preservation(
            required: Self.negationAnchors(in: source),
            observed: Self.negationAnchors(in: recovered)
        )

        let preservationScore =
            sourcePreservation * 0.40 +
            orderPreservation * 0.20 +
            numericPreservation * 0.20 +
            negationPreservation * 0.10 +
            (1 - contaminationRatio) * 0.10
        let driftScore = Self.clamp(1 - preservationScore)
        let signals = Self.signals(
            sourcePreservation: sourcePreservation,
            orderPreservation: orderPreservation,
            numericPreservation: numericPreservation,
            negationPreservation: negationPreservation,
            contaminationRatio: contaminationRatio,
            missingAnchors: missingAnchors
        )
        let disposition = Self.disposition(
            driftScore: driftScore,
            sourcePreservation: sourcePreservation,
            numericPreservation: numericPreservation,
            negationPreservation: negationPreservation,
            contaminationRatio: contaminationRatio
        )

        return RoundTripDriftReport(
            sourceTokenCount: sourceTokens.count,
            recoveredTokenCount: recoveredTokens.count,
            sourcePreservation: sourcePreservation,
            orderPreservation: orderPreservation,
            numericPreservation: numericPreservation,
            negationPreservation: negationPreservation,
            contaminationRatio: contaminationRatio,
            driftScore: driftScore,
            disposition: disposition,
            missingAnchors: missingAnchors,
            introducedAnchors: introducedAnchors,
            signals: signals
        )
    }

    public func exportMarkdown(report: RoundTripDriftReport) -> String {
        [
            "# Round-Trip Drift Report",
            "",
            "## Scores",
            "",
            "- Drift score: \(Self.format(report.driftScore))",
            "- Disposition: \(report.disposition.rawValue)",
            "- Source preservation: \(Self.format(report.sourcePreservation))",
            "- Order preservation: \(Self.format(report.orderPreservation))",
            "- Numeric preservation: \(Self.format(report.numericPreservation))",
            "- Negation preservation: \(Self.format(report.negationPreservation))",
            "- Contamination ratio: \(Self.format(report.contaminationRatio))",
            "",
            "## Anchors",
            "",
            "- Source tokens: \(report.sourceTokenCount)",
            "- Recovered tokens: \(report.recoveredTokenCount)",
            "- Missing anchors: \(report.missingAnchors.prefix(20).joined(separator: ", "))",
            "- Introduced anchors: \(report.introducedAnchors.prefix(20).joined(separator: ", "))",
            "",
            "## Signals",
            "",
            report.signals.isEmpty
                ? "- none"
                : report.signals.map { "- \($0.kind): \($0.detail)" }.joined(separator: "\n")
        ].joined(separator: "\n")
    }

    private static func disposition(
        driftScore: Double,
        sourcePreservation: Double,
        numericPreservation: Double,
        negationPreservation: Double,
        contaminationRatio: Double
    ) -> RoundTripDriftDisposition {
        if sourcePreservation < 0.50 {
            return .revise
        }
        if driftScore <= 0.20 {
            if contaminationRatio > 0.35 || numericPreservation < 1 || negationPreservation < 1 {
                return .review
            }
            return .stable
        }
        if driftScore <= 0.45 {
            return .review
        }
        return .revise
    }

    private static func signals(
        sourcePreservation: Double,
        orderPreservation: Double,
        numericPreservation: Double,
        negationPreservation: Double,
        contaminationRatio: Double,
        missingAnchors: [String]
    ) -> [RoundTripDriftSignal] {
        var signals: [RoundTripDriftSignal] = []
        if sourcePreservation < 0.70 {
            signals.append(.init(kind: "source_omission", detail: "Less than 70% of source anchors survived."))
        }
        if orderPreservation < 0.60 {
            signals.append(.init(kind: "sequence_drift", detail: "Recovered anchors do not preserve source order."))
        }
        if numericPreservation < 1 {
            signals.append(.init(kind: "numeric_drift", detail: "A source number, date, or identifier is missing."))
        }
        if negationPreservation < 1 {
            signals.append(.init(kind: "modality_drift", detail: "A negation or refusal marker is missing."))
        }
        if contaminationRatio > 0.35 {
            signals.append(.init(kind: "introduced_material", detail: "Recovered text introduced many anchors absent from source."))
        }
        if !missingAnchors.isEmpty {
            let sample = missingAnchors.prefix(8).joined(separator: ", ")
            signals.append(.init(kind: "missing_anchors", detail: sample))
        }
        return signals
    }

    private static func preservation(required: [String], observed: [String]) -> Double {
        let requiredSet = Set(required)
        guard !requiredSet.isEmpty else { return 1 }
        let observedSet = Set(observed)
        return Double(requiredSet.intersection(observedSet).count) / Double(requiredSet.count)
    }

    private static func orderPreservation(source: [String], recovered: [String]) -> Double {
        guard !source.isEmpty else { return 1 }
        guard !recovered.isEmpty else { return 0 }
        let length = longestCommonSubsequenceLength(source, recovered)
        return Double(length) / Double(source.count)
    }

    private static func longestCommonSubsequenceLength(_ first: [String], _ second: [String]) -> Int {
        var previous = Array(repeating: 0, count: second.count + 1)
        var current = previous

        for left in first {
            for (index, right) in second.enumerated() {
                if left == right {
                    current[index + 1] = previous[index] + 1
                } else {
                    current[index + 1] = max(previous[index + 1], current[index])
                }
            }
            previous = current
        }
        return previous[second.count]
    }

    private static func significantTokens(in text: String) -> [String] {
        tokenize(text).filter { token in
            token.count >= 3 && !stopwords.contains(token)
        }
    }

    private static func numericAnchors(in text: String) -> [String] {
        tokenize(text).filter { token in
            token.contains { $0.isNumber }
        }
    }

    private static func negationAnchors(in text: String) -> [String] {
        let negations: Set<String> = [
            "no", "not", "never", "none", "without", "refuse", "refused",
            "reject", "rejected", "decline", "declined", "nicht", "kein",
            "keine", "ohne", "abgelehnt"
        ]
        return tokenize(text).filter { negations.contains($0) }
    }

    private static func tokenize(_ text: String) -> [String] {
        text
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "en_US_POSIX"))
            .lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
    }

    private static func clamp(_ value: Double) -> Double {
        min(max(value, 0), 1)
    }

    private static func format(_ value: Double) -> String {
        String(format: "%.4f", value)
    }

    private static let stopwords: Set<String> = [
        "the", "and", "for", "that", "this", "with", "from", "into", "onto",
        "was", "were", "are", "you", "your", "our", "but", "had", "has",
        "have", "about", "after", "before", "then", "than", "they", "them",
        "their", "there", "here", "eine", "einer", "einem", "einen", "der",
        "die", "das", "und", "oder", "mit", "fur", "von", "den", "dem", "des",
        "ist", "war", "sind", "auf"
    ]
}
