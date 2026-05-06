import XCTest
@testable import HaloAppCore

final class NotificationPolicyTests: XCTestCase {
    func testSeverityThresholdFiltersLowSeverityEvents() {
        let preferences = NotificationPreferences(
            enabled: true,
            minimumSeverity: .warning,
            notifyConnectionChanges: true,
            notifyNodes: true,
            notifyServices: true,
            notifyDomains: true
        )
        let policy = NotificationPolicy(preferences: preferences)
        let event = HaloEventCandidate(
            id: "1",
            kind: "node.online",
            category: .node,
            severity: .info,
            title: "Node online",
            body: "local recovered"
        )

        XCTAssertFalse(policy.shouldNotify(event))
    }

    func testCategoryToggleFiltersEvents() {
        var preferences = NotificationPreferences.default
        preferences.notifyDomains = false
        let policy = NotificationPolicy(preferences: preferences)
        let event = HaloEventCandidate(
            id: "2",
            kind: "domain.warning",
            category: .domain,
            severity: .warning,
            title: "Domain warning",
            body: "TLS check failed"
        )

        XCTAssertFalse(policy.shouldNotify(event))
    }
}

