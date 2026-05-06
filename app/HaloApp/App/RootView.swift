import SwiftUI
import HaloAppCore

struct RootView: View {
    @EnvironmentObject private var model: AppModel
    @State private var showingAddCore = false

    var body: some View {
        NavigationSplitView {
            List(selection: Binding(
                get: { model.selectedProfile?.id },
                set: { id in
                    if let id, let profile = model.profiles.first(where: { $0.id == id }) {
                        model.select(profile)
                    }
                }
            )) {
                ForEach(model.profiles) { profile in
                    CoreProfileRow(profile: profile)
                        .tag(profile.id)
                }
            }
            .navigationTitle("Halo")
            .toolbar {
                Button {
                    showingAddCore = true
                } label: {
                    Image(systemName: "plus")
                }
            }
            .sheet(isPresented: $showingAddCore) {
                AddCoreView { name, url, pairingCode in
                    model.saveProfile(name: name, baseURL: url, pairingCode: pairingCode)
                    showingAddCore = false
                }
            }
        } detail: {
            if let profile = model.selectedProfile {
                CoreDetailView(profile: profile)
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "server.rack")
                        .font(.system(size: 36))
                        .foregroundStyle(.secondary)
                    Text("No Core")
                        .font(.headline)
                    Text("Add a Halo core to begin.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .task {
            await model.refreshConnection()
        }
    }
}

private struct CoreProfileRow: View {
    let profile: CoreProfile

    var body: some View {
        Label {
            VStack(alignment: .leading) {
                Text(profile.name)
                Text(profile.baseURL.absoluteString)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        } icon: {
            Image(systemName: iconName)
                .foregroundStyle(iconColor)
        }
    }

    private var iconName: String {
        profile.lastStatus == .online ? "checkmark.circle.fill" : "exclamationmark.circle"
    }

    private var iconColor: Color {
        profile.lastStatus == .online ? .green : .orange
    }
}
