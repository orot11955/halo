import Foundation

public struct CoreProfile: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var name: String
    public var baseURL: URL
    public var lastStatus: ConnectionStatus
    public var lastConnectedAt: Date?
    public var notificationPreferences: NotificationPreferences

    public init(
        id: UUID = UUID(),
        name: String,
        baseURL: URL,
        lastStatus: ConnectionStatus = .checking,
        lastConnectedAt: Date? = nil,
        notificationPreferences: NotificationPreferences = .default
    ) {
        self.id = id
        self.name = name
        self.baseURL = baseURL
        self.lastStatus = lastStatus
        self.lastConnectedAt = lastConnectedAt
        self.notificationPreferences = notificationPreferences
    }
}

public struct NotificationPreferences: Codable, Equatable, Sendable {
    public var enabled: Bool
    public var minimumSeverity: EventSeverity
    public var notifyConnectionChanges: Bool
    public var notifyNodes: Bool
    public var notifyServices: Bool
    public var notifyDomains: Bool

    public static let `default` = NotificationPreferences(
        enabled: true,
        minimumSeverity: .warning,
        notifyConnectionChanges: true,
        notifyNodes: true,
        notifyServices: true,
        notifyDomains: true
    )

    public init(
        enabled: Bool,
        minimumSeverity: EventSeverity,
        notifyConnectionChanges: Bool,
        notifyNodes: Bool,
        notifyServices: Bool,
        notifyDomains: Bool
    ) {
        self.enabled = enabled
        self.minimumSeverity = minimumSeverity
        self.notifyConnectionChanges = notifyConnectionChanges
        self.notifyNodes = notifyNodes
        self.notifyServices = notifyServices
        self.notifyDomains = notifyDomains
    }
}

