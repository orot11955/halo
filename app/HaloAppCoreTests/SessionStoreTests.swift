import Foundation
import XCTest
@testable import HaloAppCore

final class SessionStoreTests: XCTestCase {
    func testDecodesLegacySessionWithDefaults() throws {
        let json = """
        {
          "token": "tok-legacy",
          "username": "admin",
          "expiresAt": "2026-05-06T12:00:00Z",
          "lastUsedAt": "2026-05-06T12:00:00Z"
        }
        """.data(using: .utf8)!

        let session = try HaloJSON.decoder.decode(SessionToken.self, from: json)

        XCTAssertEqual(session.token, "tok-legacy")
        XCTAssertEqual(session.kind, .userSession)
        XCTAssertEqual(session.scopes, [])
    }

    func testMemorySessionRoundTrip() throws {
        let store = MemorySessionStore()
        let session = SessionToken(
            token: "halo_app_test",
            username: "admin",
            kind: .app,
            deviceID: "dev-1",
            tokenID: "tok-1",
            scopes: ["core:api"]
        )

        try store.save(session, origin: "http://127.0.0.1:7310")

        XCTAssertEqual(try store.read(origin: "http://127.0.0.1:7310"), session)
    }
}
