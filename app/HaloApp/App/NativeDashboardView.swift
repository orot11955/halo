import SwiftUI
import HaloAppCore

struct NativeDashboardView: View {
    let profile: CoreProfile
    let session: SessionToken

    @State private var dashboard: DashboardResponse?
    @State private var isLoading = false
    @State private var errorMessage: String?

    private let client = CoreAPIClient()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Dashboard")
                            .font(.title2.weight(.semibold))
                        Text(session.username)
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button {
                        Task { await loadDashboard() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(isLoading)
                }

                if let dashboard {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                        StatTile(title: "Nodes", value: "\(dashboard.overview.nodes.online)/\(dashboard.overview.nodes.total)")
                        StatTile(title: "Services", value: "\(dashboard.overview.services.healthy)/\(dashboard.overview.services.total)")
                        StatTile(title: "Domains", value: "\(dashboard.overview.domains.total)")
                        StatTile(title: "Events", value: "\(dashboard.overview.events.unresolved)")
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Nodes")
                            .font(.headline)
                        ForEach(dashboard.nodes.prefix(6)) { node in
                            HStack {
                                Image(systemName: node.status == "online" ? "checkmark.circle.fill" : "exclamationmark.circle")
                                    .foregroundStyle(node.status == "online" ? .green : .orange)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(node.displayName.isEmpty ? node.name : node.displayName)
                                    Text(node.hostname.isEmpty ? node.role : node.hostname)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(node.status)
                                    .font(.caption.weight(.medium))
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 6)
                        }
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Recent Events")
                            .font(.headline)
                        if dashboard.recentEvents.isEmpty {
                            Text("No recent events")
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(dashboard.recentEvents.prefix(6)) { event in
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(event.message)
                                    Text("\(event.level) - \(event.type)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                .padding(.vertical, 6)
                            }
                        }
                    }
                } else if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 180)
                } else if let errorMessage {
                    VStack(spacing: 8) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.title2)
                            .foregroundStyle(.orange)
                        Text("Unable to load dashboard")
                            .font(.headline)
                        Text(errorMessage)
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, minHeight: 180)
                }
            }
            .padding(18)
        }
        .task {
            if dashboard == nil {
                await loadDashboard()
            }
        }
    }

    private func loadDashboard() async {
        isLoading = true
        errorMessage = nil
        do {
            dashboard = try await client.dashboard(baseURL: profile.baseURL, token: session.token)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

private struct StatTile: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
