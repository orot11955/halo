import Foundation

public enum EventSeverity: String, Codable, CaseIterable, Comparable, Sendable {
    case info
    case warning
    case critical

    public static func < (lhs: EventSeverity, rhs: EventSeverity) -> Bool {
        lhs.rank < rhs.rank
    }

    private var rank: Int {
        switch self {
        case .info: return 0
        case .warning: return 1
        case .critical: return 2
        }
    }
}

public enum EventCategory: String, Codable, Equatable, Sendable {
    case node
    case service
    case domain
    case connection
    case other
}

public struct HaloEventCandidate: Equatable, Sendable {
    public var id: String
    public var kind: String
    public var category: EventCategory
    public var severity: EventSeverity
    public var title: String
    public var body: String
    public var route: String?

    public init(
        id: String,
        kind: String,
        category: EventCategory,
        severity: EventSeverity,
        title: String,
        body: String,
        route: String? = nil
    ) {
        self.id = id
        self.kind = kind
        self.category = category
        self.severity = severity
        self.title = title
        self.body = body
        self.route = route
    }
}

public struct NotificationPolicy: Equatable, Sendable {
    public var preferences: NotificationPreferences

    public init(preferences: NotificationPreferences) {
        self.preferences = preferences
    }

    public func shouldNotify(_ event: HaloEventCandidate) -> Bool {
        guard preferences.enabled else {
            return false
        }
        guard event.severity >= preferences.minimumSeverity else {
            return false
        }
        switch event.category {
        case .node:
            return preferences.notifyNodes
        case .service:
            return preferences.notifyServices
        case .domain:
            return preferences.notifyDomains
        case .connection:
            return preferences.notifyConnectionChanges
        case .other:
            return true
        }
    }
}

