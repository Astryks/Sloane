import Foundation
import SwiftUI

/// The shape of the finished video.
enum VideoShape: String, Codable, CaseIterable, Identifiable {
    case vertical, landscape, square
    var id: String { rawValue }
    var label: String {
        switch self {
        case .vertical: return "9:16"
        case .landscape: return "16:9"
        case .square: return "1:1"
        }
    }
    /// Export size in pixels (1080p class).
    var renderSize: CGSize {
        switch self {
        case .vertical: return CGSize(width: 1080, height: 1920)
        case .landscape: return CGSize(width: 1920, height: 1080)
        case .square: return CGSize(width: 1080, height: 1080)
        }
    }
}

enum TitlePosition: String, Codable, CaseIterable, Identifiable {
    case top, center, bottom
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

/// One clip on the timeline. Photos are turned into short video files at import,
/// so every clip is a video file in the app's own storage.
struct Clip: Codable, Identifiable, Equatable {
    var id = UUID()
    /// File name inside `ProjectStore.mediaDirectory`.
    var fileName: String
    /// Full length of the source file, in seconds.
    var sourceDuration: Double
    var trimStart: Double = 0
    var trimEnd: Double
    var speed: Double = 1
    var muted = false
    var isPhoto = false

    var url: URL { ProjectStore.mediaDirectory.appendingPathComponent(fileName) }
    /// Seconds this clip lasts on the timeline (after trim and speed).
    var timelineDuration: Double { max(0.1, (trimEnd - trimStart) / speed) }
}

struct MusicTrack: Codable, Equatable {
    var fileName: String
    var displayName: String
    var volume: Double = 0.7
    var fadeIn = true
    var fadeOut = true
    var url: URL { ProjectStore.mediaDirectory.appendingPathComponent(fileName) }
}

struct TitleOverlay: Codable, Equatable {
    var text: String
    var position: TitlePosition = .bottom
    /// Show for the whole video, or only over the first clip.
    var wholeVideo = false
}

struct Project: Codable, Identifiable, Equatable {
    var id = UUID()
    var name: String
    var created = Date()
    var modified = Date()
    var shape: VideoShape = .vertical
    var crossfade = true
    var clips: [Clip] = []
    var music: MusicTrack?
    var title: TitleOverlay?

    static let crossfadeSeconds = 0.5

    var totalDuration: Double {
        let sum = clips.reduce(0) { $0 + $1.timelineDuration }
        let overlaps = crossfade ? Double(max(0, clips.count - 1)) * Project.crossfadeSeconds : 0
        return max(0, sum - overlaps)
    }
}

/// Saves projects as JSON next to their media, all inside the app's own Documents folder.
@MainActor
final class ProjectStore: ObservableObject {
    @Published private(set) var projects: [Project] = []

    nonisolated static var documents: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
    nonisolated static var mediaDirectory: URL {
        let url = documents.appendingPathComponent("Media", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }
    private static var projectsFile: URL { documents.appendingPathComponent("projects.json") }

    init() { load() }

    func load() {
        guard let data = try? Data(contentsOf: Self.projectsFile),
              let list = try? JSONDecoder().decode([Project].self, from: data) else { return }
        projects = list.sorted { $0.modified > $1.modified }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(projects) {
            try? data.write(to: Self.projectsFile, options: .atomic)
        }
    }

    func create() -> Project {
        let p = Project(name: "Video \(projects.count + 1)")
        projects.insert(p, at: 0)
        persist()
        return p
    }

    func save(_ project: Project) {
        var p = project
        p.modified = Date()
        if let i = projects.firstIndex(where: { $0.id == p.id }) {
            projects[i] = p
        } else {
            projects.insert(p, at: 0)
        }
        projects.sort { $0.modified > $1.modified }
        persist()
    }

    func delete(_ project: Project) {
        projects.removeAll { $0.id == project.id }
        // Remove media no other project still uses.
        let inUse = Set(projects.flatMap { $0.clips.map(\.fileName) + [$0.music?.fileName].compactMap { $0 } })
        let mine = project.clips.map(\.fileName) + [project.music?.fileName].compactMap { $0 }
        for name in mine where !inUse.contains(name) {
            try? FileManager.default.removeItem(at: Self.mediaDirectory.appendingPathComponent(name))
        }
        persist()
    }
}

extension Color {
    static let lucyPurple = Color(red: 0.608, green: 0.490, blue: 0.753)
    static let lucyCream = Color(red: 0.992, green: 0.965, blue: 0.941)
    static let lucyInk = Color(red: 0.239, green: 0.200, blue: 0.188)
}
