import Foundation
import PDFKit
import UIKit
import Vision

struct RecoveryArtifactText {
    let filename: String
    let text: String
    let extractionMethod: String

    var shortSummary: String {
        let compact = text
            .replacingOccurrences(of: "\n", with: " ")
            .replacingOccurrences(of: "  ", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !compact.isEmpty else { return "No readable text recovered." }
        return String(compact.prefix(260))
    }
}

struct RecoveryArtifactExtractor {
    func extract(from url: URL) throws -> RecoveryArtifactText {
        guard url.pathExtension.lowercased() == "pdf" else {
            let text = (try? String(contentsOf: url, encoding: .utf8)) ?? ""
            return RecoveryArtifactText(filename: url.lastPathComponent, text: text, extractionMethod: "plain-text")
        }

        guard let document = PDFDocument(url: url) else {
            return RecoveryArtifactText(filename: url.lastPathComponent, text: "", extractionMethod: "unreadable-pdf")
        }

        let embedded = document.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if embedded.count > 240 {
            return RecoveryArtifactText(filename: url.lastPathComponent, text: embedded, extractionMethod: "pdf-text")
        }

        let ocrText = recognizeText(in: document)
        let method = ocrText.isEmpty ? "pdf-text-empty" : "vision-ocr-de-DE"
        return RecoveryArtifactText(filename: url.lastPathComponent, text: ocrText, extractionMethod: method)
    }

    private func recognizeText(in document: PDFDocument) -> String {
        var pageTexts: [String] = []
        for index in 0..<document.pageCount {
            guard let page = document.page(at: index),
                  let cgImage = render(page: page) else {
                continue
            }
            pageTexts.append("--- OCR page \(index + 1) ---\n\(recognizeText(in: cgImage))")
        }
        return pageTexts.joined(separator: "\n\n")
    }

    private func render(page: PDFPage) -> CGImage? {
        let bounds = page.bounds(for: .mediaBox)
        let scale = 2.0
        let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            context.cgContext.saveGState()
            context.cgContext.translateBy(x: 0, y: size.height)
            context.cgContext.scaleBy(x: scale, y: -scale)
            page.draw(with: .mediaBox, to: context.cgContext)
            context.cgContext.restoreGState()
        }
        return image.cgImage
    }

    private func recognizeText(in image: CGImage) -> String {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.recognitionLanguages = ["de-DE", "en-US"]

        let handler = VNImageRequestHandler(cgImage: image)
        do {
            try handler.perform([request])
        } catch {
            request.recognitionLanguages = ["en-US"]
            try? handler.perform([request])
        }

        return (request.results ?? [])
            .compactMap { $0.topCandidates(1).first?.string }
            .joined(separator: "\n")
    }
}
