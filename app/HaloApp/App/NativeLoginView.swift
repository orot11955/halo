import SwiftUI
import HaloAppCore

struct NativeLoginView: View {
    @EnvironmentObject private var model: AppModel
    let profile: CoreProfile

    @State private var username = "admin"
    @State private var password = ""
    @State private var pairingCode = ""

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "lock.shield")
                .font(.system(size: 42))
                .foregroundStyle(.secondary)
            Text(profile.baseURL.absoluteString)
                .font(.caption)
                .foregroundStyle(.secondary)
            VStack(spacing: 10) {
                TextField("Username", text: $username)
                    .textFieldStyle(.roundedBorder)
                SecureField("Password", text: $password)
                    .textFieldStyle(.roundedBorder)
                Button("Sign In") {
                    Task { await model.login(username: username, password: password) }
                }
                .buttonStyle(.borderedProminent)
                .disabled(username.isEmpty || password.isEmpty)
            }
            .frame(maxWidth: 360)
            VStack(spacing: 10) {
                TextField("Pairing Code", text: $pairingCode)
                    .textFieldStyle(.roundedBorder)
                    #if os(iOS)
                    .textInputAutocapitalization(.never)
                    #endif
                Button("Pair App") {
                    Task { await model.completePairing(code: pairingCode) }
                }
                .buttonStyle(.bordered)
                .disabled(pairingCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .frame(maxWidth: 360)
            if let error = model.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
        .padding()
    }
}
