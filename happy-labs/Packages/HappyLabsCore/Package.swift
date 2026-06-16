// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "HappyLabsCore",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(name: "HappyLabsCore", targets: ["HappyLabsCore"])
    ],
    targets: [
        .target(
            name: "HappyLabsCore",
            resources: [.process("Resources")]
        ),
        .testTarget(
            name: "HappyLabsCoreTests",
            dependencies: ["HappyLabsCore"]
        )
    ]
)
