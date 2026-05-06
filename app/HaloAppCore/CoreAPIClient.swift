import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct DashboardResponse: Codable, Equatable, Sendable {
    public var overview: DashboardOverview
    public var nodes: [DashboardNode]
    public var recentEvents: [DashboardEvent]

    enum CodingKeys: String, CodingKey {
        case overview
        case nodes
        case recentEvents = "recent_events"
    }
}

public struct DashboardOverview: Codable, Equatable, Sendable {
    public var nodes: OverviewNodes
    public var services: OverviewServices
    public var domains: OverviewDomains
    public var events: OverviewEvents
}

public struct OverviewNodes: Codable, Equatable, Sendable {
    public var total: Int
    public var online: Int
    public var offline: Int
}

public struct OverviewServices: Codable, Equatable, Sendable {
    public var total: Int
    public var healthy: Int
    public var warning: Int
    public var unknown: Int
}

public struct OverviewDomains: Codable, Equatable, Sendable {
    public var total: Int
    public var sslWarning: Int

    enum CodingKeys: String, CodingKey {
        case total
        case sslWarning = "ssl_warning"
    }
}

public struct OverviewEvents: Codable, Equatable, Sendable {
    public var unresolved: Int
}

public struct DashboardNode: Codable, Equatable, Identifiable, Sendable {
    public var id: Int64
    public var name: String
    public var displayName: String
    public var status: String
    public var role: String
    public var hostname: String

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case displayName = "display_name"
        case status
        case role
        case hostname
    }
}

public struct DashboardEvent: Codable, Equatable, Identifiable, Sendable {
    public var id: Int64
    public var level: String
    public var type: String
    public var message: String
    public var createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case level
        case type
        case message
        case createdAt = "created_at"
    }
}

public final class CoreAPIClient {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func dashboard(baseURL: URL, token: String) async throws -> DashboardResponse {
        try await request(baseURL: baseURL, path: "/dashboard", token: token)
    }

    public func request<T: Decodable>(baseURL: URL, path: String, token: String) async throws -> T {
        var request = URLRequest(url: baseURL.haloAPIPath(path))
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw CoreHealthError.invalidResponse
        }
        guard http.statusCode == 200 else {
            throw CoreHealthError.httpStatus(http.statusCode)
        }
        return try HaloJSON.decoder.decode(T.self, from: data)
    }
}
