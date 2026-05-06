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

public struct MobileDeviceRegistrationResponse: Codable, Equatable, Sendable {
    public var id: String
    public var deviceName: String
    public var platform: String
    public var bundleID: String
    public var appToken: String?
    public var appTokenID: String?
    public var appScopes: [String]?

    enum CodingKeys: String, CodingKey {
        case id
        case deviceName = "device_name"
        case platform
        case bundleID = "bundle_id"
        case appToken = "app_token"
        case appTokenID = "app_token_id"
        case appScopes = "app_scopes"
    }
}

public enum AuthClientError: Error, Equatable {
    case missingAppToken
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
        let appSession = try await registerAppDevice(
            baseURL: baseURL,
            userSessionToken: login.token,
            username: login.user.username
        )
        try? await logout(baseURL: baseURL, token: login.token)
        return appSession
    }

    public func registerAppDevice(
        baseURL: URL,
        userSessionToken: String,
        username: String,
        deviceID: String? = nil,
        deviceName: String = AuthClient.defaultDeviceName(),
        platform: String = AuthClient.defaultPlatform,
        bundleID: String = Bundle.main.bundleIdentifier ?? "dev.halo.app"
    ) async throws -> SessionToken {
        var payload: [String: Any] = [
            "device_name": deviceName,
            "platform": platform,
            "bundle_id": bundleID,
            "issue_app_token": true,
            "token_name": deviceName,
        ]
        if let deviceID, !deviceID.isEmpty {
            payload["device_id"] = deviceID
        }
        var request = URLRequest(url: baseURL.haloAPIPath("/mobile/devices"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(userSessionToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        let (data, response) = try await session.data(for: request)
        try Self.requireOK(response)
        let device = try HaloJSON.decoder.decode(MobileDeviceRegistrationResponse.self, from: data)
        guard let appToken = device.appToken else {
            throw AuthClientError.missingAppToken
        }
        return SessionToken(
            token: appToken,
            username: username,
            kind: .app,
            deviceID: device.id,
            tokenID: device.appTokenID,
            scopes: device.appScopes ?? []
        )
    }

    public func completePairing(
        baseURL: URL,
        code: String,
        deviceID: String? = nil,
        deviceName: String = AuthClient.defaultDeviceName(),
        platform: String = AuthClient.defaultPlatform,
        bundleID: String = Bundle.main.bundleIdentifier ?? "dev.halo.app"
    ) async throws -> SessionToken {
        var payload: [String: Any] = [
            "code": code,
            "device_name": deviceName,
            "platform": platform,
            "bundle_id": bundleID,
            "token_name": deviceName,
        ]
        if let deviceID, !deviceID.isEmpty {
            payload["device_id"] = deviceID
        }
        var request = URLRequest(url: baseURL.haloAPIPath("/mobile/pair/complete"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        let (data, response) = try await session.data(for: request)
        try Self.requireOK(response)
        let device = try HaloJSON.decoder.decode(MobileDeviceRegistrationResponse.self, from: data)
        guard let appToken = device.appToken else {
            throw AuthClientError.missingAppToken
        }
        let user = try await me(baseURL: baseURL, token: appToken)
        return SessionToken(
            token: appToken,
            username: user.username,
            kind: .app,
            deviceID: device.id,
            tokenID: device.appTokenID,
            scopes: device.appScopes ?? []
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

    private static var defaultPlatform: String {
        #if os(iOS)
        return "ios"
        #else
        return "macos"
        #endif
    }

    private static func defaultDeviceName() -> String {
        let hostName = ProcessInfo.processInfo.hostName
        return hostName.isEmpty ? "Halo app" : hostName
    }
}
