import AVFoundation
import Photos
import SwiftUI

/// Renders a project to an MP4 in the temporary folder, then can save it to Photos.
@MainActor
final class Exporter: ObservableObject {
    enum State: Equatable { case idle, rendering, done(URL), failed(String) }
    @Published var state: State = .idle
    @Published var progress: Double = 0
    @Published var savedToPhotos = false

    func export(_ project: Project) async {
        state = .rendering
        progress = 0
        savedToPhotos = false
        do {
            let built = try await CompositionBuilder.build(project)
            if let title = project.title, !title.text.trimmingCharacters(in: .whitespaces).isEmpty {
                CompositionBuilder.addTitle(title, to: built, render: project.shape.renderSize)
            }
            guard let session = AVAssetExportSession(asset: built.composition, presetName: AVAssetExportPresetHighestQuality) else {
                throw CompositionError.empty
            }
            let safeName = project.name.replacingOccurrences(of: "/", with: "-")
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(safeName).mp4")
            try? FileManager.default.removeItem(at: url)
            session.outputURL = url
            session.outputFileType = .mp4
            session.shouldOptimizeForNetworkUse = true
            session.videoComposition = built.videoComposition
            session.audioMix = built.audioMix

            let poll = Task { [weak self] in
                while !Task.isCancelled {
                    try? await Task.sleep(nanoseconds: 200_000_000)
                    self?.progress = Double(session.progress)
                }
            }
            await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
                session.exportAsynchronously { done.resume() }
            }
            poll.cancel()
            if session.status == .completed {
                progress = 1
                state = .done(url)
            } else {
                throw session.error ?? CompositionError.empty
            }
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func saveToPhotos(_ url: URL) async {
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else {
            state = .failed("Allow Lucy Editor to add to Photos in Settings, or use Share instead.")
            return
        }
        do {
            try await PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: url)
            }
            savedToPhotos = true
        } catch {
            state = .failed("Couldn't save to Photos: \(error.localizedDescription)")
        }
    }
}
