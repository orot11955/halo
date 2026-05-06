import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct AuthUser: Codable, Equatable, Sendable {
    public var username: String
}

public struct LoginResponse: Codable, Equatable, Sendable {
    public var token: String
    public var expiresAt: Date
    public var user: AuthUser

    enum CodingKeys: String, CodingKey {
        case token
        case expiresAt = "expires_at"
        case user
    }
}

public final class AuthClient {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func login(baseURL: URL, username: String, password: String) async throws -> SessionToken {
        var request = URLRequest(url: baseURL.haloAPIPath("/auth/login"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["username": username, "password": password])
        let (data, response) = try await session.data(for: request)
        try Self.requireOK(response)
        let login = try HaloJSON.decoder.decode(LoginResponse.self, from: data)
        return SessionToken(
            token: login.token,
            username: login.user.username,
            expiresAt: login.expiresAt
        )
    }

    public func me(baseURL: URL, token: String? = nil) async throws -> AuthUser {
        var request = URLRequest(url: baseURL.haloAPIPath("/auth/me"))
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await session.data(for: request)
        try Self.requireOK(response)
        return try JSONDecoder().decode(AuthUser.self, from: data)
    }

    public func logout(baseURL: URL, token: String) async throws {
        var request = URLRequest(url: baseURL.haloAPIPath("/auth/logout"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (_, response) = try await session.data(for: request)
        try Self.requireOK(response, accepted: [200, 204])
    }

    private static func requireOK(_ response: URLResponse, accepted: Set<Int> = [200]) throws {
        guard let http = response as? HTTPURLResponse else {
            throw CoreHealthError.invalidResponse
        }
        guard accepted.contains(http.statusCode) else {
            throw CoreHealthError.httpStatus(http.statusCode)
        }
    }
}
