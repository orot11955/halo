// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "HaloApp",
    platforms: [
        .iOS(.v16),
        .macOS(.v13),
    ],
    products: [
        .library(name: "HaloAppCore", targets: ["HaloAppCore"]),
        .executable(name: "HaloApp", targets: ["HaloApp"]),
    ],
    targets: [
        .target(
            name: "HaloAppCore",
            path: "HaloAppCore"
        ),
        .executableTarget(
            name: "HaloApp",
            dependencies: ["HaloAppCore"],
            path: "HaloApp"
        ),
        .testTarget(
            name: "HaloAppCoreTests",
            dependencies: ["HaloAppCore"],
            path: "HaloAppCoreTests"
        ),
    ]
)
