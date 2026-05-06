import Foundation

public enum ConnectionStatus: String, Codable, Equatable, Sendable {
    case checking
    case online
    case degraded
    case offline
    case unauthorized
    case tlsError = "tls_error"
    case versionMismatch = "version_mismatch"
}

public struct ConnectionSnapshot: Equatable, Sendable {
    public var status: ConnectionStatus
    public var message: String
    public var checkedAt: Date

    public init(status: ConnectionStatus, message: String, checkedAt: Date = Date()) {
        self.status = status
        self.message = message
        self.checkedAt = checkedAt
    }
}

