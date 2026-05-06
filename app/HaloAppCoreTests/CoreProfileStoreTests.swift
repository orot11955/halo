import XCTest
@testable import HaloAppCore

final class CoreProfileStoreTests: XCTestCase {
    func testRoundTripsProfiles() throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathComponent("profiles.json")
        let store = FileCoreProfileStore(fileURL: url)
        let profile = CoreProfile(name: "Test", baseURL: URL(string: "http://127.0.0.1:17310")!)

        try store.save([profile])

        XCTAssertEqual(try store.load(), [profile])
    }
}

