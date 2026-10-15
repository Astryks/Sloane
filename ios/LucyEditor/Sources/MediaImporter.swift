import AVFoundation
import CoreTransferable
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// A video picked from Photos, copied into the app's own storage.
struct PickedMovie: Transferable {
    let url: URL
    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(contentType: .movie) { movie in
            SentTransferredFile(movie.url)
        } importing: { received in
            let ext = received.file.pathExtension.isEmpty ? "mov" : received.file.pathExtension
            let dest = ProjectStore.mediaDirectory.appendingPathComponent("\(UUID().uuidString).\(ext)")
            try FileManager.default.copyItem(at: received.file, to: dest)
            return PickedMovie(url: dest)
        }
    }
}

enum ImportError: LocalizedError {
    case unreadable
    var errorDescription: String? { "That item couldn't be read. Try another one." }
}

enum MediaImporter {
    static let photoSeconds = 3.0

    /// Turns picker items into clips, in the order they were picked.
    static func clips(from items: [PhotosPickerItem]) async -> (clips: [Clip], failed: Int) {
        var out: [Clip] = []
        var failed = 0
        for item in items {
            do {
                if item.supportedContentTypes.contains(where: { $0.conforms(to: .movie) }) {
                    guard let movie = try await item.loadTransferable(type: PickedMovie.self) else { throw ImportError.unreadable }
                    out.append(try await clip(forVideo: movie.url))
                } else {
                    guard let data = try await item.loadTransferable(type: Data.self),
                          let image = UIImage(data: data) else { throw ImportError.unreadable }
                    out.append(try await clip(forPhoto: image))
                }
            } catch {
                failed += 1
            }
        }
        return (out, failed)
    }

    static func clip(forVideo url: URL) async throws -> Clip {
        let asset = AVURLAsset(url: url)
        let seconds = try await asset.load(.duration).seconds
        guard seconds.isFinite, seconds > 0 else { throw ImportError.unreadable }
        return Clip(fileName: url.lastPathComponent, sourceDuration: seconds, trimEnd: seconds)
    }

    /// Writes a still photo as a short silent H.264 clip, so the timeline only ever deals with video.
    static func clip(forPhoto image: UIImage) async throws -> Clip {
        let url = ProjectStore.mediaDirectory.appendingPathComponent("\(UUID().uuidString).mov")
        try await writeStill(image, to: url, seconds: photoSeconds)
        var clip = Clip(fileName: url.lastPathComponent, sourceDuration: photoSeconds, trimEnd: photoSeconds)
        clip.isPhoto = true
        return clip
    }

    private static func writeStill(_ image: UIImage, to url: URL, seconds: Double) async throws {
        // Fit inside 1920 on the long side; even dimensions for H.264.
        let scale = min(1, 1920 / max(image.size.width, image.size.height))
        let w = Int((image.size.width * scale) / 2) * 2
        let h = Int((image.size.height * scale) / 2) * 2
        guard w > 0, h > 0 else { throw ImportError.unreadable }

        let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: w,
            AVVideoHeightKey: h,
        ])
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
            kCVPixelBufferWidthKey as String: w,
            kCVPixelBufferHeightKey as String: h,
        ])
        writer.add(input)
        guard writer.startWriting() else { throw writer.error ?? ImportError.unreadable }
        writer.startSession(atSourceTime: .zero)

        guard let buffer = pixelBuffer(from: image, width: w, height: h) else { throw ImportError.unreadable }
        // Two frames (start and end) are enough for a still.
        let frames: [CMTime] = [.zero, CMTime(seconds: seconds, preferredTimescale: 600)]
        for time in frames {
            while !input.isReadyForMoreMediaData { try await Task.sleep(nanoseconds: 10_000_000) }
            adaptor.append(buffer, withPresentationTime: time)
        }
        input.markAsFinished()
        writer.endSession(atSourceTime: CMTime(seconds: seconds, preferredTimescale: 600))
        await writer.finishWriting()
        if writer.status != .completed { throw writer.error ?? ImportError.unreadable }
    }

    private static func pixelBuffer(from image: UIImage, width: Int, height: Int) -> CVPixelBuffer? {
        var buffer: CVPixelBuffer?
        let attrs = [kCVPixelBufferCGImageCompatibilityKey: true, kCVPixelBufferCGBitmapContextCompatibilityKey: true] as CFDictionary
        guard CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32ARGB, attrs, &buffer) == kCVReturnSuccess,
              let pb = buffer else { return nil }
        CVPixelBufferLockBaseAddress(pb, [])
        defer { CVPixelBufferUnlockBaseAddress(pb, []) }
        guard let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb), width: width, height: height, bitsPerComponent: 8,
                                  bytesPerRow: CVPixelBufferGetBytesPerRow(pb), space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue) else { return nil }
        UIGraphicsPushContext(ctx)
        ctx.translateBy(x: 0, y: CGFloat(height))
        ctx.scaleBy(x: 1, y: -1)
        image.draw(in: CGRect(x: 0, y: 0, width: width, height: height))
        UIGraphicsPopContext()
        return pb
    }

    /// Copies a music file chosen in Files into the app's storage.
    static func importMusic(from url: URL) throws -> MusicTrack {
        let needsScope = url.startAccessingSecurityScopedResource()
        defer { if needsScope { url.stopAccessingSecurityScopedResource() } }
        let ext = url.pathExtension.isEmpty ? "m4a" : url.pathExtension
        let dest = ProjectStore.mediaDirectory.appendingPathComponent("\(UUID().uuidString).\(ext)")
        try FileManager.default.copyItem(at: url, to: dest)
        return MusicTrack(fileName: dest.lastPathComponent, displayName: url.deletingPathExtension().lastPathComponent)
    }

    /// A small thumbnail for the timeline.
    static func thumbnail(for url: URL, at seconds: Double = 0.1) async -> UIImage? {
        let gen = AVAssetImageGenerator(asset: AVURLAsset(url: url))
        gen.appliesPreferredTrackTransform = true
        gen.maximumSize = CGSize(width: 240, height: 240)
        guard let image = try? await gen.image(at: CMTime(seconds: seconds, preferredTimescale: 600)).image else { return nil }
        return UIImage(cgImage: image)
    }
}
