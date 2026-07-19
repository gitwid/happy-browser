// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "HappyLabsCore",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(name: "HappyLabsCore", targets: ["HappyLabsCore"])
    ],
    targets: [
        .target(
            name: "HappyLabsCore",
            resources: [.process("Resources")],
            linkerSettings: [.linkedLibrary("sqlite3")]
        ),
        .testTarget(
            name: "HappyLabsCoreTests",
            dependencies: ["HappyLabsCore"]
        )
    ]
)
