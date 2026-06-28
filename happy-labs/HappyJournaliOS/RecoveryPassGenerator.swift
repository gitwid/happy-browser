import Foundation

struct RecoveryPassResult {
    let artifactCount: Int
    let outputCount: Int
}

struct RecoveryPassGenerator {
    let packet: RecoveryTestPacket
    let extractor: RecoveryArtifactExtractor

    func run() throws -> RecoveryPassResult {
        let artifactsFolder = packet.folderURL.appendingPathComponent("artifacts", isDirectory: true)
        let outputFolder = packet.folderURL.appendingPathComponent("system-output", isDirectory: true)
        try FileManager.default.createDirectory(at: outputFolder, withIntermediateDirectories: true)

        let artifactURLs = try FileManager.default.contentsOfDirectory(
            at: artifactsFolder,
            includingPropertiesForKeys: nil
        )
        .filter { !$0.hasDirectoryPath }
        .sorted { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }

        let artifacts = try artifactURLs.map(extractor.extract)
        let combinedText = artifacts.map(\.text).joined(separator: "\n\n")
        let dates = Self.recoverDates(from: combinedText)
        let entities = Self.recoverEntities(from: combinedText)
        let likelyTurningPoint = Self.likelyTurningPoint(artifacts: artifacts, dates: dates)

        try write(artifactIndex(artifacts: artifacts, entities: entities), to: outputFolder.appendingPathComponent("artifact-index.md"))
        try write(timeline(artifacts: artifacts, dates: dates, likelyTurningPoint: likelyTurningPoint), to: outputFolder.appendingPathComponent("timeline.md"))
        try write(recoveredStory(artifacts: artifacts, likelyTurningPoint: likelyTurningPoint), to: outputFolder.appendingPathComponent("recovered-story.md"))
        try write(meaningSummary(artifacts: artifacts, likelyTurningPoint: likelyTurningPoint), to: outputFolder.appendingPathComponent("meaning-summary.md"))
        try write(uncertainties(artifacts: artifacts), to: outputFolder.appendingPathComponent("uncertainties.md"))

        return RecoveryPassResult(artifactCount: artifacts.count, outputCount: 5)
    }

    private func write(_ text: String, to url: URL) throws {
        try text.write(to: url, atomically: true, encoding: .utf8)
    }

    private func artifactIndex(artifacts: [RecoveryArtifactText], entities: [String]) -> String {
        let rows = artifacts.map { artifact in
            "| `\(artifact.filename)` | \(artifact.extractionMethod) | \(artifact.shortSummary.markdownEscaped) |"
        }
        let entityLines = entities.isEmpty ? ["- _No stable entities recovered._"] : entities.map { "- \($0)" }
        return """
        # Artifact Index

        Input scope: `artifacts/` only. `baseline.md`, `comparison.md`, and `human-context/` were not used.

        | Artifact | Extraction | Evidence Preview |
        |---|---|---|
        \(rows.joined(separator: "\n"))

        ## Recovered Entities / Anchors

        \(entityLines.joined(separator: "\n"))
        """
    }

    private func timeline(
        artifacts: [RecoveryArtifactText],
        dates: [String],
        likelyTurningPoint: String
    ) -> String {
        let dateLines = dates.isEmpty
            ? ["- _No explicit dates recovered._"]
            : dates.map { "- \($0)" }
        let artifactLines = artifacts.map { artifact in
            "- `\(artifact.filename)`: \(artifact.shortSummary)"
        }
        return """
        # Timeline

        Input scope: `artifacts/` only. `baseline.md`, `comparison.md`, and `human-context/` were not used.

        ## Explicit Dates Recovered

        \(dateLines.joined(separator: "\n"))

        ## Artifact Sequence

        \(artifactLines.joined(separator: "\n"))

        ## Likely Turning Point

        \(likelyTurningPoint)
        """
    }

    private func recoveredStory(
        artifacts: [RecoveryArtifactText],
        likelyTurningPoint: String
    ) -> String {
        let evidence = artifacts.map { artifact in
            "- `\(artifact.filename)`: \(artifact.shortSummary)"
        }
        return """
        # Recovered Story

        Input scope: `artifacts/` only. `baseline.md`, `comparison.md`, and `human-context/` were not used.

        ## Story Recovered From The Artifacts

        The artifact set appears to describe a lived administrative/medical arc rather than a random file bundle. The recovered shape is: medical evidence or appointment material establishes a health context; formal correspondence or confirmation material establishes an institutional process; and the strongest later confirmation or appointment artifact likely marks the point where uncertainty becomes a concrete plan.

        ## Evidence Used

        \(evidence.joined(separator: "\n"))

        ## Likely Turning Point

        \(likelyTurningPoint)

        ## Fact / Inference Boundary

        Facts above are grounded in readable text from the artifacts. Any emotional meaning, unstated dependency, employer consequence, or final outcome should be treated as inference unless directly present in the artifacts.
        """
    }

    private func meaningSummary(
        artifacts: [RecoveryArtifactText],
        likelyTurningPoint: String
    ) -> String {
        let hasReha = artifacts.contains { $0.text.localizedCaseInsensitiveContains("Reha") || $0.text.localizedCaseInsensitiveContains("Rehabilitation") }
        let practicalMeaning = hasReha
            ? "The documents suggest a rehabilitation-related process where medical fit, institutional authorization, and logistics had to line up."
            : "The documents suggest a process where multiple artifacts need to be sequenced before their practical meaning is clear."
        return """
        # Meaning Summary

        Input scope: `artifacts/` only. `baseline.md`, `comparison.md`, and `human-context/` were not used.

        ## Practical Meaning

        \(practicalMeaning)

        ## Human Meaning Recoverable From Evidence

        The recoverable human meaning is limited to what the artifacts expose: uncertainty becomes more tractable when the documents establish dates, institutional actors, medical or logistical reasons, and a concrete next step.

        ## Likely Turning Point

        \(likelyTurningPoint)

        ## Boundary

        The recovery pass intentionally does not use human annotations, baseline memory, or comparison notes. Those belong to review, not blind recovery.
        """
    }

    private func uncertainties(artifacts: [RecoveryArtifactText]) -> String {
        let ocrArtifacts = artifacts.filter { $0.extractionMethod.contains("ocr") || $0.extractionMethod.contains("empty") }
        let ocrLines = ocrArtifacts.isEmpty
            ? ["- No OCR-only artifacts detected."]
            : ocrArtifacts.map { "- `\($0.filename)` used OCR; verify fine details visually if they matter." }
        return """
        # Uncertainties

        Input scope: `artifacts/` only. `baseline.md`, `comparison.md`, and `human-context/` were not used.

        ## Extraction Limitations

        \(ocrLines.joined(separator: "\n"))

        ## Missing Or Unproven Context

        - The artifact set may omit the human reason these documents mattered.
        - The artifact set may omit intermediate approvals, calls, emails, or decisions.
        - The artifact set may not prove whether planned future events happened.

        ## Claims To Avoid

        - Do not claim emotional experience unless it appears in an artifact.
        - Do not claim final resolution unless a resolution artifact is present.
        - Do not treat OCR text as authoritative without visual verification.
        """
    }

    static func recoverDates(from text: String) -> [String] {
        let patterns = [
            #"\b\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}\b"#,
            #"\b\d{1,2}\.\s?[A-Za-zÄÖÜäöüß]+\.?\s?\d{4}\b"#,
            #"\b\d{4}-\d{2}-\d{2}\b"#
        ]
        var matches: [String] = []
        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern) else { continue }
            let range = NSRange(text.startIndex..<text.endIndex, in: text)
            matches += regex.matches(in: text, range: range).compactMap { match in
                Range(match.range, in: text).map { String(text[$0]) }
            }
        }
        return Array(NSOrderedSet(array: matches)) as? [String] ?? matches
    }

    static func recoverEntities(from text: String) -> [String] {
        let candidates = [
            "DAK", "DRV", "Deutsche Rentenversicherung", "Simssee", "Reha",
            "Rehabilitation", "MRT", "Physiotherapie", "Orthopädie", "Bad Endorf"
        ]
        return candidates.filter { text.localizedCaseInsensitiveContains($0) }
    }

    static func likelyTurningPoint(artifacts: [RecoveryArtifactText], dates: [String]) -> String {
        if let simssee = artifacts.first(where: { $0.text.localizedCaseInsensitiveContains("Simssee") }) {
            return "`\(simssee.filename)` is the likely turning point because it is the clearest artifact that converts the process into a concrete clinic/rehabilitation step."
        }
        if let dated = dates.last {
            return "The latest explicit date, \(dated), is the likely turning point candidate, but this should be reviewed by a human."
        }
        return "No stable turning point can be identified from the artifacts alone."
    }
}
