import SwiftUI
import HaloAppCore

struct CoreDetailView: View {
    @EnvironmentObject private var model: AppModel
    let profile: CoreProfile

    var body: some View {
        VStack(spacing: 0) {
            StatusBanner(snapshot: model.connection) {
                Task { await model.refreshConnection() }
            }
            Divider()
            if let session = model.selectedSession {
                NativeDashboardView(profile: profile, session: session)
            } else {
                NativeLoginView(profile: profile)
            }
        }
        .navigationTitle(profile.name)
        .toolbar {
            Button {
                Task { await model.requestNotificationPermission() }
            } label: {
                Image(systemName: "bell")
            }
            Button {
                Task { await model.logout() }
            } label: {
                Image(systemName: "rectangle.portrait.and.arrow.right")
            }
            .disabled(model.selectedSession == nil)
        }
    }
}

private struct StatusBanner: View {
    let snapshot: ConnectionSnapshot
    let refresh: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: iconName)
                .foregroundStyle(color)
            Text(snapshot.message)
                .lineLimit(1)
            Spacer()
            Button("Refresh", action: refresh)
        }
        .font(.callout)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(color.opacity(0.12))
    }

    private var iconName: String {
        switch snapshot.status {
        case .online: return "checkmark.circle.fill"
        case .checking: return "arrow.triangle.2.circlepath"
        case .unauthorized: return "lock.circle"
        case .tlsError: return "exclamationmark.shield"
        default: return "exclamationmark.circle"
        }
    }

    private var color: Color {
        switch snapshot.status {
        case .online: return .green
        case .checking: return .blue
        case .unauthorized, .tlsError: return .orange
        default: return .red
        }
    }
}
