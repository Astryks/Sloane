import SwiftUI

@main
struct LucyEditorApp: App {
    @StateObject private var store = ProjectStore()

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environmentObject(store)
                .tint(.lucyPurple)
        }
    }
}

struct HomeView: View {
    @EnvironmentObject private var store: ProjectStore
    @State private var path: [UUID] = []

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Lucy Editor")
                            .font(.system(size: 34, weight: .heavy, design: .rounded))
                            .foregroundStyle(Color.lucyInk)
                        Text("Free. No watermark. Nothing uploaded.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    Button {
                        guard path.isEmpty else { return }
                        let p = store.create()
                        path.append(p.id)
                    } label: {
                        Label("New video", systemImage: "plus.circle.fill")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color.lucyPurple, in: RoundedRectangle(cornerRadius: 18))
                            .foregroundStyle(.white)
                    }
                    .accessibilityIdentifier("newVideo")

                    if store.projects.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("How it works").font(.headline)
                            step("1", "Add videos and photos from your library")
                            step("2", "Trim, reorder, speed up, add music and a title")
                            step("3", "Export and save to Photos - everything stays on your iPhone")
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(Color.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 18))
                    } else {
                        Text("Your videos").font(.headline)
                        ForEach(store.projects) { p in
                            NavigationLink(value: p.id) { ProjectRow(project: p) }
                                .buttonStyle(.plain)
                                .contextMenu {
                                    Button(role: .destructive) { store.delete(p) } label: { Label("Delete", systemImage: "trash") }
                                }
                        }
                    }
                }
                .padding(20)
            }
            .background(Color.lucyCream.ignoresSafeArea())
            .navigationDestination(for: UUID.self) { id in
                if let p = store.projects.first(where: { $0.id == id }) {
                    EditorView(project: p)
                }
            }
        }
    }

    private func step(_ n: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(n).font(.caption.bold()).foregroundStyle(.white)
                .frame(width: 22, height: 22).background(Color.lucyPurple, in: Circle())
            Text(text).font(.subheadline).foregroundStyle(Color.lucyInk)
        }
    }
}

struct ProjectRow: View {
    let project: Project
    @State private var thumb: UIImage?

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 12).fill(Color.lucyPurple.opacity(0.15))
                if let thumb {
                    Image(uiImage: thumb).resizable().scaledToFill()
                } else {
                    Image(systemName: "film").foregroundStyle(Color.lucyPurple)
                }
            }
            .frame(width: 64, height: 64)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            VStack(alignment: .leading, spacing: 4) {
                Text(project.name).font(.headline).foregroundStyle(Color.lucyInk)
                Text("\(project.clips.count) clip\(project.clips.count == 1 ? "" : "s") · \(formatTime(project.totalDuration)) · \(project.shape.label)")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(.tertiary)
        }
        .padding(12)
        .background(Color.white.opacity(0.85), in: RoundedRectangle(cornerRadius: 16))
        .task(id: project.clips.first?.id) {
            if let first = project.clips.first { thumb = await MediaImporter.thumbnail(for: first.url) }
        }
    }
}

func formatTime(_ seconds: Double) -> String {
    let s = Int(seconds.rounded())
    return String(format: "%d:%02d", s / 60, s % 60)
}
