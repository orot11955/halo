import Foundation

public enum SessionKind: String, Codable, Equatable, Sendable {
    case userSession = "session"
    case app = "app"
}

public struct SessionToken: Codable, Equatable, Sendable {
    public var token: String
    public var username: String
    public var kind: SessionKind
    public var deviceID: String?
    public var tokenID: String?
    public var scopes: [String]
    public var expiresAt: Date?
    public var lastUsedAt: Date

    enum CodingKeys: String, CodingKey {
        case token
        case username
        case kind
        case deviceID
        case tokenID
        case scopes
        case expiresAt
        case lastUsedAt
    }

    public init(
        token: String,
        username: String,
        kind: SessionKind = .app,
        deviceID: String? = nil,
        tokenID: String? = nil,
        scopes: [String] = [],
        expiresAt: Date? = nil,
        lastUsedAt: Date = Date()
    ) {
        self.token = token
        self.username = username
        self.kind = kind
        self.deviceID = deviceID
        self.tokenID = tokenID
        self.scopes = scopes
        self.expiresAt = expiresAt
        self.lastUsedAt = lastUsedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        token = try container.decode(String.self, forKey: .token)
        username = try container.decode(String.self, forKey: .username)
        kind = try container.decodeIfPresent(SessionKind.self, forKey: .kind) ?? .userSession
        deviceID = try container.decodeIfPresent(String.self, forKey: .deviceID)
        tokenID = try container.decodeIfPresent(String.self, forKey: .tokenID)
        scopes = try container.decodeIfPresent([String].self, forKey: .scopes) ?? []
        expiresAt = try container.decodeIfPresent(Date.self, forKey: .expiresAt)
        lastUsedAt = try container.decodeIfPresent(Date.self, forKey: .lastUsedAt) ?? Date()
    }
}

public protocol SessionStoring {
    func read(origin: String) throws -> SessionToken?
    func save(_ session: SessionToken, origin: String) throws
    func delete(origin: String) throws
}

public final class MemorySessionStore: SessionStoring {
    private var values: [String: SessionToken] = [:]

    public init() {}

    public func read(origin: String) throws -> SessionToken? {
        values[origin]
    }

    public func save(_ session: SessionToken, origin: String) throws {
        values[origin] = session
    }

    public func delete(origin: String) throws {
        values.removeValue(forKey: origin)
    }
}
