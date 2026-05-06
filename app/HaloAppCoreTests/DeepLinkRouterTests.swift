import XCTest
@testable import HaloAppCore

final class DeepLinkRouterTests: XCTestCase {
    func testParsesCoreRoute() {
        let id = UUID()
        let url = URL(string: "halo://core/\(id.uuidString)/nodes/local")!

        XCTAssertEqual(
            DeepLinkRouter().parse(url),
            .route(coreID: id, path: "/nodes/local")
        )
    }
}

