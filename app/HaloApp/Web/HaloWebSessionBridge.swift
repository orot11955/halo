import Foundation
import WebKit
import HaloAppCore

enum HaloWebSessionBridge {
    static func inject(session: SessionToken, for baseURL: URL, into webView: WKWebView, completion: @escaping () -> Void) {
        guard let cookie = sessionCookie(session: session, baseURL: baseURL) else {
            completion()
            return
        }
        webView.configuration.websiteDataStore.httpCookieStore.setCookie(cookie) {
            completion()
        }
    }

    private static func sessionCookie(session: SessionToken, baseURL: URL) -> HTTPCookie? {
        guard let host = baseURL.host else {
            return nil
        }
        var properties: [HTTPCookiePropertyKey: Any] = [
            .domain: host,
            .path: "/",
            .name: "halo_session",
            .value: session.token,
        ]
        if let expiresAt = session.expiresAt {
            properties[.expires] = expiresAt
        }
        if baseURL.scheme == "https" {
            properties[.secure] = "TRUE"
        }
        return HTTPCookie(properties: properties)
    }
}
