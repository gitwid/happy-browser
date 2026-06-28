import Foundation
import SwiftUI

struct RecoveryTestArtifact: Identifiable, Hashable {
    let id = UUID()
    let url: URL
    var whyIncluded = ""
    var whatThisMeant = ""

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

enum RecoveryHarnessError: LocalizedError {
    case documentsUnavailable
    case packetMissingFile(String)

    var errorDescription: String? {
        switch self {
        case .documentsUnavailable:
            return "The app documents folder is unavailable."
        case let .packetMissingFile(name):
            return "The packet is missing \(name)."
        }
    }
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
    @Published var isWorking = false

    private let packetWriter = RecoveryTestPacketWriter()

    var canCreatePacket: Bool {
        !storyName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !memoryBaseline.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var previewMarkdown: String {
        packetWriter.previewMarkdown(for: draft(), date: Date())
    }

    func addArtifacts(_ urls: [URL]) {
        let existing = Set(artifacts.map(\.url))
        let additions = urls
            .filter { !existing.contains($0) }
            .map { RecoveryTestArtifact(url: $0) }
        artifacts.append(contentsOf: additions)
        statusMessage = "\(artifacts.count) artifact\(artifacts.count == 1 ? "" : "s") staged for this packet."
    }

    func removeArtifact(_ artifact: RecoveryTestArtifact) {
        artifacts.removeAll { $0.id == artifact.id }
        statusMessage = "\(artifacts.count) artifact\(artifacts.count == 1 ? "" : "s") staged for this packet."
    }

    @discardableResult
    func createPacket() throws -> RecoveryTestPacket {
        let packet = try packetWriter.createPacket(from: draft())
        lastPacket = packet
        statusMessage = "Created \(packet.title) packet with \(packet.artifactCount) artifact\(packet.artifactCount == 1 ? "" : "s")."
        return packet
    }

    func runRecoveryPass() {
        guard let packet = lastPacket else {
            statusMessage = "Create a packet before running recovery."
            return
        }
        isWorking = true
        defer { isWorking = false }
        do {
            let extractor = RecoveryArtifactExtractor()
            let recovery = try RecoveryPassGenerator(packet: packet, extractor: extractor).run()
            statusMessage = "Recovery pass wrote \(recovery.outputCount) files from \(recovery.artifactCount) artifact\(recovery.artifactCount == 1 ? "" : "s")."
        } catch {
            statusMessage = "Recovery failed: \(error.localizedDescription)"
        }
    }

    func compareAgainstBaseline() {
        guard let packet = lastPacket else {
            statusMessage = "Create a packet before comparing."
            return
        }
        isWorking = true
        defer { isWorking = false }
        do {
            try RecoveryComparisonGenerator(packet: packet).run()
            statusMessage = "Comparison written against baseline."
        } catch {
            statusMessage = "Comparison failed: \(error.localizedDescription)"
        }
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

    private func draft() -> RecoveryTestPacketDraft {
        RecoveryTestPacketDraft(
            storyName: storyName,
            memoryBaseline: memoryBaseline,
            mustRecover: mustRecover,
            knownTurningPoint: knownTurningPoint,
            knownResolution: knownResolution,
            meaningNotes: meaningNotes,
            mustNotInvent: mustNotInvent,
            artifacts: artifacts
        )
    }
}
