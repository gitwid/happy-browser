import Foundation

enum MIMECharset {
    static func string(from bytes: Data, charset: String) -> String? {
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
