import Foundation
import HaloAppCore

#if canImport(UserNotifications)
import UserNotifications
#endif

final class NotificationCoordinator {
    func requestAuthorization() async {
        #if canImport(UserNotifications)
        do {
            _ = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
        } catch {
            // Authorization failures are reflected in system settings.
        }
        #endif
    }

    func notify(_ event: HaloEventCandidate, preferences: NotificationPreferences) {
        let policy = NotificationPolicy(preferences: preferences)
        guard policy.shouldNotify(event) else {
            return
        }
        #if canImport(UserNotifications)
        let content = UNMutableNotificationContent()
        content.title = event.title
        content.body = event.body
        content.sound = .default
        if let route = event.route {
            content.userInfo = ["route": route]
        }
        let request = UNNotificationRequest(
            identifier: event.id,
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(request)
        #endif
    }
}

