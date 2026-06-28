import Foundation

struct RecoveryTestPacketDraft {
    let storyName: String
    let memoryBaseline: String
    let mustRecover: String
    let knownTurningPoint: String
    let knownResolution: String
    let meaningNotes: String
    let mustNotInvent: String
    let artifacts: [RecoveryTestArtifact]

    var cleanedStoryName: String {
        let trimmed = storyName.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Untitled Recoverability Test" : trimmed
    }
}

struct RecoveryTestPacketWriter {
    func previewMarkdown(for draft: RecoveryTestPacketDraft, date: Date) -> String {
        baselineMarkdown(for: draft, date: date)
    }

    @discardableResult
    func createPacket(from draft: RecoveryTestPacketDraft) throws -> RecoveryTestPacket {
        let now = Date()
        let root = try makePacketFolder(for: draft, now: now)
        let artifactsFolder = root.appendingPathComponent("artifacts", isDirectory: true)
        let humanContextFolder = root.appendingPathComponent("human-context", isDirectory: true)
        let outputFolder = root.appendingPathComponent("system-output", isDirectory: true)
        try FileManager.default.createDirectory(at: artifactsFolder, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: humanContextFolder, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: outputFolder, withIntermediateDirectories: true)

        try write(baselineMarkdown(for: draft, date: now), to: root.appendingPathComponent("baseline.md"))
        try write(artifactInventoryMarkdown(for: draft), to: root.appendingPathComponent("artifact-inventory.md"))
        try write(artifactAnnotationsMarkdown(for: draft), to: humanContextFolder.appendingPathComponent("artifact-annotations.md"))
        try write(comparisonMarkdown(for: draft, date: now), to: root.appendingPathComponent("comparison.md"))
        try write("# Artifact Index\n\nPending system pass.\n", to: outputFolder.appendingPathComponent("artifact-index.md"))
        try write("# Timeline\n\nPending system pass.\n", to: outputFolder.appendingPathComponent("timeline.md"))
        try write("# Recovered Story\n\nPending system pass.\n", to: outputFolder.appendingPathComponent("recovered-story.md"))
        try write("# Uncertainties\n\nPending system pass.\n", to: outputFolder.appendingPathComponent("uncertainties.md"))
        try write("# Meaning Summary\n\nPending system pass.\n", to: outputFolder.appendingPathComponent("meaning-summary.md"))

        try copyArtifacts(draft.artifacts, to: artifactsFolder)

        return RecoveryTestPacket(
            title: draft.cleanedStoryName,
            folderURL: root,
            artifactCount: draft.artifacts.count,
            createdAt: now
        )
    }

    private func makePacketFolder(for draft: RecoveryTestPacketDraft, now: Date) throws -> URL {
        let documents = try documentsURL()
        let root = documents.appendingPathComponent("Recoverability Tests", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let stamp = Self.folderDateFormatter.string(from: now)
        let folderName = "\(stamp)_\(slug(draft.cleanedStoryName))"
        let packetURL = root.appendingPathComponent(folderName, isDirectory: true)
        try FileManager.default.createDirectory(at: packetURL, withIntermediateDirectories: true)
        return packetURL
    }

    private func documentsURL() throws -> URL {
        guard let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            throw RecoveryHarnessError.documentsUnavailable
        }
        return url
    }

    private func copyArtifacts(_ artifacts: [RecoveryTestArtifact], to folder: URL) throws {
        for artifact in artifacts {
            let didAccess = artifact.url.startAccessingSecurityScopedResource()
            defer {
                if didAccess {
                    artifact.url.stopAccessingSecurityScopedResource()
                }
            }

            let destination = uniqueDestination(
                for: artifact.url.lastPathComponent,
                in: folder
            )
            try FileManager.default.copyItem(at: artifact.url, to: destination)
        }
    }

    private func uniqueDestination(for filename: String, in folder: URL) -> URL {
        let base = filename.isEmpty ? "artifact" : filename
        var candidate = folder.appendingPathComponent(base)
        guard FileManager.default.fileExists(atPath: candidate.path) else {
            return candidate
        }
        let ext = candidate.pathExtension
        let stem = candidate.deletingPathExtension().lastPathComponent
        var index = 2
        repeat {
            let name = ext.isEmpty ? "\(stem)-\(index)" : "\(stem)-\(index).\(ext)"
            candidate = folder.appendingPathComponent(name)
            index += 1
        } while FileManager.default.fileExists(atPath: candidate.path)
        return candidate
    }

    private func write(_ text: String, to url: URL) throws {
        try text.write(to: url, atomically: true, encoding: .utf8)
    }

    private func baselineMarkdown(for draft: RecoveryTestPacketDraft, date: Date) -> String {
        """
        # \(draft.cleanedStoryName) Recoverability Baseline

        ## Date Written
        \(Self.displayDateFormatter.string(from: date))

        ## Rule
        This was written before reviewing the artifact corpus.

        ## Memory Baseline
        \(draft.memoryBaseline.trimmedOrPlaceholder)

        ## Must Recover
        \(bulletList(from: draft.mustRecover))

        ## Known Turning Point
        \(draft.knownTurningPoint.trimmedOrPlaceholder)

        ## Known Resolution
        \(draft.knownResolution.trimmedOrPlaceholder)

        ## Emotional / Practical Meaning
        \(draft.meaningNotes.trimmedOrPlaceholder)

        ## Things The System Must Not Invent
        \(bulletList(from: draft.mustNotInvent))
        """
    }

    private func artifactInventoryMarkdown(for draft: RecoveryTestPacketDraft) -> String {
        var rows = draft.artifacts.map { artifact in
            "| \(artifact.displayName) | \(artifact.url.pathExtension.uppercased()) | unknown | selected in harness |"
        }
        if rows.isEmpty {
            rows = ["| _No artifacts selected yet_ |  |  |  |"]
        }
        return """
        # Artifact Inventory

        ## Included Artifacts

        | File | Type | Approx Date | Why Included |
        |---|---|---|---|
        \(rows.joined(separator: "\n"))

        ## Known Missing Artifacts

        | Missing Item | Why It Matters |
        |---|---|
        |  |  |

        ## Privacy Notes

        -
        """
    }

    private func artifactAnnotationsMarkdown(for draft: RecoveryTestPacketDraft) -> String {
        let sections = draft.artifacts.map { artifact in
            """
            ## \(artifact.displayName)

            ### Why Included
            \(artifact.whyIncluded.trimmedOrPlaceholder)

            ### What This Meant
            \(artifact.whatThisMeant.trimmedOrPlaceholder)
            """
        }
        return """
        # Artifact Annotations

        These notes are human-context material. They must not be read by the blind recovery pass. They may be used only during comparison or review.

        \(sections.isEmpty ? "_No artifact annotations yet._" : sections.joined(separator: "\n\n"))
        """
    }

    private func comparisonMarkdown(for draft: RecoveryTestPacketDraft, date: Date) -> String {
        """
        # \(draft.cleanedStoryName) Recoverability Comparison

        ## Test Date
        \(Self.displayDateFormatter.string(from: date))

        ## Baseline Was Written Before Artifact Review
        Yes

        ## Did The System Recover The Main Story?
        Score: /10

        Notes:

        ## Sequence Recovery
        Score: /10

        ## Turning Point Recovery
        Score: /10

        ## Dependency Recovery
        Score: /10

        ## Meaning Recovery
        Score: /10

        ## Uncertainty Honesty
        Score: /10

        ## Best Recovered Detail

        -

        ## Most Important Miss

        -

        ## Hallucinations Or Overclaims

        -

        ## Verdict

        Pass / Partial / Fail

        ## What The Next Iteration Must Improve

        -
        -
        -
        """
    }

    private func bulletList(from text: String) -> String {
        let lines = text
            .split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard !lines.isEmpty else { return "-" }
        return lines.map { line in
            line.hasPrefix("-") ? line : "- \(line)"
        }
        .joined(separator: "\n")
    }

    private func slug(_ text: String) -> String {
        let allowed = CharacterSet.alphanumerics
        let scalars = text.lowercased().unicodeScalars.map { scalar -> Character in
            allowed.contains(scalar) ? Character(scalar) : "-"
        }
        return String(scalars)
            .split(separator: "-")
            .joined(separator: "-")
    }

    private static let folderDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd-HHmmss"
        return formatter
    }()

    private static let displayDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
}

extension String {
    var trimmedOrPlaceholder: String {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "_" : trimmed
    }

    var markdownEscaped: String {
        replacingOccurrences(of: "|", with: "\\|")
            .replacingOccurrences(of: "\n", with: " ")
    }

    var keywordForComparison: String {
        let words = lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { $0.count > 3 }
        return words.first ?? trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
