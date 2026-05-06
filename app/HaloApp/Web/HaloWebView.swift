import SwiftUI
import WebKit
import HaloAppCore

#if os(iOS)
struct HaloWebView: UIViewRepresentable {
    let profile: CoreProfile
    let session: SessionToken

    func makeUIView(context: Context) -> WKWebView {
        let view = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        load(view)
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        if view.url?.haloOrigin != profile.baseURL.haloOrigin {
            load(view)
        }
    }

    private func load(_ view: WKWebView) {
        HaloWebSessionBridge.inject(session: session, for: profile.baseURL, into: view) {
            view.load(URLRequest(url: profile.baseURL))
        }
    }
}
#elseif os(macOS)
struct HaloWebView: NSViewRepresentable {
    let profile: CoreProfile
    let session: SessionToken

    func makeNSView(context: Context) -> WKWebView {
        let view = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        load(view)
        return view
    }

    func updateNSView(_ view: WKWebView, context: Context) {
        if view.url?.haloOrigin != profile.baseURL.haloOrigin {
            load(view)
        }
    }

    private func load(_ view: WKWebView) {
        HaloWebSessionBridge.inject(session: session, for: profile.baseURL, into: view) {
            view.load(URLRequest(url: profile.baseURL))
        }
    }
}
#endif

