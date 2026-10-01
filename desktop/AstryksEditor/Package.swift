// swift-tools-version: 5.10
import PackageDescription

let package = Package(
  name: "AstryksEditor",
  platforms: [.macOS(.v14)],
  products: [.executable(name: "AstryksEditor", targets: ["AstryksEditor"])],
  targets: [.executableTarget(name: "AstryksEditor")]
)
