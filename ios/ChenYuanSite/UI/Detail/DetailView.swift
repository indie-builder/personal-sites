import AVKit
import SwiftUI

/// 详情页路由：按跳转载体分发。每日动态远程取数；策展三栏直接渲染
/// 跳转载体里的完整条目；开源关注做轻原生详情 + 站点外链。
struct DetailRouteView: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.dismiss) private var dismiss
    let onScrollDelta: (CGFloat) -> Void

    var body: some View {
        Group {
            switch env.entryHolder.pending {
            case .aiNews(let id):
                AiNewsDetailScreen(id: id, onScrollDelta: onScrollDelta)
            case .curation(let section, let item):
                CurationDetailScreen(section: section, item: item, onScrollDelta: onScrollDelta)
            case .openSource(let entry):
                OpenSourceDetailScreen(entry: entry, onScrollDelta: onScrollDelta)
            case nil:
                // 载体为空（进程重建）：直接返回列表。
                Color.clear.onAppear { dismiss() }
            }
        }
        .background(SiteTheme.background)
        .toolbar(.hidden, for: .navigationBar)
    }
}

/// 详情页统一外壳：自绘顶栏（返回 + 栏目名，隐藏系统导航栏但保留右滑返回）
/// + 滚动内容 + 底栏滚动联动。
private struct DetailScaffold<Content: View>: View {
    let label: String
    let onScrollDelta: (CGFloat) -> Void
    @ViewBuilder let content: () -> Content

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                BackButton { dismiss() }
                Text(label).font(SiteText.eyebrow).foregroundStyle(SiteTheme.muted)
                Spacer()
            }
            .padding(.horizontal, SiteSpace.compact)
            .padding(.vertical, SiteSpace.micro)
            ScrollView { content().padding(.horizontal, SiteSpace.page).padding(.bottom, SiteSpace.section).textSelection(.enabled) }
                .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.y } action: { old, new in
                    onScrollDelta(new - old)
                }
        }
    }
}

/// 小节：eyebrow 标签 + 正文。
private struct DetailSection: View {
    let eyebrow: String
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: SiteSpace.compact) {
            Text(eyebrow).font(SiteText.eyebrow).foregroundStyle(SiteTheme.quiet)
            Text(text).siteBodyStyle()
        }
    }
}

/// 媒体宽高比：宽高缺失或非法时回退。
private func mediaAspect(_ media: CurationMedia, fallback: CGFloat) -> CGFloat {
    guard let width = media.width, width > 0, let height = media.height, height > 0 else { return fallback }
    return CGFloat(width) / CGFloat(height)
}

// MARK: - 每日动态

/// 每日动态详情：远程取数，失败可重试（attempt 计数与安卓一致）。
private struct AiNewsDetailScreen: View {
    @Environment(AppEnvironment.self) private var env
    let id: String
    let onScrollDelta: (CGFloat) -> Void

    @State private var item: AiNewsItem?
    @State private var error: String?
    @State private var attempt = 0

    var body: some View {
        DetailScaffold(label: "每日动态", onScrollDelta: onScrollDelta) {
            if let item {
                AiNewsDetailBody(item: item).padding(.bottom, SiteSpace.section)
            } else if let error {
                ErrorRetry(message: error) {
                    self.error = nil
                    attempt += 1
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                VStack {
                    Spacer()
                    ProgressView().tint(SiteTheme.muted).controlSize(.small)
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .task(id: attempt) {
            error = nil
            do {
                item = try await env.api.aiNewsDetail(id: id)
            } catch {
                self.error = "暂时无法读取这条每日动态。"
            }
        }
    }
}

private struct AiNewsDetailBody: View {
    @Environment(\.openURL) private var openURL
    let item: AiNewsItem

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            let eyebrow = metaLine(aiNewsCategoryLabel(item.category), item.selected ? "精选" : nil)
            if !eyebrow.isEmpty {
                Text(eyebrow).font(SiteText.eyebrow).foregroundStyle(SiteTheme.quiet)
                gap(SiteSpace.related)
            }
            Text(item.title).font(SiteText.pageTitle).foregroundStyle(SiteTheme.ink).lineSpacing(SiteText.bodyLineSpacing)
            gap(SiteSpace.related)
            Text(metaLine(item.sourceName.isEmpty ? nil : item.sourceName, feedTimeLabel(item.publishedAt))).siteMetaStyle()
            gap(SiteSpace.paragraph)
            Divider().background(SiteTheme.line)
            gap(SiteSpace.paragraph)
            if !item.summary.isEmpty {
                DetailSection(eyebrow: "导读", text: item.summary)
                gap(SiteSpace.paragraph)
            }
            if !item.reason.isEmpty {
                DetailSection(eyebrow: "推荐理由", text: item.reason)
                gap(SiteSpace.paragraph)
            }
            if !item.url.isEmpty {
                SourceCta(label: originalActionLabel(item.url), host: hostOf(item.url)) {
                    if let url = URL(string: item.url) { openURL(url) }
                }
            }
        }
    }
}

// MARK: - 策展三栏

/// 策展三栏详情：直接渲染跳转载体里的完整条目。
private struct CurationDetailScreen: View {
    @Environment(\.openURL) private var openURL
    let section: Section
    let item: CurationItem
    let onScrollDelta: (CGFloat) -> Void

    var body: some View {
        DetailScaffold(label: section.label, onScrollDelta: onScrollDelta) {
            VStack(alignment: .leading, spacing: 0) {
                Text(metaLine(authorLabel, feedTimeLabel(item.displayTime))).siteMetaStyle()
                if let title = item.title, !title.isEmpty {
                    gap(SiteSpace.related)
                    Text(title).font(SiteText.pageTitle).foregroundStyle(SiteTheme.ink).lineSpacing(SiteText.bodyLineSpacing)
                }
                if let summary = item.summary, !summary.isEmpty, summary != item.title {
                    gap(SiteSpace.related)
                    DetailSection(eyebrow: "导读", text: summary)
                }
                if let text = item.text, !text.isEmpty, text != item.title, text != item.summary {
                    gap(SiteSpace.paragraph)
                    DetailSection(eyebrow: "原帖", text: text)
                }
                if !item.media.isEmpty {
                    gap(SiteSpace.paragraph)
                    CurationMediaSection(media: item.media, source: item.source)
                }
                if !item.tags.isEmpty {
                    gap(SiteSpace.paragraph)
                    Text(item.tags.map { "#\($0)" }.joined(separator: " ")).siteMetaStyle()
                }
                if !item.source.url.isEmpty {
                    gap(SiteSpace.item)
                    SourceCta(
                        label: item.source.platform == "x" ? "在 X 查看原帖" : item.source.platform == "douyin" ? "在抖音观看" : "查看原链接",
                        host: hostOf(item.source.url),
                    ) {
                        if let url = URL(string: item.source.url) { openURL(url) }
                    }
                }
                gap(SiteSpace.section)
            }
        }
    }

    private var authorLabel: String? {
        switch item.source.platform {
        case "x": item.author.handle.isEmpty ? nil : "@\(item.author.handle)"
        case "douyin": item.author.name.isEmpty ? nil : item.author.name
        default: item.source.label.isEmpty ? nil : item.source.label
        }
    }
}

// MARK: - 开源关注

/// 开源关注轻详情 + 站点外链。
private struct OpenSourceDetailScreen: View {
    @Environment(\.openURL) private var openURL
    let entry: OpenSourceListEntry
    let onScrollDelta: (CGFloat) -> Void

    var body: some View {
        DetailScaffold(label: "开源关注", onScrollDelta: onScrollDelta) {
            VStack(alignment: .leading, spacing: 0) {
                Text(metaLine(entry.status.isEmpty ? nil : entry.status, entry.type.isEmpty ? nil : entry.type))
                    .font(SiteText.eyebrow).foregroundStyle(SiteTheme.quiet)
                gap(SiteSpace.related)
                Text(entry.repository).font(SiteText.pageTitle).foregroundStyle(SiteTheme.ink)
                if !entry.dimensions.isEmpty {
                    gap(SiteSpace.related)
                    Text(entry.dimensions.map { dimensionLabels[$0] ?? $0 }.joined(separator: " · ")).siteMetaStyle()
                }
                gap(SiteSpace.paragraph)
                Divider().background(SiteTheme.line)
                gap(SiteSpace.paragraph)
                DetailSection(eyebrow: "摘要", text: entry.sourceSummary)
                gap(SiteSpace.item)
                SourceCta(label: "在站点查看判读与仓库", host: "default-coder.lovemyrmb.cn") {
                    let slug = entry.slug.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? entry.slug
                    openURL(SiteAPI.url("/open-source/\(slug)"))
                }
                gap(SiteSpace.section)
            }
        }
    }
}

// MARK: - 策展媒体

/// 策展媒体的展示：视频逐个播放卡，图片 1 张整宽、多张三列方格。
/// 媒体数组对本视图生命周期不可变（来自跳转载体），位置键即稳定身份。
private struct CurationMediaSection: View {
    let media: [CurationMedia]
    let source: CurationSource

    @State private var selectedPhoto: CurationMedia?

    private var videos: [CurationMedia] { media.filter { $0.videoUrl != nil } }
    private var photos: [CurationMedia] { media.filter { $0.videoUrl == nil } }

    var body: some View {
        VStack(spacing: 10) {
            ForEach(Array(videos.enumerated()), id: \.offset) { _, video in
                VideoCard(media: video, source: source)
            }
            if photos.count == 1, let photo = photos.first {
                photoButton(photo, contentMode: .fit)
                    .aspectRatio(mediaAspect(photo, fallback: 4.0 / 3.0), contentMode: .fit)
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .background(SiteTheme.line)

            } else if photos.count > 1 {
                LazyVGrid(columns: [GridItem](repeating: .init(.flexible(), spacing: 6), count: 3), spacing: 6) {
                    ForEach(Array(photos.enumerated()), id: \.offset) { _, photo in
                        photoButton(photo)
                            .aspectRatio(1, contentMode: .fit)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                            .background(SiteTheme.line)

                    }
                }
            }
        }
        .fullScreenCover(item: $selectedPhoto) { photo in
            PhotoReader(urlString: photo.url)
        }
    }

    private func photoButton(_ photo: CurationMedia, contentMode: ContentMode = .fill) -> some View {
        Button { selectedPhoto = photo } label: {
            RemoteImage(url: URL(string: photo.url), contentMode: contentMode)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("全屏查看图片")
        .accessibilityHint("支持双击和双指缩放")
        .accessibilityIdentifier("detail-photo")
    }
}

/// 视频卡片：默认展示封面 + 播放圆钮，点击后用 AVPlayer 原生播放；
/// 加载失败转入错误态可重试（状态机见 VideoPlayerModel）。
/// X 平台视频自动经 /api/x-media 代理（MediaURLs.video）。
private struct VideoCard: View {
    let media: CurationMedia
    let source: CurationSource

    @State private var playback = VideoPlayerModel()

    var body: some View {
        ZStack {
            switch playback.phase {
            case .idle:
                RemoteImage(url: URL(string: media.posterURL))
                    .accessibilityLabel("视频封面")
                Button {
                    if let videoURL { playback.play(url: videoURL) }
                } label: {
                    ZStack {
                        Circle().fill(SiteTheme.glass)
                        Image(systemName: "play.fill").font(.system(size: 24)).foregroundStyle(SiteTheme.ink)
                    }
                    .frame(width: 52, height: 52)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("播放视频")
            case .playing(let player):
                VideoPlayer(player: player).clipShape(RoundedRectangle(cornerRadius: 8))
            case .failed:
                ErrorRetry(message: "视频暂时无法播放。") { playback.retry() }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .aspectRatio(mediaAspect(media, fallback: 16.0 / 9.0), contentMode: .fit)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .background(SiteTheme.line)
        .onDisappear { playback.pause() }
    }

    private var videoURL: URL? {
        media.videoUrl.flatMap { MediaURLs.video(platform: source.platform, videoURL: $0) }
    }
}


/// 原生滚动缩放承载图片；全屏呈现不销毁详情列表的阅读位置。
struct PhotoReader: View {
    let urlString: String
    @Environment(\.dismiss) private var dismiss
    @State private var image: UIImage?
    @State private var failed = false
    @State private var attempt = 0

    var body: some View {
        NavigationStack {
            Group {
                if let image {
                    ZoomablePhoto(image: image)
                        .accessibilityLabel("图片，双指缩放或双击放大")
                } else if failed {
                    ErrorRetry(message: "图片暂时无法加载。") { attempt += 1 }
                } else {
                    ProgressView("正在加载图片…")
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(SiteTheme.background)
            .navigationTitle("查看图片")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                        .accessibilityIdentifier("photo-close")
                }
            }
            .task(id: attempt) {
                failed = false
                guard let url = URL(string: urlString) else { failed = true; return }
                image = await ThumbnailDecoder.decode(url: url, maxPixelSize: 4096)
                failed = image == nil
            }
        }
    }
}

private struct ZoomablePhoto: UIViewRepresentable {
    let image: UIImage

    func makeUIView(context: Context) -> PhotoScrollView {
        let view = PhotoScrollView()
        view.photo.image = image
        return view
    }

    func updateUIView(_ view: PhotoScrollView, context: Context) {}
}

private final class PhotoScrollView: UIScrollView, UIScrollViewDelegate {
    let photo = UIImageView()
    private var previousSize = CGSize.zero

    override init(frame: CGRect) {
        super.init(frame: frame)
        delegate = self
        minimumZoomScale = 1
        maximumZoomScale = 5
        bouncesZoom = true
        showsHorizontalScrollIndicator = false
        showsVerticalScrollIndicator = false
        photo.contentMode = .scaleAspectFit
        addSubview(photo)
        let doubleTap = UITapGestureRecognizer(target: self, action: #selector(toggleZoom(_:)))
        doubleTap.numberOfTapsRequired = 2
        addGestureRecognizer(doubleTap)
        accessibilityCustomActions = [
            UIAccessibilityCustomAction(name: "放大图片", target: self, selector: #selector(accessibleZoomIn)),
            UIAccessibilityCustomAction(name: "还原图片", target: self, selector: #selector(accessibleZoomOut)),
        ]
        isAccessibilityElement = true
        accessibilityLabel = "图片"
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        if bounds.size != previousSize {
            previousSize = bounds.size
            setZoomScale(1, animated: false)
            photo.frame = CGRect(origin: .zero, size: bounds.size)
            contentSize = bounds.size
        }
    }

    func viewForZooming(in scrollView: UIScrollView) -> UIView? { photo }

    @objc private func toggleZoom(_ recognizer: UITapGestureRecognizer) {
        let animated = !UIAccessibility.isReduceMotionEnabled
        if zoomScale > 1 { setZoomScale(1, animated: animated) }
        else {
            let point = recognizer.location(in: photo)
            let size = CGSize(width: bounds.width / 3, height: bounds.height / 3)
            zoom(to: CGRect(x: point.x - size.width / 2, y: point.y - size.height / 2,
                            width: size.width, height: size.height), animated: animated)
        }
    }

    @objc private func accessibleZoomIn() -> Bool {
        setZoomScale(min(zoomScale + 1, maximumZoomScale), animated: !UIAccessibility.isReduceMotionEnabled)
        return true
    }

    @objc private func accessibleZoomOut() -> Bool {
        setZoomScale(1, animated: !UIAccessibility.isReduceMotionEnabled)
        return true
    }
}
