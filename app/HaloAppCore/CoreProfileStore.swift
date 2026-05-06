import Foundation

public protocol CoreProfileStoring {
    func load() throws -> [CoreProfile]
    func save(_ profiles: [CoreProfile]) throws
}

public final class FileCoreProfileStore: CoreProfileStoring {
    private let fileURL: URL

    public init(fileURL: URL? = nil) {
        if let fileURL {
            self.fileURL = fileURL
            return
        }
        let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        self.fileURL = root.appendingPathComponent("HaloApp", isDirectory: true)
            .appendingPathComponent("profiles.json")
    }

    public func load() throws -> [CoreProfile] {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return []
        }
        let data = try Data(contentsOf: fileURL)
        return try HaloJSON.decoder.decode([CoreProfile].self, from: data)
    }

    public func save(_ profiles: [CoreProfile]) throws {
        let dir = fileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let encoder = HaloJSON.encoder
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(profiles)
        try data.write(to: fileURL, options: [.atomic])
    }
}
