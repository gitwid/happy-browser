// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "HappyLabs",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "HappyLabs", targets: ["HappyLabsApp"]),
        .executable(name: "HappyLabsValidate", targets: ["HappyLabsValidate"])
    ],
    dependencies: [
        .package(path: "Packages/HappyLabsCore")
    ],
    targets: [
        .executableTarget(
            name: "HappyLabsApp",
            dependencies: [
                .product(name: "HappyLabsCore", package: "HappyLabsCore")
            ],
            path: "HappyLabsApp"
        ),
        .executableTarget(
            name: "HappyLabsValidate",
            dependencies: [
                .product(name: "HappyLabsCore", package: "HappyLabsCore")
            ],
            path: "Sources/HappyLabsValidate"
        )
    ]
)
