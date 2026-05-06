import Foundation

public struct SessionToken: Codable, Equatable, Sendable {
    public var token: String
    public var username: String
    public var expiresAt: Date
    public var lastUsedAt: Date

    public init(token: String, username: String, expiresAt: Date, lastUsedAt: Date = Date()) {
        self.token = token
        self.username = username
        self.expiresAt = expiresAt
        self.lastUsedAt = lastUsedAt
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

