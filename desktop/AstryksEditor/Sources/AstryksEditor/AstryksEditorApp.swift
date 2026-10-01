import AVFoundation
import AppKit
import SwiftUI
import WebKit

@main
struct AstryksEditorApp: App {
  var body: some Scene {
    WindowGroup("Lucy Labs Editor") {
      StitchWebEditor()
        .frame(minWidth: 1080, minHeight: 760)
    }
  }
}

/// The desktop app deliberately presents the same editor as lucylabs.app/stitch
/// instead of a reduced, separate workflow. That keeps all clip, overlay,
/// trimming, preview, and export controls consistent across web and Mac.
private struct StitchWebEditor: NSViewRepresentable {
  func makeNSView(context: Context) -> WKWebView {
    let configuration = WKWebViewConfiguration()
    configuration.defaultWebpagePreferences.allowsContentJavaScript = true
    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.allowsBackForwardNavigationGestures = true
    webView.load(URLRequest(url: URL(string: "https://lucylabs.app/stitch")!))
    return webView
  }

  func updateNSView(_ webView: WKWebView, context: Context) {}
}

@MainActor
final class EditorModel: ObservableObject {
  @Published var lesson: URL?
  @Published var spinLogo: URL?
  @Published var titleCard: URL?
  @Published var endLogo: URL?
  @Published var openingSeconds = 12.0
  @Published var resumeSeconds = 31.5
  @Published var status = "Choose the four local video files to begin. Nothing is uploaded."
  @Published var exporting = false

  func choose(_ assignment: @escaping (URL) -> Void) {
    let panel = NSOpenPanel()
    panel.canChooseFiles = true
    panel.canChooseDirectories = false
    panel.allowsMultipleSelection = false
    panel.allowedContentTypes = [.movie]
    if panel.runModal() == .OK, let url = panel.url { assignment(url) }
  }

  func export() {
    guard let lesson, let spinLogo, let titleCard, let endLogo else {
      status = "Add the lesson, spinning logo, title card, and end logo first."
      return
    }
    let panel = NSSavePanel()
    panel.allowedContentTypes = [.mpeg4Movie]
    panel.nameFieldStringValue = "Astryks lesson edit.mp4"
    guard panel.runModal() == .OK, let destination = panel.url else { return }
    exporting = true
    status = "Building the MP4 locally on this Mac…"
    Task {
      do {
        try await NativeLessonRenderer.render(
          lesson: lesson, spinLogo: spinLogo, titleCard: titleCard, endLogo: endLogo,
          openingSeconds: openingSeconds, resumeSeconds: resumeSeconds, destination: destination
        )
        status = "Done — saved to \(destination.lastPathComponent)."
      } catch {
        status = "Export failed: \(error.localizedDescription)"
      }
      exporting = false
    }
  }
}

struct EditorView: View {
  @StateObject private var model = EditorModel()

  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      VStack(alignment: .leading, spacing: 5) {
        HStack(spacing: 10) {
          LucyBrandMark()
            .frame(width: 42, height: 42)
          VStack(alignment: .leading, spacing: 1) {
            Text("Lucy Labs").font(.headline).foregroundStyle(Color(red: 0.56, green: 0.48, blue: 0.72))
            Text("Astryks Editor").font(.largeTitle.bold())
          }
        }
        Text("A private, local Mac editor for long-form lesson cutaways. Your footage stays on this computer.")
          .foregroundStyle(.secondary)
      }

      GroupBox("Your files") {
        VStack(spacing: 10) {
          FileRow(title: "Lesson video", url: model.lesson) { model.choose { model.lesson = $0 } }
          FileRow(title: "Spinning logo", url: model.spinLogo) { model.choose { model.spinLogo = $0 } }
          FileRow(title: "Title card", url: model.titleCard) { model.choose { model.titleCard = $0 } }
          FileRow(title: "End logo", url: model.endLogo) { model.choose { model.endLogo = $0 } }
        }
        .padding(.vertical, 4)
      }

      GroupBox("Cutaway timing") {
        Grid(alignment: .leading, horizontalSpacing: 18, verticalSpacing: 12) {
          GridRow {
            Text("Open lesson for")
            TextField("Seconds", value: $model.openingSeconds, format: .number.precision(.fractionLength(1)))
              .frame(width: 80)
            Text("seconds before the spinning logo")
          }
          GridRow {
            Text("Resume lesson at")
            TextField("Seconds", value: $model.resumeSeconds, format: .number.precision(.fractionLength(1)))
              .frame(width: 80)
            Text("seconds, after the title card")
          }
        }
        .padding(.vertical, 4)
        Text("The title card carries the tail of the opening audio, then starts the resumed source audio halfway through. The end logo is appended automatically.")
          .font(.caption).foregroundStyle(.secondary)
      }

      HStack {
        Button(model.exporting ? "Exporting…" : "Export MP4 locally") { model.export() }
          .buttonStyle(.borderedProminent).disabled(model.exporting)
        Text(model.status).font(.caption).foregroundStyle(.secondary)
      }
      Spacer()
      Text("Free local app. No account, cloud render, upload, or subscription.")
        .font(.caption).foregroundStyle(.secondary)
    }
    .padding(28)
  }
}

private struct LucyBrandMark: View {
  var body: some View {
    Group {
      if let url = Bundle.main.url(forResource: "LucyLabsLogo", withExtension: "png"),
         let image = NSImage(contentsOf: url) {
        Image(nsImage: image)
          .resizable()
          .scaledToFit()
      } else {
        Image(systemName: "waveform.circle.fill")
          .font(.system(size: 38, weight: .bold))
          .foregroundStyle(Color(red: 0.56, green: 0.48, blue: 0.72))
      }
    }
    .accessibilityLabel("Lucy Labs")
  }
}

private struct FileRow: View {
  let title: String
  let url: URL?
  let choose: () -> Void

  var body: some View {
    HStack {
      Text(title).frame(width: 120, alignment: .leading)
      Text(url?.lastPathComponent ?? "Not selected").lineLimit(1).foregroundStyle(url == nil ? .secondary : .primary)
      Spacer()
      Button("Choose…", action: choose)
    }
  }
}

private enum NativeLessonRenderer {
  static func render(
    lesson: URL, spinLogo: URL, titleCard: URL, endLogo: URL,
    openingSeconds: Double, resumeSeconds: Double, destination: URL
  ) async throws {
    try? FileManager.default.removeItem(at: destination)
    let lessonAsset = AVURLAsset(url: lesson)
    let spinAsset = AVURLAsset(url: spinLogo)
    let titleAsset = AVURLAsset(url: titleCard)
    let endAsset = AVURLAsset(url: endLogo)
    let lessonDuration = try await lessonAsset.load(.duration)
    let spinDuration = try await spinAsset.load(.duration)
    let titleDuration = try await titleAsset.load(.duration)
    let endDuration = try await endAsset.load(.duration)
    let open = CMTime(seconds: max(0.2, openingSeconds), preferredTimescale: 600)
    let resume = CMTime(seconds: max(openingSeconds, resumeSeconds), preferredTimescale: 600)
    guard resume < lessonDuration else { throw RenderError.resumeBeyondLesson }

    let composition = AVMutableComposition()
    guard let videoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
          let audioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else {
      throw RenderError.trackCreation
    }
    var cursor = CMTime.zero

    func appendVideo(_ asset: AVAsset, range: CMTimeRange) async throws {
      guard let source = try await asset.loadTracks(withMediaType: .video).first else { throw RenderError.noVideo }
      try videoTrack.insertTimeRange(range, of: source, at: cursor)
      cursor = cursor + range.duration
    }
    func insertAudio(_ asset: AVAsset, range: CMTimeRange, at start: CMTime) async throws {
      guard let source = try await asset.loadTracks(withMediaType: .audio).first else { return }
      try audioTrack.insertTimeRange(range, of: source, at: start)
    }
    func lessonRange(_ start: CMTime, _ end: CMTime) -> CMTimeRange { CMTimeRange(start: start, end: min(end, lessonDuration)) }

    try await appendVideo(lessonAsset, range: lessonRange(.zero, open))
    try await insertAudio(lessonAsset, range: lessonRange(.zero, open), at: .zero)

    let spinStart = cursor
    try await appendVideo(spinAsset, range: CMTimeRange(start: .zero, duration: spinDuration))
    try await insertAudio(lessonAsset, range: lessonRange(open, open + spinDuration), at: spinStart)

    let titleStart = cursor
    try await appendVideo(titleAsset, range: CMTimeRange(start: .zero, duration: titleDuration))
    let firstHalf = CMTime(seconds: min(titleDuration.seconds / 2, 2), preferredTimescale: 600)
    try await insertAudio(lessonAsset, range: lessonRange(open + spinDuration, open + spinDuration + firstHalf), at: titleStart)
    try await insertAudio(lessonAsset, range: lessonRange(resume - firstHalf, resume), at: titleStart + firstHalf)

    let bodyStart = cursor
    try await appendVideo(lessonAsset, range: lessonRange(resume, lessonDuration))
    try await insertAudio(lessonAsset, range: lessonRange(resume, lessonDuration), at: bodyStart)
    try await appendVideo(endAsset, range: CMTimeRange(start: .zero, duration: endDuration))

    guard let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
      throw RenderError.exporterCreation
    }
    exporter.outputURL = destination
    exporter.outputFileType = .mp4
    try await export(exporter)
  }

  private static func export(_ exporter: AVAssetExportSession) async throws {
    try await withCheckedThrowingContinuation { continuation in
      exporter.exportAsynchronously {
        switch exporter.status {
        case .completed:
          continuation.resume()
        case .failed, .cancelled:
          continuation.resume(throwing: exporter.error ?? RenderError.exportFailed)
        default:
          continuation.resume(throwing: RenderError.exportFailed)
        }
      }
    }
  }

  enum RenderError: LocalizedError {
    case noVideo, trackCreation, exporterCreation, resumeBeyondLesson, exportFailed
    var errorDescription: String? {
      switch self {
      case .noVideo: return "One of the selected files has no video track."
      case .trackCreation: return "Could not create the local edit timeline."
      case .exporterCreation: return "Could not start the local MP4 exporter."
      case .resumeBeyondLesson: return "The resume time is beyond the end of the lesson."
      case .exportFailed: return "The local MP4 exporter stopped before finishing."
      }
    }
  }
}
