import SwiftUI

struct AddCoreView: View {
    var onSave: (String, URL) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = "Home Core"
    @State private var urlText = ProcessInfo.processInfo.environment["HALO_APP_CORE_URL"] ?? "http://127.0.0.1:17310"

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $name)
                TextField("Core URL", text: $urlText)
                    #if os(iOS)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
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
                            onSave(name, url)
                        }
                    }
                    .disabled(URL(string: urlText) == nil || name.isEmpty)
                }
            }
        }
        .frame(minWidth: 360, minHeight: 180)
    }
}
