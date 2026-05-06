import Foundation

public extension URL {
    var haloOrigin: String {
        var components = URLComponents()
        components.scheme = scheme
        components.host = host
        components.port = port
        return components.string ?? absoluteString
    }

    func haloAPIPath(_ path: String) -> URL {
        let normalized = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        var components = URLComponents(url: self, resolvingAgainstBaseURL: false)
        let basePath = components?.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")) ?? ""
        components?.path = "/" + [basePath, "api/v1", normalized]
            .filter { !$0.isEmpty }
            .joined(separator: "/")
        components?.query = nil
        components?.fragment = nil
        return components?.url ?? appendingPathComponent("api/v1").appendingPathComponent(normalized)
    }
}
