import Foundation
import HappyLabsCore

@main
enum HappyLabsValidate {
    static func main() {
        do {
            try run()
        } catch {
            fputs("HappyLabsValidate error: \(error.localizedDescription)\n", stderr)
            exit(1)
        }
    }

    private static func run() throws {
        let arguments = Array(CommandLine.arguments.dropFirst())
        var mboxPath: String?
        var scope: ImportScope = .lastMonth
        var outputDirectory: URL?
        var useSynthetic = false

        var index = 0
        while index < arguments.count {
            let argument = arguments[index]
            switch argument {
            case "--mbox":
                index += 1
                guard index < arguments.count else {
                    throw CLIError.missingValue("--mbox")
                }
                mboxPath = arguments[index]
            case "--scope":
                index += 1
                guard index < arguments.count else {
                    throw CLIError.missingValue("--scope")
                }
                guard let parsed = ImportScope(rawValue: arguments[index]) else {
                    throw CLIError.invalidScope(arguments[index])
                }
                scope = parsed
            case "--output":
                index += 1
                guard index < arguments.count else {
                    throw CLIError.missingValue("--output")
                }
                outputDirectory = URL(fileURLWithPath: arguments[index], isDirectory: true)
            case "--synthetic":
                useSynthetic = true
            case "--help", "-h":
                printUsage()
                return
            default:
                throw CLIError.unknownArgument(argument)
            }
            index += 1
        }

        let mboxURL: URL
        let displayName: String
        if useSynthetic {
            let tempURL = FileManager.default.temporaryDirectory
                .appendingPathComponent("phase01-synthetic-\(UUID().uuidString).mbox")
            try SyntheticCorpusGenerator.writeFixture(to: tempURL)
            defer { try? FileManager.default.removeItem(at: tempURL) }
            mboxURL = tempURL
            displayName = "synthetic-500.mbox"
            fputs("Running Phase 0.1 validation on synthetic corpus (500 messages → ~20 stories).\n", stderr)
        } else {
            guard let mboxPath else {
                printUsage()
                throw CLIError.missingMailbox
            }
            mboxURL = URL(fileURLWithPath: (mboxPath as NSString).expandingTildeInPath)
            displayName = mboxURL.lastPathComponent
        }

        let service = Phase01ValidationService()
        let report = try service.validate(mboxURL: mboxURL, scope: scope)
        let json = try service.exportJSON(report: report)
        let markdown = try service.exportMarkdown(report: report)

        let stamp = ISO8601DateFormatter().string(from: report.generatedAt)
            .replacingOccurrences(of: ":", with: "-")
        let baseName = "phase01-\(displayName)-\(stamp)"

        if let outputDirectory {
            try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
            let jsonURL = outputDirectory.appendingPathComponent("\(baseName).json")
            let markdownURL = outputDirectory.appendingPathComponent("\(baseName).md")
            try json.write(to: jsonURL)
            try markdown.write(to: markdownURL, atomically: true, encoding: .utf8)
            print(jsonURL.path)
            print(markdownURL.path)
        } else {
            print(String(data: json, encoding: .utf8) ?? "")
            fputs("\n--- markdown ---\n", stderr)
            fputs(markdown, stderr)
        }

        fputs(
            "\nPhase 0.1 summary: \(report.driftSummary.draftCount) drafts, " +
            "\(report.driftSummary.stableCount) stable / " +
            "\(report.driftSummary.reviewCount) review / " +
            "\(report.driftSummary.reviseCount) revise\n",
            stderr
        )
    }

    private static func printUsage() {
        let message = """
        Usage:
          swift run HappyLabsValidate --mbox /path/to/export.mbox [--scope lastMonth] [--output DIR]
          swift run HappyLabsValidate --synthetic [--output DIR]

        Scopes: \(ImportScope.allCases.map(\.rawValue).joined(separator: ", "))

        Real mailboxes stay local. Do not commit .mbox files or validation exports with personal data.
        See PHASE_0_1_VALIDATION.md for the full runbook.
        """
        fputs(message + "\n", stderr)
    }
}

private enum CLIError: LocalizedError {
    case missingMailbox
    case missingValue(String)
    case invalidScope(String)
    case unknownArgument(String)

    var errorDescription: String? {
        switch self {
        case .missingMailbox:
            return "Provide --mbox PATH or use --synthetic for the designed corpus."
        case .missingValue(let flag):
            return "Missing value for \(flag)."
        case .invalidScope(let value):
            return "Unknown scope \(value). Use lastWeek, lastMonth, lastThreeMonths, lastYear, or everything."
        case .unknownArgument(let value):
            return "Unknown argument \(value)."
        }
    }
}
