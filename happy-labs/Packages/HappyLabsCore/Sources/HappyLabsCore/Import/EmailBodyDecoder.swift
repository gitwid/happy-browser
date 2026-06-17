import Foundation

public enum EmailBodyDecoder {
    public static func decodeBody(headers: [String: String], body: String) -> (plain: String, html: String?) {
        let contentType = headers["content-type"] ?? "text/plain; charset=us-ascii"
        let (mimeType, parameters) = parseContentType(contentType)

        if mimeType.hasPrefix("multipart/") {
            guard let boundary = parameters["boundary"] else {
                return (body.trimmingCharacters(in: .whitespacesAndNewlines), nil)
            }
            return decodeMultipart(body: body, boundary: boundary)
        }

        let charset = parameters["charset"] ?? "us-ascii"
        let transferEncoding = headers["content-transfer-encoding"]?.lowercased() ?? "7bit"
        let decoded = decodePart(body: body, transferEncoding: transferEncoding, charset: charset)

        if mimeType == "text/html" {
            let plain = stripHTML(decoded)
            return (plain, decoded)
        }
        return (decoded.trimmingCharacters(in: .whitespacesAndNewlines), nil)
    }

    private static func decodeMultipart(body: String, boundary: String) -> (plain: String, html: String?) {
        let delimiter = "--\(boundary)"
        var plainText: String?
        var htmlText: String?

        let parts = splitMultipart(body: body, delimiter: delimiter)
        for part in parts {
            let (partHeaders, partBody) = splitHeadersAndBody(part)
            let contentType = partHeaders["content-type"] ?? "text/plain"
            let (mimeType, parameters) = parseContentType(contentType)
            let charset = parameters["charset"] ?? "us-ascii"
            let transferEncoding = partHeaders["content-transfer-encoding"]?.lowercased() ?? "7bit"

            if mimeType.hasPrefix("multipart/"), let nestedBoundary = parameters["boundary"] {
                let nested = decodeMultipart(body: partBody, boundary: nestedBoundary)
                if plainText == nil, !nested.plain.isEmpty { plainText = nested.plain }
                if htmlText == nil, let html = nested.html { htmlText = html }
                continue
            }

            let decoded = decodePart(body: partBody, transferEncoding: transferEncoding, charset: charset)
            switch mimeType {
            case "text/plain" where plainText == nil:
                plainText = decoded.trimmingCharacters(in: .whitespacesAndNewlines)
            case "text/html" where htmlText == nil:
                htmlText = decoded
            default:
                break
            }
        }

        if let plain = plainText, !plain.isEmpty {
            return (plain, htmlText)
        }
        if let html = htmlText {
            return (stripHTML(html), html)
        }
        return ("", nil)
    }

    private static func splitMultipart(body: String, delimiter: String) -> [String] {
        body.components(separatedBy: "\n")
            .reduce(into: [String]()) { parts, line in
                if line.hasPrefix(delimiter) {
                    parts.append("")
                } else if !parts.isEmpty {
                    let index = parts.count - 1
                    parts[index] += (parts[index].isEmpty ? "" : "\n") + line
                }
            }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { part in
                !part.isEmpty && !part.hasPrefix("--")
            }
    }

    private static func splitHeadersAndBody(_ raw: String) -> ([String: String], String) {
        let sections = raw.components(separatedBy: "\n\n")
        guard let headerBlock = sections.first else { return ([:], raw) }
        let body = sections.dropFirst().joined(separator: "\n\n")
        return (parseHeaders(headerBlock), body)
    }

    private static func parseHeaders(_ headerBlock: String) -> [String: String] {
        var headers: [String: String] = [:]
        var currentKey: String?
        var currentValue = ""

        for line in headerBlock.split(separator: "\n", omittingEmptySubsequences: false) {
            let lineString = String(line)
            if lineString.first == " " || lineString.first == "\t", let key = currentKey {
                currentValue += " " + lineString.trimmingCharacters(in: .whitespaces)
                headers[key] = currentValue
            } else if let colon = lineString.firstIndex(of: ":") {
                if let key = currentKey {
                    headers[key] = currentValue
                }
                currentKey = String(lineString[..<colon]).trimmingCharacters(in: .whitespaces).lowercased()
                currentValue = String(lineString[lineString.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
            }
        }
        if let key = currentKey {
            headers[key] = currentValue
        }
        return headers
    }

    private static func parseContentType(_ value: String) -> (mimeType: String, parameters: [String: String]) {
        let parts = value.split(separator: ";", omittingEmptySubsequences: false).map {
            String($0).trimmingCharacters(in: .whitespaces)
        }
        guard let mimeType = parts.first?.lowercased() else {
            return ("text/plain", [:])
        }
        var parameters: [String: String] = [:]
        for part in parts.dropFirst() {
            let pair = part.split(separator: "=", maxSplits: 1).map {
                String($0).trimmingCharacters(in: .whitespaces)
            }
            guard pair.count == 2 else { continue }
            let key = pair[0].lowercased()
            var paramValue = pair[1]
            if paramValue.hasPrefix("\""), paramValue.hasSuffix("\""), paramValue.count >= 2 {
                paramValue = String(paramValue.dropFirst().dropLast())
            }
            parameters[key] = paramValue
        }
        return (mimeType, parameters)
    }

    private static func decodePart(body: String, transferEncoding: String, charset: String) -> String {
        let bytes: Data
        switch transferEncoding {
        case "base64":
            let cleaned = body
                .components(separatedBy: .whitespacesAndNewlines)
                .joined()
            bytes = Data(base64Encoded: cleaned) ?? Data(body.utf8)
        case "quoted-printable":
            bytes = decodeQuotedPrintableBody(body)
        default:
            bytes = Data(body.utf8)
        }
        return MIMECharset.string(from: bytes, charset: charset) ?? body
    }

    private static func decodeQuotedPrintableBody(_ body: String) -> Data {
        var normalized = ""
        var index = body.startIndex
        while index < body.endIndex {
            if body[index] == "=", body.index(after: index) == body.endIndex {
                break
            }
            if body[index] == "=", body[body.index(after: index)] == "\r" || body[body.index(after: index)] == "\n" {
                index = body.index(after: index)
                if index < body.endIndex, body[index] == "\n" {
                    index = body.index(after: index)
                }
                continue
            }
            normalized.append(body[index])
            index = body.index(after: index)
        }

        var bytes = Data()
        bytes.reserveCapacity(normalized.utf8.count)
        index = normalized.startIndex
        while index < normalized.endIndex {
            let character = normalized[index]
            if character == "=", normalized.distance(from: index, to: normalized.endIndex) >= 3 {
                let hexStart = normalized.index(after: index)
                let hexEnd = normalized.index(hexStart, offsetBy: 2)
                let hex = normalized[hexStart..<hexEnd]
                if let byte = UInt8(hex, radix: 16) {
                    bytes.append(byte)
                    index = hexEnd
                    continue
                }
            }
            bytes.append(contentsOf: String(character).utf8)
            index = normalized.index(after: index)
        }
        return bytes
    }

    private static func stripHTML(_ html: String) -> String {
        var text = html
        text = text.replacingOccurrences(of: "<br[^>]*>", with: "\n", options: .regularExpression)
        text = text.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
        text = text
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
