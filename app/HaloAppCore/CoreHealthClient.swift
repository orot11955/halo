import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct CoreHealth: Codable, Equatable, Sendable {
    public var status: String
    public var version: String
}

public enum CoreHealthError: Error, Equatable {
    case invalidResponse
    case httpStatus(Int)
}

public final class CoreHealthClient {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func check(baseURL: URL) async -> ConnectionSnapshot {
        let url = baseURL.haloAPIPath("/healthz")
        do {
            let (data, response) = try await session.data(from: url)
            guard let http = response as? HTTPURLResponse else {
                return ConnectionSnapshot(status: .degraded, message: "Invalid response")
            }
            guard http.statusCode == 200 else {
                return ConnectionSnapshot(status: .offline, message: "HTTP \(http.statusCode)")
            }
            let health = try JSONDecoder().decode(CoreHealth.self, from: data)
            let message = health.version.isEmpty ? health.status : "\(health.status) \(health.version)"
            return ConnectionSnapshot(status: .online, message: message)
        } catch let error as URLError {
            switch error.code {
            case .secureConnectionFailed, .serverCertificateUntrusted, .serverCertificateHasBadDate,
                 .serverCertificateHasUnknownRoot, .serverCertificateNotYetValid:
                return ConnectionSnapshot(status: .tlsError, message: error.localizedDescription)
            case .userAuthenticationRequired:
                return ConnectionSnapshot(status: .unauthorized, message: error.localizedDescription)
            default:
                return ConnectionSnapshot(status: .offline, message: error.localizedDescription)
            }
        } catch {
            return ConnectionSnapshot(status: .degraded, message: error.localizedDescription)
        }
    }
}
