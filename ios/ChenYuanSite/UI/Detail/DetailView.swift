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
            ScrollView { content().padding(.horizontal, SiteSpace.page) }
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
                    Text(summary).siteBodyStyle()
                }
                if let text = item.text, !text.isEmpty, text != item.title, text != item.summary {
                    gap(SiteSpace.paragraph)
                    Text(text).siteBodyStyle()
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
                        label: item.source.platform == "x" ? "在 X 查看原帖" : "查看原链接",
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

    private var videos: [CurationMedia] { media.filter { $0.videoUrl != nil } }
    private var photos: [CurationMedia] { media.filter { $0.videoUrl == nil } }

    var body: some View {
        VStack(spacing: 10) {
            ForEach(Array(videos.enumerated()), id: \.offset) { _, video in
                VideoCard(media: video, source: source)
            }
            if photos.count == 1, let photo = photos.first {
                RemoteImage(url: URL(string: photo.url), contentMode: .fit)
                    .aspectRatio(mediaAspect(photo, fallback: 4.0 / 3.0), contentMode: .fit)
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .background(SiteTheme.line)
                    .accessibilityLabel("图片")
            } else if photos.count > 1 {
                LazyVGrid(columns: [GridItem](repeating: .init(.flexible(), spacing: 6), count: 3), spacing: 6) {
                    ForEach(Array(photos.enumerated()), id: \.offset) { _, photo in
                        RemoteImage(url: URL(string: photo.url))
                            .aspectRatio(1, contentMode: .fit)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                            .background(SiteTheme.line)
                            .accessibilityLabel("图片")
                    }
                }
            }
        }
    }
}

/// 视频卡片：默认展示封面 + 播放圆钮，点击后用 AVPlayer 原生播放。
/// X 平台视频自动经 /api/x-media 代理（MediaURLs.video）。
private struct VideoCard: View {
    let media: CurationMedia
    let source: CurationSource

    @State private var player: AVPlayer?

    var body: some View {
        ZStack {
            if let player {
                VideoPlayer(player: player).clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                RemoteImage(url: URL(string: media.posterURL))
                    .accessibilityLabel("视频封面")
                Button {
                    startPlaying()
                } label: {
                    ZStack {
                        Circle().fill(SiteTheme.glass)
                        Image(systemName: "play.fill").font(.system(size: 24)).foregroundStyle(SiteTheme.ink)
                    }
                    .frame(width: 52, height: 52)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("播放视频")
            }
        }
        .aspectRatio(mediaAspect(media, fallback: 16.0 / 9.0), contentMode: .fit)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .background(SiteTheme.line)
        .onDisappear { player?.pause() }
    }

    private func startPlaying() {
        guard let videoURL = media.videoUrl, let url = MediaURLs.video(platform: source.platform, videoURL: videoURL) else { return }
        let avPlayer = AVPlayer(url: url)
        avPlayer.play()
        player = avPlayer
    }
}
