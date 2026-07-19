import CryptoKit
import CoreFoundation
import Foundation

public enum MorningstarCanonicalizationError: Error, LocalizedError {
    case nonFiniteNumber

    public var errorDescription: String? {
        switch self {
        case .nonFiniteNumber:
            return "Morningstar canonical JSON cannot represent NaN or infinity."
        }
    }
}

/// The protocol value tree hashed by Morningstar protocol 0.2.
public indirect enum MorningstarJSON: Equatable, Sendable {
    case null
    case bool(Bool)
    case int(Int64)
    case double(Double)
    case string(String)
    case array([MorningstarJSON])
    case object([String: MorningstarJSON])
}

/// RFC 8785 JSON Canonicalization Scheme used by Morningstar protocol 0.2.
public enum MorningstarCanonicalJSON {
    public static func parse(_ data: Data) throws -> MorningstarJSON {
        try convert(JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]))
    }

    public static func string(_ value: MorningstarJSON) throws -> String {
        switch value {
        case .null:
            return "null"
        case let .bool(value):
            return value ? "true" : "false"
        case let .int(value):
            return String(value)
        case let .double(value):
            return try es6Number(value)
        case let .string(value):
            return quote(value)
        case let .array(values):
            return "[" + (try values.map(string).joined(separator: ",")) + "]"
        case let .object(object):
            let keys = object.keys.sorted(by: utf16LessThan)
            return "{" + (try keys.map { key in
                quote(key) + ":" + (try string(object[key]!))
            }.joined(separator: ",")) + "}"
        }
    }

    public static func data(_ value: MorningstarJSON) throws -> Data {
        Data(try string(value).utf8)
    }

    public static func sha256(_ value: MorningstarJSON) throws -> String {
        SHA256.hash(data: try data(value)).map { String(format: "%02x", $0) }.joined()
    }

    private static func utf16LessThan(_ lhs: String, _ rhs: String) -> Bool {
        Array(lhs.utf16).lexicographicallyPrecedes(Array(rhs.utf16))
    }

    private static func convert(_ value: Any) throws -> MorningstarJSON {
        if value is NSNull { return .null }
        if let number = value as? NSNumber {
            if CFGetTypeID(number) == CFBooleanGetTypeID() {
                return .bool(number.boolValue)
            }
            let type = String(cString: number.objCType)
            if !["f", "d"].contains(type) {
                return .int(number.int64Value)
            }
            return .double(number.doubleValue)
        }
        if let string = value as? String { return .string(string) }
        if let array = value as? [Any] { return .array(try array.map(convert)) }
        if let object = value as? [String: Any] {
            return .object(try object.mapValues(convert))
        }
        throw CocoaError(.propertyListReadCorrupt)
    }

    private static func quote(_ value: String) -> String {
        var result = "\""
        for scalar in value.unicodeScalars {
            switch scalar.value {
            case 0x08: result += "\\b"
            case 0x09: result += "\\t"
            case 0x0A: result += "\\n"
            case 0x0C: result += "\\f"
            case 0x0D: result += "\\r"
            case 0x22: result += "\\\""
            case 0x5C: result += "\\\\"
            case 0x00...0x1F:
                result += String(format: "\\u%04x", scalar.value)
            default:
                result.unicodeScalars.append(scalar)
            }
        }
        result += "\""
        return result
    }

    /// Swift and ECMAScript both use shortest-round-trip binary64 formatting.
    /// This adjusts the exponent thresholds and spelling required by RFC 8785.
    private static func es6Number(_ value: Double) throws -> String {
        guard value.isFinite else { throw MorningstarCanonicalizationError.nonFiniteNumber }
        if value == 0 { return "0" }

        let raw = String(value).lowercased()
        guard let eIndex = raw.firstIndex(of: "e") else {
            return raw.hasSuffix(".0") ? String(raw.dropLast(2)) : raw
        }

        let mantissa = String(raw[..<eIndex])
        let exponentText = String(raw[raw.index(after: eIndex)...])
        let exponent = Int(exponentText) ?? 0
        let magnitude = abs(value)

        if magnitude >= 1e-6 && magnitude < 1e21 {
            return expand(mantissa: mantissa, exponent: exponent)
        }

        let sign = exponent >= 0 ? "+" : "-"
        return mantissa + "e" + sign + String(abs(exponent))
    }

    private static func expand(mantissa: String, exponent: Int) -> String {
        let negative = mantissa.hasPrefix("-")
        let unsigned = negative ? String(mantissa.dropFirst()) : mantissa
        let pieces = unsigned.split(separator: ".", omittingEmptySubsequences: false)
        let integerDigits = String(pieces[0])
        let fractionalDigits = pieces.count > 1 ? String(pieces[1]) : ""
        let digits = integerDigits + fractionalDigits
        let decimalPosition = integerDigits.count + exponent

        let expanded: String
        if decimalPosition <= 0 {
            expanded = "0." + String(repeating: "0", count: -decimalPosition) + digits
        } else if decimalPosition >= digits.count {
            expanded = digits + String(repeating: "0", count: decimalPosition - digits.count)
        } else {
            let split = digits.index(digits.startIndex, offsetBy: decimalPosition)
            expanded = String(digits[..<split]) + "." + String(digits[split...])
        }
        return negative ? "-" + expanded : expanded
    }
}
