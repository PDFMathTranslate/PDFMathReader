import Foundation
import Translation

private struct TranslationRequest: Decodable {
    let text: String
    let source: String
    let target: String
}

private struct TranslationResponse: Encodable {
    let translation: String
}

private struct ErrorResponse: Encodable {
    let error: ErrorDetail
}

private struct ErrorDetail: Encodable {
    let message: String
    let code: String?
}

private enum LocalTranslationError: LocalizedError {
    case invalidRequest(String)
    case modelsUnavailable(source: String, target: String)
    case translationFailed(String)

    var errorDescription: String? {
        switch self {
        case .invalidRequest(let message):
            return message
        case .modelsUnavailable(let source, let target):
            return "Apple translation models for \(source) and \(target) are not installed. Open System Settings > General > Language & Region > Translation Languages and download both languages, then retry."
        case .translationFailed(let message):
            return "Apple on-device translation failed: \(message)"
        }
    }

    var code: String? {
        switch self {
        case .invalidRequest:
            return "invalid_request"
        case .modelsUnavailable:
            return "language_models_unavailable"
        case .translationFailed:
            return "translation_failed"
        }
    }
}

private func writeJSON<T: Encodable>(_ value: T) {
    do {
        var data = try JSONEncoder().encode(value)
        data.append(0x0A)
        FileHandle.standardOutput.write(data)
    } catch {
        // JSONEncoder only receives the concrete response types above. Keep a
        // last-resort JSON line on stdout so the parent can always finish the
        // request instead of waiting for a process that cannot report status.
        let fallback = Data("{\"error\":{\"message\":\"Could not encode the local translation response.\",\"code\":\"encoding_failed\"}}\n".utf8)
        FileHandle.standardOutput.write(fallback)
    }
}

private func languageIdentifier(_ value: String) -> String {
    value.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "_", with: "-")
}

@available(macOS 26.0, *)
private func translate(_ request: TranslationRequest) async throws -> String {
    let source = languageIdentifier(request.source)
    let target = languageIdentifier(request.target)
    guard !source.isEmpty, !target.isEmpty else {
        throw LocalTranslationError.invalidRequest("source and target must be non-empty BCP-47 language identifiers.")
    }

    if source.caseInsensitiveCompare(target) == .orderedSame {
        return request.text
    }

    let sourceLanguage = Locale.Language(identifier: source)
    let targetLanguage = Locale.Language(identifier: target)
    let session = TranslationSession(installedSource: sourceLanguage, target: targetLanguage)
    guard await session.isReady else {
        throw LocalTranslationError.modelsUnavailable(source: source, target: target)
    }

    do {
        let response = try await session.translate(request.text)
        return response.targetText
    } catch {
        let detail = error.localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        if detail.isEmpty {
            throw LocalTranslationError.translationFailed("the system returned an unknown error.")
        }
        throw LocalTranslationError.translationFailed(detail)
    }
}

@main
private struct LocalTranslationMain {
    static func main() async {
        guard #available(macOS 26.0, *) else {
            writeJSON(ErrorResponse(error: ErrorDetail(
                message: "Apple on-device translation requires macOS 26 or later.",
                code: "unsupported_os"
            )))
            return
        }

        while let line = readLine(strippingNewline: true) {
            guard !line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                continue
            }

            do {
                let request = try JSONDecoder().decode(TranslationRequest.self, from: Data(line.utf8))
                let translation = try await translate(request)
                writeJSON(TranslationResponse(translation: translation))
            } catch let error as LocalTranslationError {
                writeJSON(ErrorResponse(error: ErrorDetail(message: error.localizedDescription, code: error.code)))
            } catch let error as DecodingError {
                writeJSON(ErrorResponse(error: ErrorDetail(
                    message: "Invalid local translation request: \(error.localizedDescription)",
                    code: "invalid_request"
                )))
            } catch {
                writeJSON(ErrorResponse(error: ErrorDetail(
                    message: "Apple on-device translation failed: \(error.localizedDescription)",
                    code: "translation_failed"
                )))
            }
        }
    }
}
