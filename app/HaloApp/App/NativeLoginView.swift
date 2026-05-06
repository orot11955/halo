import SwiftUI
import HaloAppCore

struct NativeLoginView: View {
    @EnvironmentObject private var model: AppModel
    let profile: CoreProfile

    @State private var username = "admin"
    @State private var password = ""

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
            if let error = model.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
        .padding()
    }
}

