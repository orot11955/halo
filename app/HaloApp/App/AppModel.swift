import Foundation
import SwiftUI
import HaloAppCore

@MainActor
final class AppModel: ObservableObject {
    @Published var profiles: [CoreProfile] = []
    @Published var selectedProfile: CoreProfile?
    @Published var selectedSession: SessionToken?
    @Published var connection = ConnectionSnapshot(status: .checking, message: "Checking")
    @Published var errorMessage: String?

    private let profileStore: CoreProfileStoring
    private let sessionStore: SessionStoring
    private let healthClient: CoreHealthClient
    private let authClient: AuthClient
    private let notifications: NotificationCoordinator
    private let networkObserver: NetworkPathObserver

    init(
        profileStore: CoreProfileStoring = FileCoreProfileStore(),
        sessionStore: SessionStoring = KeychainSessionStore(),
        healthClient: CoreHealthClient = CoreHealthClient(),
        authClient: AuthClient = AuthClient(),
        notifications: NotificationCoordinator = NotificationCoordinator(),
        networkObserver: NetworkPathObserver = NetworkPathObserver()
    ) {
        self.profileStore = profileStore
        self.sessionStore = sessionStore
        self.healthClient = healthClient
        self.authClient = authClient
        self.notifications = notifications
        self.networkObserver = networkObserver
        loadProfiles()
        networkObserver.onPathChange = { [weak self] reachable in
            Task { @MainActor in
                guard let self else {
                    return
                }
                if reachable {
                    await self.refreshConnection()
                } else if let profile = self.selectedProfile {
                    let previousStatus = profile.lastStatus
                    let snapshot = ConnectionSnapshot(status: .offline, message: "Network unavailable")
                    self.connection = snapshot
                    self.updateSelectedStatus(.offline)
                    self.notifyConnectionChange(for: profile, from: previousStatus, to: snapshot)
                }
            }
        }
        networkObserver.start()
    }

    func loadProfiles() {
        do {
            profiles = try profileStore.load()
            if profiles.isEmpty, let envProfile = Self.environmentCoreProfile() {
                profiles = [envProfile]
                try profileStore.save(profiles)
            }
            selectedProfile = profiles.first
            if let selectedProfile {
                selectedSession = try sessionStore.read(origin: selectedProfile.baseURL.haloOrigin)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private static func environmentCoreProfile() -> CoreProfile? {
        let value = ProcessInfo.processInfo.environment["HALO_APP_CORE_URL"] ?? ""
        guard let url = URL(string: value), url.scheme != nil, url.host != nil else {
            return nil
        }
        let name = url.host.map { "Core \($0)" } ?? "Halo Core"
        return CoreProfile(name: name, baseURL: url)
    }

    func saveProfile(name: String, baseURL: URL, pairingCode: String = "") {
        let profile = CoreProfile(name: name, baseURL: baseURL)
        profiles.append(profile)
        persistProfiles()
        select(profile)
        let code = pairingCode.trimmingCharacters(in: .whitespacesAndNewlines)
        if !code.isEmpty {
            Task { await completePairing(code: code) }
        }
    }

    func select(_ profile: CoreProfile) {
        selectedProfile = profile
        do {
            selectedSession = try sessionStore.read(origin: profile.baseURL.haloOrigin)
        } catch {
            selectedSession = nil
            errorMessage = error.localizedDescription
        }
        Task { await refreshConnection() }
    }

    func refreshConnection() async {
        guard let profile = selectedProfile else {
            connection = ConnectionSnapshot(status: .offline, message: "No core profile")
            return
        }
        let previousStatus = profile.lastStatus
        connection = ConnectionSnapshot(status: .checking, message: "Checking")
        let snapshot = await healthClient.check(baseURL: profile.baseURL)
        connection = snapshot
        updateSelectedStatus(snapshot.status)
        notifyConnectionChange(for: profile, from: previousStatus, to: snapshot)
    }

    func login(username: String, password: String) async {
        guard let profile = selectedProfile else {
            return
        }
        do {
            let session = try await authClient.login(
                baseURL: profile.baseURL,
                username: username,
                password: password
            )
            try sessionStore.save(session, origin: profile.baseURL.haloOrigin)
            selectedSession = session
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func completePairing(code: String) async {
        guard let profile = selectedProfile else {
            return
        }
        do {
            let session = try await authClient.completePairing(
                baseURL: profile.baseURL,
                code: code.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            try sessionStore.save(session, origin: profile.baseURL.haloOrigin)
            selectedSession = session
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func logout() async {
        guard let profile = selectedProfile, let session = selectedSession else {
            return
        }
        do {
            try? await authClient.logout(baseURL: profile.baseURL, token: session.token)
            try sessionStore.delete(origin: profile.baseURL.haloOrigin)
            selectedSession = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func requestNotificationPermission() async {
        await notifications.requestAuthorization()
    }

    private func updateSelectedStatus(_ status: ConnectionStatus) {
        guard let selectedProfile else {
            return
        }
        if let index = profiles.firstIndex(where: { $0.id == selectedProfile.id }) {
            profiles[index].lastStatus = status
            if status == .online {
                profiles[index].lastConnectedAt = Date()
            }
            self.selectedProfile = profiles[index]
            persistProfiles()
        }
    }

    private func notifyConnectionChange(
        for profile: CoreProfile,
        from previousStatus: ConnectionStatus,
        to snapshot: ConnectionSnapshot
    ) {
        guard previousStatus != .checking, previousStatus != snapshot.status else {
            return
        }
        let recovered = snapshot.status == .online
        let title = recovered ? "Halo core reconnected" : "Halo core needs attention"
        let severity: EventSeverity = recovered ? .info : .warning
        let event = HaloEventCandidate(
            id: "core-\(profile.id.uuidString)-\(snapshot.status.rawValue)-\(Int(snapshot.checkedAt.timeIntervalSince1970))",
            kind: recovered ? "core.recovered" : "core.connection",
            category: .connection,
            severity: severity,
            title: title,
            body: "\(profile.name): \(snapshot.message)",
            route: "/"
        )
        notifications.notify(event, preferences: profile.notificationPreferences)
    }

    private func persistProfiles() {
        do {
            try profileStore.save(profiles)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
