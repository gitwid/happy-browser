import Foundation
import SwiftUI
import UniformTypeIdentifiers

struct RecoveryTestArtifact: Identifiable, Hashable {
    let id = UUID()
    let url: URL

    var displayName: String {
        url.lastPathComponent
    }
}

struct RecoveryTestPacket: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let folderURL: URL
    let artifactCount: Int
    let createdAt: Date
}

@MainActor
final class RecoveryHarnessModel: ObservableObject {
    @Published var storyName = "Rehabilitation"
    @Published var memoryBaseline = ""
    @Published var mustRecover = ""
    @Published var knownTurningPoint = ""
    @Published var knownResolution = ""
    @Published var meaningNotes = ""
    @Published var mustNotInvent = ""
    @Published var artifacts: [RecoveryTestArtifact] = []
    @Published var lastPacket: RecoveryTestPacket?
    @Published var statusMessage = "Write the baseline before opening artifacts."

    var canCreatePacket: Bool {
        !storyName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !memoryBaseline.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var previewMarkdown: String {
        baselineMarkdown(date: Date())
    }

    func addArtifacts(_ urls: [URL]) {
        let existing = Set(artifacts.map(\.url))
        let additions = urls
            .filter { !existing.contains($0) }
            .map(RecoveryTestArtifact.init)
        artifacts.append(contentsOf: additions)
        statusMessage = "\(artifacts.count) artifact\(artifacts.count == 1 ? "" : "s") staged for this packet."
    }

    func removeArtifact(_ artifact: RecoveryTestArtifact) {
        artifacts.removeAll { $0.id == artifact.id }
        statusMessage = "\(artifacts.count) artifact\(artifacts.count == 1 ? "" : "s") staged for this packet."
    }

    @discardableResult
    func createPacket() throws -> RecoveryTestPacket {
        let now = Date()
        let root = try makePacketFolder(now: now)
        let artifactsFolder = root.appendingPathComponent("artifacts", isDirectory: true)
        let outputFolder = root.appendingPathComponent("system-output", isDirectory: true)
        try FileManager.default.createDirectory(at: artifactsFolder, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: outputFolder, withIntermediateDirectories: true)

        try write(baselineMarkdown(date: now), to: root.appendingPathComponent("baseline.md"))
        try write(artifactInventoryMarkdown(), to: root.appendingPathComponent("artifact-inventory.md"))
        try write(comparisonMarkdown(date: now), to: root.appendingPathComponent("comparison.md"))
        try write("# Artifact Index\n\nPending system pass.\n", to: outputFolder.appendingPathComponent("artifact-index.md"))
        try write("# Timeline\n\nPending system pass.\n", to: outputFolder.appendingPathComponent("timeline.md"))
        try write("# Recovered Story\n\nPending system pass.\n", to: outputFolder.appendingPathComponent("recovered-story.md"))
        try write("# Uncertainties\n\nPending system pass.\n", to: outputFolder.appendingPathComponent("uncertainties.md"))
        try write("# Meaning Summary\n\nPending system pass.\n", to: outputFolder.appendingPathComponent("meaning-summary.md"))

        try copyArtifacts(to: artifactsFolder)

        let packet = RecoveryTestPacket(
            title: cleanedStoryName,
            folderURL: root,
            artifactCount: artifacts.count,
            createdAt: now
        )
        lastPacket = packet
        statusMessage = "Created \(packet.title) packet with \(packet.artifactCount) artifact\(packet.artifactCount == 1 ? "" : "s")."
        return packet
    }

    func resetDraft() {
        storyName = "Rehabilitation"
        memoryBaseline = ""
        mustRecover = ""
        knownTurningPoint = ""
        knownResolution = ""
        meaningNotes = ""
        mustNotInvent = ""
        artifacts = []
        lastPacket = nil
        statusMessage = "Write the baseline before opening artifacts."
    }

    private var cleanedStoryName: String {
        let trimmed = storyName.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Untitled Recoverability Test" : trimmed
    }

    private func makePacketFolder(now: Date) throws -> URL {
        let documents = try documentsURL()
        let root = documents.appendingPathComponent("Recoverability Tests", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let stamp = Self.folderDateFormatter.string(from: now)
        let folderName = "\(stamp)_\(slug(cleanedStoryName))"
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

    private func copyArtifacts(to folder: URL) throws {
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

    private func baselineMarkdown(date: Date) -> String {
        """
        # \(cleanedStoryName) Recoverability Baseline

        ## Date Written
        \(Self.displayDateFormatter.string(from: date))

        ## Rule
        This was written before reviewing the artifact corpus.

        ## Memory Baseline
        \(memoryBaseline.trimmedOrPlaceholder)

        ## Must Recover
        \(bulletList(from: mustRecover))

        ## Known Turning Point
        \(knownTurningPoint.trimmedOrPlaceholder)

        ## Known Resolution
        \(knownResolution.trimmedOrPlaceholder)

        ## Emotional / Practical Meaning
        \(meaningNotes.trimmedOrPlaceholder)

        ## Things The System Must Not Invent
        \(bulletList(from: mustNotInvent))
        """
    }

    private func artifactInventoryMarkdown() -> String {
        var rows = artifacts.map { artifact in
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

    private func comparisonMarkdown(date: Date) -> String {
        """
        # \(cleanedStoryName) Recoverability Comparison

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

enum RecoveryHarnessError: LocalizedError {
    case documentsUnavailable

    var errorDescription: String? {
        switch self {
        case .documentsUnavailable:
            return "The app documents folder is unavailable."
        }
    }
}

private extension String {
    var trimmedOrPlaceholder: String {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "_" : trimmed
    }
}
