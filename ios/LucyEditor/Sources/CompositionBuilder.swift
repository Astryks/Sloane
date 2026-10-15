import AVFoundation
import UIKit

/// Everything AVFoundation needs to play or export a project.
struct BuiltComposition {
    let composition: AVMutableComposition
    let videoComposition: AVMutableVideoComposition
    let audioMix: AVMutableAudioMix
    /// When the first clip ends (titles that only cover the first clip stop here).
    let firstClipEnd: Double
}

enum CompositionError: LocalizedError {
    case empty, noVideo(String)
    var errorDescription: String? {
        switch self {
        case .empty: return "Add at least one clip first."
        case .noVideo(let name): return "\(name) has no video picture in it."
        }
    }
}

/// Builds the timeline: clips alternate between two video/audio tracks so a
/// crossfade can overlap them, each clip is fitted into the chosen shape, and
/// music runs underneath with fades.
enum CompositionBuilder {
    static func build(_ project: Project) async throws -> BuiltComposition {
        guard !project.clips.isEmpty else { throw CompositionError.empty }
        let render = project.shape.renderSize
        let comp = AVMutableComposition()
        let videoTracks = [comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!,
                           comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!]
        let audioTracks = [comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!,
                           comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!]

        struct Segment { let track: Int; let start: CMTime; let duration: CMTime; let transform: CGAffineTransform; let volume: Float }
        var segments: [Segment] = []
        var cursor = CMTime.zero
        let shortest = project.clips.map(\.timelineDuration).min() ?? 1
        let fadeSeconds = project.crossfade && project.clips.count > 1 ? min(Project.crossfadeSeconds, shortest / 3) : 0
        let fade = CMTime(seconds: fadeSeconds, preferredTimescale: 600)

        for (i, clip) in project.clips.enumerated() {
            let asset = AVURLAsset(url: clip.url)
            guard let sourceVideo = try await asset.loadTracks(withMediaType: .video).first else {
                throw CompositionError.noVideo("Clip \(i + 1)")
            }
            let sourceAudio = try await asset.loadTracks(withMediaType: .audio).first
            let natural = try await sourceVideo.load(.naturalSize)
            let preferred = try await sourceVideo.load(.preferredTransform)

            let t = i % 2
            let range = CMTimeRange(start: CMTime(seconds: clip.trimStart, preferredTimescale: 600),
                                    duration: CMTime(seconds: clip.trimEnd - clip.trimStart, preferredTimescale: 600))
            try videoTracks[t].insertTimeRange(range, of: sourceVideo, at: cursor)
            if let sourceAudio { try? audioTracks[t].insertTimeRange(range, of: sourceAudio, at: cursor) }
            let scaled = CMTime(seconds: clip.timelineDuration, preferredTimescale: 600)
            if clip.speed != 1 {
                let inserted = CMTimeRange(start: cursor, duration: range.duration)
                videoTracks[t].scaleTimeRange(inserted, toDuration: scaled)
                if sourceAudio != nil { audioTracks[t].scaleTimeRange(inserted, toDuration: scaled) }
            }
            segments.append(Segment(track: t, start: cursor, duration: scaled,
                                    transform: fitTransform(natural: natural, preferred: preferred, render: render),
                                    volume: clip.muted || sourceAudio == nil ? 0 : 1))
            cursor = cursor + scaled - (i < project.clips.count - 1 ? fade : .zero)
        }
        let total = segments.last.map { $0.start + $0.duration } ?? .zero
        if videoTracks[1].segments.isEmpty { comp.removeTrack(videoTracks[1]) }

        // Video: a passthrough stretch per clip, plus a crossfade stretch between neighbours.
        var instructions: [AVMutableVideoCompositionInstruction] = []
        func layer(_ track: Int, _ transform: CGAffineTransform) -> AVMutableVideoCompositionLayerInstruction {
            let l = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTracks[track])
            l.setTransform(transform, at: .zero)
            return l
        }
        for (i, s) in segments.enumerated() {
            let inStart = i > 0 ? s.start + fade : s.start
            let outEnd = i < segments.count - 1 ? s.start + s.duration - fade : s.start + s.duration
            if outEnd > inStart {
                let pass = AVMutableVideoCompositionInstruction()
                pass.timeRange = CMTimeRange(start: inStart, end: outEnd)
                pass.layerInstructions = [layer(s.track, s.transform)]
                instructions.append(pass)
            }
            if i < segments.count - 1, fadeSeconds > 0 {
                let next = segments[i + 1]
                let range = CMTimeRange(start: outEnd, duration: fade)
                let from = layer(s.track, s.transform)
                from.setOpacityRamp(fromStartOpacity: 1, toEndOpacity: 0, timeRange: range)
                let to = layer(next.track, next.transform)
                let cross = AVMutableVideoCompositionInstruction()
                cross.timeRange = range
                cross.layerInstructions = [from, to]
                instructions.append(cross)
            }
        }
        let videoComposition = AVMutableVideoComposition()
        videoComposition.renderSize = render
        videoComposition.frameDuration = CMTime(value: 1, timescale: 30)
        videoComposition.instructions = instructions

        // Audio: each clip's own sound (crossfaded), then music underneath.
        // Empty tracks (silent clips, photos) make AVPlayer fail with -12784, so drop them.
        let params: [AVMutableAudioMixInputParameters?] = audioTracks.map { track in
            if track.segments.isEmpty { comp.removeTrack(track); return nil }
            return AVMutableAudioMixInputParameters(track: track)
        }
        var mixParams = params.compactMap { $0 }
        for (i, s) in segments.enumerated() {
            guard let p = params[s.track] else { continue }
            if i > 0, fadeSeconds > 0 {
                p.setVolumeRamp(fromStartVolume: 0, toEndVolume: s.volume, timeRange: CMTimeRange(start: s.start, duration: fade))
            } else {
                p.setVolume(s.volume, at: s.start)
            }
            if i < segments.count - 1, fadeSeconds > 0 {
                p.setVolumeRamp(fromStartVolume: s.volume, toEndVolume: 0, timeRange: CMTimeRange(start: s.start + s.duration - fade, duration: fade))
            }
        }
        if let music = project.music, let musicParams = try await addMusic(music, to: comp, total: total) {
            mixParams.append(musicParams)
        }
        let audioMix = AVMutableAudioMix()
        audioMix.inputParameters = mixParams

        return BuiltComposition(composition: comp, videoComposition: videoComposition, audioMix: audioMix,
                                firstClipEnd: segments.first.map { ($0.start + $0.duration).seconds } ?? 0)
    }

    /// Loops or trims the music to the video's length, with optional 1.5 s fades.
    private static func addMusic(_ music: MusicTrack, to comp: AVMutableComposition, total: CMTime) async throws -> AVMutableAudioMixInputParameters? {
        let asset = AVURLAsset(url: music.url)
        guard let source = try await asset.loadTracks(withMediaType: .audio).first,
              let track = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else { return nil }
        let length = try await asset.load(.duration)
        guard length.seconds > 0.1 else { return nil }
        var at = CMTime.zero
        while at < total {
            let piece = CMTimeMinimum(length, total - at)
            try track.insertTimeRange(CMTimeRange(start: .zero, duration: piece), of: source, at: at)
            at = at + piece
        }
        let p = AVMutableAudioMixInputParameters(track: track)
        let v = Float(music.volume)
        let fadeLen = CMTime(seconds: min(1.5, total.seconds / 4), preferredTimescale: 600)
        if music.fadeIn {
            p.setVolumeRamp(fromStartVolume: 0, toEndVolume: v, timeRange: CMTimeRange(start: .zero, duration: fadeLen))
        } else {
            p.setVolume(v, at: .zero)
        }
        if music.fadeOut {
            p.setVolumeRamp(fromStartVolume: v, toEndVolume: 0, timeRange: CMTimeRange(start: total - fadeLen, duration: fadeLen))
        }
        return p
    }

    /// Rotates the clip upright and fits it inside the frame (letterboxed, never cropped).
    static func fitTransform(natural: CGSize, preferred: CGAffineTransform, render: CGSize) -> CGAffineTransform {
        let rect = CGRect(origin: .zero, size: natural).applying(preferred)
        var t = preferred.concatenating(CGAffineTransform(translationX: -rect.minX, y: -rect.minY))
        let w = abs(rect.width), h = abs(rect.height)
        guard w > 0, h > 0 else { return t }
        let scale = min(render.width / w, render.height / h)
        t = t.concatenating(CGAffineTransform(scaleX: scale, y: scale))
        let x = (render.width - w * scale) / 2
        let y = (render.height - h * scale) / 2
        return t.concatenating(CGAffineTransform(translationX: x, y: y))
    }

    /// Adds the title on top of the video for export (playback shows it as a SwiftUI overlay instead).
    static func addTitle(_ title: TitleOverlay, to built: BuiltComposition, render: CGSize) {
        let parent = CALayer()
        let video = CALayer()
        parent.frame = CGRect(origin: .zero, size: render)
        video.frame = parent.frame
        parent.addSublayer(video)

        let fontSize = render.width * 0.065
        let text = CATextLayer()
        text.string = NSAttributedString(string: title.text, attributes: [
            .font: UIFont.systemFont(ofSize: fontSize, weight: .heavy),
            .foregroundColor: UIColor.white,
            .strokeColor: UIColor.black.withAlphaComponent(0.6),
            .strokeWidth: -3,
        ])
        text.alignmentMode = .center
        text.isWrapped = true
        text.contentsScale = 2
        let height = fontSize * 3
        // Core Animation's y axis points up in the export.
        let y: CGFloat
        switch title.position {
        case .top: y = render.height - height - render.height * 0.08
        case .center: y = (render.height - height) / 2
        case .bottom: y = render.height * 0.08
        }
        text.frame = CGRect(x: render.width * 0.06, y: y, width: render.width * 0.88, height: height)
        if !title.wholeVideo {
            let hide = CABasicAnimation(keyPath: "opacity")
            hide.fromValue = 1
            hide.toValue = 0
            hide.beginTime = AVCoreAnimationBeginTimeAtZero + max(0.1, built.firstClipEnd)
            hide.duration = 0.3
            hide.fillMode = .forwards
            hide.isRemovedOnCompletion = false
            text.add(hide, forKey: "hide")
        }
        parent.addSublayer(text)
        built.videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(postProcessingAsVideoLayer: video, in: parent)
    }
}
