import Foundation

/// Decodes RFC 2047 encoded-words in email headers, e.g. `=?UTF-8?Q?We=E2=80=99d_love?=`
public enum MIMEHeaderDecoder {
    private static let encodedWordPattern = #"\=\?([^?]+)\?([BbQq])\?([^?]*)\?\="#

    public static func decode(_ header: String) -> String {
        guard header.contains("=?") else {
            return header.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        guard let regex = try? NSRegularExpression(pattern: encodedWordPattern) else {
            return header.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        let nsHeader = header as NSString
        let fullRange = NSRange(location: 0, length: nsHeader.length)
        let matches = regex.matches(in: header, range: fullRange)
        guard !matches.isEmpty else {
            return header.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        var output = ""
        var cursor = 0
        for match in matches {
            let range = match.range
            if range.location > cursor {
                output += nsHeader.substring(with: NSRange(location: cursor, length: range.location - cursor))
            }

            let charset = nsHeader.substring(with: match.range(at: 1))
            let encoding = nsHeader.substring(with: match.range(at: 2)).uppercased()
            let encoded = nsHeader.substring(with: match.range(at: 3))
            output += decodeWord(encoded, encoding: encoding, charset: charset)
            cursor = range.location + range.length
        }

        if cursor < nsHeader.length {
            output += nsHeader.substring(from: cursor)
        }

        return output
            .replacingOccurrences(of: "\t", with: " ")
            .replacingOccurrences(of: "  ", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func decodeWord(_ encoded: String, encoding: String, charset: String) -> String {
        let bytes: Data
        switch encoding {
        case "B":
            guard let data = Data(base64Encoded: encoded) else { return encoded }
            bytes = data
        case "Q":
            bytes = decodeQuotedPrintable(encoded)
        default:
            return encoded
        }
        return string(from: bytes, charset: charset) ?? encoded
    }

    private static func decodeQuotedPrintable(_ encoded: String) -> Data {
        var bytes = Data()
        bytes.reserveCapacity(encoded.utf8.count)

        var index = encoded.startIndex
        while index < encoded.endIndex {
            let character = encoded[index]
            if character == "_" {
                bytes.append(UInt8(ascii: " "))
                index = encoded.index(after: index)
            } else if character == "=", encoded.distance(from: index, to: encoded.endIndex) >= 3 {
                let hexStart = encoded.index(after: index)
                let hexEnd = encoded.index(hexStart, offsetBy: 2)
                let hex = encoded[hexStart..<hexEnd]
                if let byte = UInt8(hex, radix: 16) {
                    bytes.append(byte)
                    index = hexEnd
                    continue
                }
                bytes.append(contentsOf: String(character).utf8)
                index = encoded.index(after: index)
            } else {
                bytes.append(contentsOf: String(character).utf8)
                index = encoded.index(after: index)
            }
        }
        return bytes
    }

    private static func string(from bytes: Data, charset: String) -> String? {
        let normalized = charset
            .uppercased()
            .replacingOccurrences(of: "_", with: "-")
            .replacingOccurrences(of: "UTF8", with: "UTF-8")

        switch normalized {
        case "UTF-8", "UTF8":
            return String(data: bytes, encoding: .utf8)
        case "ISO-8859-1", "ISO8859-1", "LATIN1":
            return String(data: bytes, encoding: .isoLatin1)
        case "US-ASCII", "ASCII":
            return String(data: bytes, encoding: .ascii)
        case "WINDOWS-1252", "CP1252":
            return String(data: bytes, encoding: .windowsCP1252)
        default:
            if let encoding = CFStringConvertEncodingToNSStringEncoding(
                CFStringConvertIANACharSetNameToEncoding(normalized as CFString)
            ) as UInt? {
                let nsEncoding = String.Encoding(rawValue: encoding)
                return String(data: bytes, encoding: nsEncoding)
            }
            return String(data: bytes, encoding: .utf8) ?? String(data: bytes, encoding: .isoLatin1)
        }
    }
}
