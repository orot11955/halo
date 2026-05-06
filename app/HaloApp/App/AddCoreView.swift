import SwiftUI

struct AddCoreView: View {
    var onSave: (String, URL, String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = "Home Core"
    @State private var urlText = ProcessInfo.processInfo.environment["HALO_APP_CORE_URL"] ?? "http://127.0.0.1:17310"
    @State private var pairingCode = ""

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $name)
                TextField("Core URL", text: $urlText)
                    #if os(iOS)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    #endif
                TextField("Pairing Code", text: $pairingCode)
                    #if os(iOS)
                    .textInputAutocapitalization(.never)
                    #endif
            }
            .navigationTitle("Add Core")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if let url = URL(string: urlText), !name.isEmpty {
                            onSave(name, url, pairingCode)
                        }
                    }
                    .disabled(URL(string: urlText) == nil || name.isEmpty)
                }
            }
        }
        .frame(minWidth: 360, minHeight: 180)
    }
}
