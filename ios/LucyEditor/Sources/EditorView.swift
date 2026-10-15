import AVKit
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct EditorView: View {
    @EnvironmentObject private var store: ProjectStore
    @State var project: Project
    @State private var selected: UUID?
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var importing = false
    @State private var message: String?
    @State private var player = AVPlayer()
    @State private var thumbs: [UUID: UIImage] = [:]
    @State private var showMusicPicker = false
    @State private var showExport = false
    @State private var rebuildTask: Task<Void, Never>?

    private var selectedIndex: Int? { project.clips.firstIndex { $0.id == selected } }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                preview
                timeline
                if let i = selectedIndex { ClipInspector(clip: $project.clips[i], onMove: { move(i, by: $0) }, onDuplicate: { duplicate(i) }, onDelete: { delete(i) }) }
                settingsCard
                musicCard
                titleCard
                if let message { Text(message).font(.footnote).foregroundStyle(.secondary) }
            }
            .padding(16)
        }
        .background(Color.lucyCream.ignoresSafeArea())
        .navigationTitle(project.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Export") { player.pause(); showExport = true }
                    .fontWeight(.bold)
                    .disabled(project.clips.isEmpty)
                    .accessibilityIdentifier("export")
            }
        }
        .sheet(isPresented: $showExport) { ExportSheet(project: project) }
        .fileImporter(isPresented: $showMusicPicker, allowedContentTypes: [.audio]) { result in
            if case .success(let url) = result {
                do { project.music = try MediaImporter.importMusic(from: url) } catch { message = "Couldn't add that music file." }
            }
        }
        .onChange(of: pickerItems) { _, items in
            guard !items.isEmpty else { return }
            Task { await importItems(items) }
        }
        .onChange(of: project) { _, p in
            store.save(p)
            scheduleRebuild()
        }
        .task { scheduleRebuild(delay: 0) }
        .onDisappear { player.pause() }
    }

    // MARK: Preview

    private var preview: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18).fill(Color.black)
            if project.clips.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "film.stack").font(.largeTitle)
                    Text("Add videos or photos to start").font(.subheadline)
                }
                .foregroundStyle(.white.opacity(0.8))
            } else {
                VideoPlayer(player: player)
                    .overlay(alignment: titleAlignment) { titlePreview }
            }
        }
        .aspectRatio(previewAspect, contentMode: .fit)
        .frame(maxHeight: 420)
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }

    private var previewAspect: CGFloat {
        let s = project.shape.renderSize
        return s.width / s.height
    }

    private var titleAlignment: Alignment {
        switch project.title?.position ?? .bottom {
        case .top: return .top
        case .center: return .center
        case .bottom: return .bottom
        }
    }

    @ViewBuilder private var titlePreview: some View {
        if let t = project.title, !t.text.isEmpty {
            Text(t.text)
                .font(.system(size: 22, weight: .heavy))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.7), radius: 2)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 16)
                .padding(.vertical, 28)
                .allowsHitTesting(false)
        }
    }

    // MARK: Timeline

    private var timeline: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Clips").font(.headline)
                Spacer()
                Text(formatTime(project.totalDuration)).font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(project.clips) { clip in
                        Button { selected = clip.id == selected ? nil : clip.id } label: {
                            ZStack(alignment: .bottomLeading) {
                                Group {
                                    if let img = thumbs[clip.id] { Image(uiImage: img).resizable().scaledToFill() } else { Color.lucyPurple.opacity(0.2) }
                                }
                                .frame(width: 72, height: 72)
                                .clipped()
                                Text(formatTime(clip.timelineDuration))
                                    .font(.caption2.bold().monospacedDigit())
                                    .padding(3)
                                    .background(.black.opacity(0.55), in: RoundedRectangle(cornerRadius: 4))
                                    .foregroundStyle(.white)
                                    .padding(4)
                            }
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(clip.id == selected ? Color.lucyPurple : .clear, lineWidth: 3))
                        }
                        .buttonStyle(.plain)
                        .task(id: clip.id) {
                            if thumbs[clip.id] == nil { thumbs[clip.id] = await MediaImporter.thumbnail(for: clip.url, at: clip.trimStart + 0.1) }
                        }
                    }
                    PhotosPicker(selection: $pickerItems, maxSelectionCount: 20, matching: .any(of: [.videos, .images]), photoLibrary: .shared()) {
                        VStack(spacing: 4) {
                            if importing { ProgressView() } else { Image(systemName: "plus").font(.title2.bold()) }
                            Text(importing ? "Adding…" : "Add").font(.caption2.bold())
                        }
                        .frame(width: 72, height: 72)
                        .background(Color.lucyPurple.opacity(0.15), in: RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(Color.lucyPurple)
                    }
                    .disabled(importing)
                    .accessibilityIdentifier("addMedia")
                }
            }
            if !project.clips.isEmpty && selected == nil {
                Text("Tap a clip to trim, speed it up, move or remove it.").font(.caption).foregroundStyle(.secondary)
            }
        }
        .card()
    }

    // MARK: Settings, music, title

    private var settingsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Video").font(.headline)
            Picker("Shape", selection: $project.shape) {
                ForEach(VideoShape.allCases) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
            Toggle("Smooth crossfades between clips", isOn: $project.crossfade)
            TextField("Name", text: $project.name).textFieldStyle(.roundedBorder)
        }
        .card()
    }

    private var musicCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Music").font(.headline)
            if let music = project.music {
                HStack {
                    Label(music.displayName, systemImage: "music.note").lineLimit(1)
                    Spacer()
                    Button(role: .destructive) { project.music = nil } label: { Image(systemName: "trash") }
                }
                HStack {
                    Image(systemName: "speaker.fill").foregroundStyle(.secondary)
                    Slider(value: Binding(get: { music.volume }, set: { project.music?.volume = $0 }), in: 0...1)
                }
                Toggle("Fade in", isOn: Binding(get: { music.fadeIn }, set: { project.music?.fadeIn = $0 }))
                Toggle("Fade out", isOn: Binding(get: { music.fadeOut }, set: { project.music?.fadeOut = $0 }))
            } else {
                Button { showMusicPicker = true } label: { Label("Add music from Files", systemImage: "music.note.list") }
            }
        }
        .card()
    }

    private var titleCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Title").font(.headline)
            TextField("Add a title (optional)", text: Binding(
                get: { project.title?.text ?? "" },
                set: { text in
                    if text.isEmpty { project.title = nil } else if project.title == nil { project.title = TitleOverlay(text: text) } else { project.title?.text = text }
                }
            ))
            .textFieldStyle(.roundedBorder)
            if let title = project.title {
                Picker("Position", selection: Binding(get: { title.position }, set: { project.title?.position = $0 })) {
                    ForEach(TitlePosition.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                Toggle("Show for the whole video", isOn: Binding(get: { title.wholeVideo }, set: { project.title?.wholeVideo = $0 }))
            }
        }
        .card()
    }

    // MARK: Actions

    private func importItems(_ items: [PhotosPickerItem]) async {
        importing = true
        message = nil
        let result = await MediaImporter.clips(from: items)
        project.clips.append(contentsOf: result.clips)
        if result.failed > 0 { message = "\(result.failed) item\(result.failed == 1 ? "" : "s") couldn't be added." }
        pickerItems = []
        importing = false
    }

    private func move(_ i: Int, by offset: Int) {
        let j = i + offset
        guard project.clips.indices.contains(j) else { return }
        project.clips.swapAt(i, j)
    }

    private func duplicate(_ i: Int) {
        var copy = project.clips[i]
        copy.id = UUID()
        project.clips.insert(copy, at: i + 1)
        selected = copy.id
    }

    private func delete(_ i: Int) {
        project.clips.remove(at: i)
        selected = nil
    }

    private func scheduleRebuild(delay: UInt64 = 400_000_000) {
        rebuildTask?.cancel()
        rebuildTask = Task {
            if delay > 0 { try? await Task.sleep(nanoseconds: delay) }
            guard !Task.isCancelled else { return }
            guard !project.clips.isEmpty, let built = try? await CompositionBuilder.build(project) else {
                player.replaceCurrentItem(with: nil)
                return
            }
            let item = AVPlayerItem(asset: built.composition)
            item.videoComposition = built.videoComposition
            item.audioMix = built.audioMix
            player.replaceCurrentItem(with: item)
            // Some devices (and the Simulator) can't play a video composition live.
            // Fall back to the plain timeline so the preview still plays; export is unaffected.
            while item.status == .unknown, !Task.isCancelled { try? await Task.sleep(nanoseconds: 100_000_000) }
            if item.status == .failed, !Task.isCancelled {
                let plain = AVPlayerItem(asset: built.composition)
                plain.audioMix = built.audioMix
                player.replaceCurrentItem(with: plain)
            }
        }
    }
}

struct ClipInspector: View {
    @Binding var clip: Clip
    let onMove: (Int) -> Void
    let onDuplicate: () -> Void
    let onDelete: () -> Void
    private let speeds: [Double] = [0.5, 1, 1.5, 2]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(clip.isPhoto ? "Photo" : "Clip").font(.headline)
                Spacer()
                Text(formatTime(clip.timelineDuration)).font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
            }
            if clip.isPhoto {
                Stepper("Show for \(Int(clip.trimEnd)) s", value: Binding(get: { clip.trimEnd }, set: { clip.trimEnd = min(clip.sourceDuration, max(1, $0)) }), in: 1...clip.sourceDuration, step: 1)
            } else {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Start \(String(format: "%.1f", clip.trimStart)) s").font(.caption).foregroundStyle(.secondary)
                    Slider(value: Binding(get: { clip.trimStart }, set: { clip.trimStart = min($0, clip.trimEnd - 0.3) }), in: 0...max(0.31, clip.sourceDuration))
                    Text("End \(String(format: "%.1f", clip.trimEnd)) s").font(.caption).foregroundStyle(.secondary)
                    Slider(value: Binding(get: { clip.trimEnd }, set: { clip.trimEnd = max($0, clip.trimStart + 0.3) }), in: 0...max(0.31, clip.sourceDuration))
                }
                Picker("Speed", selection: $clip.speed) {
                    ForEach(speeds, id: \.self) { Text($0 == 1 ? "1x" : String(format: "%gx", $0)).tag($0) }
                }
                .pickerStyle(.segmented)
                Toggle("Mute this clip's sound", isOn: $clip.muted)
            }
            HStack {
                Button { onMove(-1) } label: { Label("Earlier", systemImage: "arrow.left") }
                Spacer()
                Button { onMove(1) } label: { Label("Later", systemImage: "arrow.right") }
            }
            HStack {
                Button { onDuplicate() } label: { Label("Duplicate", systemImage: "plus.square.on.square") }
                Spacer()
                Button(role: .destructive) { onDelete() } label: { Label("Remove", systemImage: "trash") }
            }
        }
        .card()
    }
}

struct ExportSheet: View {
    let project: Project
    @StateObject private var exporter = Exporter()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                switch exporter.state {
                case .idle, .rendering:
                    ProgressView(value: exporter.progress) { Text("Making your video…") }
                        .padding(.horizontal)
                    Text("Everything happens on your iPhone. Keep the app open.").font(.footnote).foregroundStyle(.secondary)
                case .done(let url):
                    Image(systemName: "checkmark.circle.fill").font(.system(size: 56)).foregroundStyle(Color.lucyPurple)
                    Text("Your video is ready").font(.title3.bold())
                    Button {
                        Task { await exporter.saveToPhotos(url) }
                    } label: {
                        Label(exporter.savedToPhotos ? "Saved to Photos" : "Save to Photos", systemImage: exporter.savedToPhotos ? "checkmark" : "square.and.arrow.down")
                            .frame(maxWidth: .infinity).padding(.vertical, 14)
                            .background(Color.lucyPurple, in: RoundedRectangle(cornerRadius: 16)).foregroundStyle(.white)
                    }
                    .disabled(exporter.savedToPhotos)
                    ShareLink(item: url) { Label("Share", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity) }
                case .failed(let why):
                    Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 44)).foregroundStyle(.orange)
                    Text(why).multilineTextAlignment(.center)
                    Button("Try again") { Task { await exporter.export(project) } }
                }
            }
            .padding(24)
            .navigationTitle("Export")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
            .task { if exporter.state == .idle { await exporter.export(project) } }
        }
        .presentationDetents([.medium])
    }
}

extension View {
    func card() -> some View {
        padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white.opacity(0.85), in: RoundedRectangle(cornerRadius: 18))
    }
}
