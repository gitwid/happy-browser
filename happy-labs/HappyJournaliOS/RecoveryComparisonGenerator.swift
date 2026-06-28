import Foundation

struct RecoveryComparisonGenerator {
    let packet: RecoveryTestPacket

    func run() throws {
        let baselineURL = packet.folderURL.appendingPathComponent("baseline.md")
        let outputFolder = packet.folderURL.appendingPathComponent("system-output", isDirectory: true)
        guard FileManager.default.fileExists(atPath: baselineURL.path) else {
            throw RecoveryHarnessError.packetMissingFile("baseline.md")
        }
        let baseline = try String(contentsOf: baselineURL, encoding: .utf8)
        let recovered = try readOutput("recovered-story.md", in: outputFolder)
        let timeline = try readOutput("timeline.md", in: outputFolder)
        let meaning = try readOutput("meaning-summary.md", in: outputFolder)
        let uncertainties = try readOutput("uncertainties.md", in: outputFolder)
        let combined = [recovered, timeline, meaning, uncertainties].joined(separator: "\n\n")

        let mustRecover = extractBullets(after: "## Must Recover", in: baseline)
        let turningPoint = extractSection("## Known Turning Point", in: baseline)
        let resolution = extractSection("## Known Resolution", in: baseline)
        let emotionalMeaning = extractSection("## Emotional / Practical Meaning", in: baseline)

        let recoveredMust = mustRecover.filter { combined.localizedCaseInsensitiveContains($0.keywordForComparison) }
        let sequenceScore = combined.localizedCaseInsensitiveContains("timeline") || combined.localizedCaseInsensitiveContains("sequence") ? 8 : 5
        let turningScore = turningPoint.keywordForComparison.isEmpty ? 6 : (combined.localizedCaseInsensitiveContains(turningPoint.keywordForComparison) ? 9 : 5)
        let dependencyScore = resolution.split(whereSeparator: \.isNewline).contains { combined.localizedCaseInsensitiveContains(String($0).keywordForComparison) } ? 8 : 6
        let meaningScore = emotionalMeaning.keywordForComparison.isEmpty ? 6 : (combined.localizedCaseInsensitiveContains(emotionalMeaning.keywordForComparison) ? 8 : 6)
        let uncertaintyScore = uncertainties.localizedCaseInsensitiveContains("Claims To Avoid") ? 9 : 6
        let mainScore = max(5, min(10, (sequenceScore + turningScore + dependencyScore + meaningScore + uncertaintyScore) / 5))

        let report = """
        # \(packet.title) Recoverability Comparison

        ## Test Date
        \(Self.displayDateFormatter.string(from: Date()))

        ## Baseline Was Written Before Artifact Review
        Yes.

        ## Comparison Method

        This report was generated in-app by comparing `baseline.md` with files in `system-output/`. Artifact annotations in `human-context/` remain outside the blind recovery pass.

        ## Did The System Recover The Main Story?
        Score: \(mainScore)/10

        The recovery output matched \(recoveredMust.count) of \(max(mustRecover.count, 1)) explicit must-recover items. It should be reviewed by the human as final authority.

        ## Sequence Recovery
        Score: \(sequenceScore)/10

        The timeline output was present and attempted to order events from the artifacts.

        ## Turning Point Recovery
        Score: \(turningScore)/10

        Baseline turning point: \(turningPoint.trimmedOrPlaceholder)

        ## Dependency Recovery
        Score: \(dependencyScore)/10

        Baseline resolution/dependencies: \(resolution.trimmedOrPlaceholder)

        ## Meaning Recovery
        Score: \(meaningScore)/10

        Baseline emotional/practical meaning: \(emotionalMeaning.trimmedOrPlaceholder)

        ## Uncertainty Honesty
        Score: \(uncertaintyScore)/10

        The uncertainty output separated missing context and claims to avoid.

        ## Best Recovered Detail

        \(bestRecoveredDetail(from: recovered))

        ## Most Important Miss

        \(mostImportantMiss(mustRecover: mustRecover, recoveredMust: recoveredMust, emotionalMeaning: emotionalMeaning))

        ## Hallucinations Or Overclaims

        Review `uncertainties.md`. The comparison did not find a direct way to prove emotional meaning unless that meaning appeared in artifacts.

        ## Verdict

        \(mainScore >= 8 ? "Pass" : mainScore >= 6 ? "Partial" : "Fail").

        ## What The Next Iteration Must Improve

        - Review any must-recover items not matched by the recovered story.
        - Add missing artifacts when the system correctly marks a gap.
        - Use `human-context/artifact-annotations.md` during review, not during blind recovery.
        """

        try report.write(to: packet.folderURL.appendingPathComponent("comparison.md"), atomically: true, encoding: .utf8)
    }

    private func readOutput(_ filename: String, in folder: URL) throws -> String {
        let url = folder.appendingPathComponent(filename)
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw RecoveryHarnessError.packetMissingFile(filename)
        }
        return try String(contentsOf: url, encoding: .utf8)
    }

    private func extractSection(_ heading: String, in markdown: String) -> String {
        guard let start = markdown.range(of: heading) else { return "" }
        let rest = markdown[start.upperBound...]
        if let end = rest.range(of: "\n## ") {
            return String(rest[..<end.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return String(rest).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func extractBullets(after heading: String, in markdown: String) -> [String] {
        extractSection(heading, in: markdown)
            .split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: CharacterSet(charactersIn: "- ").union(.whitespacesAndNewlines)) }
            .filter { !$0.isEmpty }
    }

    private func bestRecoveredDetail(from recovered: String) -> String {
        let lines = recovered
            .split(whereSeparator: \.isNewline)
            .map(String.init)
            .filter { $0.count > 80 }
        return lines.first ?? "Review recovered-story.md for the strongest recovered detail."
    }

    private func mostImportantMiss(
        mustRecover: [String],
        recoveredMust: [String],
        emotionalMeaning: String
    ) -> String {
        let missing = mustRecover.filter { !recoveredMust.contains($0) }
        if let first = missing.first {
            return first
        }
        return emotionalMeaning.isEmpty ? "No obvious miss detected automatically." : "Emotional/practical meaning may require human review: \(emotionalMeaning)"
    }

    private static let displayDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
}
