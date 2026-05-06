import Foundation

#if canImport(Network)
import Network
#endif

final class NetworkPathObserver {
    var onPathChange: ((Bool) -> Void)?

    #if canImport(Network)
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "halo.network.path")
    #endif

    func start() {
        #if canImport(Network)
        monitor.pathUpdateHandler = { [weak self] path in
            self?.onPathChange?(path.status == .satisfied)
        }
        monitor.start(queue: queue)
        #endif
    }

    func stop() {
        #if canImport(Network)
        monitor.cancel()
        #endif
    }
}

