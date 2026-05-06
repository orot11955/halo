import Foundation

public enum HaloDeepLink: Equatable, Sendable {
    case core(UUID)
    case route(coreID: UUID, path: String)
}

public struct DeepLinkRouter {
    public init() {}

    public func parse(_ url: URL) -> HaloDeepLink? {
        guard url.scheme == "halo" else {
            return nil
        }
        let parts = url.pathComponents.filter { $0 != "/" }
        if url.host == "core", let first = parts.first, let id = UUID(uuidString: first) {
            if parts.count == 1 {
                return .core(id)
            }
            let route = "/" + parts.dropFirst().joined(separator: "/")
            return .route(coreID: id, path: route)
        }
        return nil
    }
}

