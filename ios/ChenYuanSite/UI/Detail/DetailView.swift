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

/// 自绘顶栏：返回 + 栏目名（隐藏系统导航栏，保留边缘右滑返回手势）。
private struct DetailTopBar: View {
    let label: String
    let onBack: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            Button(action: onBack) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(SiteTheme.ink)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("返回")
            Text(label)
                .font(SiteText.eyebrow)
                .foregroundStyle(SiteTheme.muted)
            Spacer()
        }
        .padding(.horizontal, SiteSpace.compact)
        .padding(.vertical, SiteSpace.micro)
    }
}

/// 每日动态详情：远程取数，失败可重试（attempt 计数与安卓一致）。
private struct AiNewsDetailScreen: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    let id: String
    let onScrollDelta: (CGFloat) -> Void

    @State private var item: AiNewsItem?
    @State private var error: String?
    @State private var attempt = 0

    var body: some View {
        VStack(spacing: 0) {
            DetailTopBar(label: "每日动态") { dismiss() }
            if let item {
                ScrollView {
                    AiNewsDetailBody(item: item)
                        .padding(.bottom, SiteSpace.section)
                }
                .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.y } action: { old, new in
                    onScrollDelta(new - old)
                }
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

    private var eyebrow: String {
        var parts: [String] = [aiNewsCategoryLabel(item.category)]
        if item.selected { parts.append("精选") }
        return parts.joined(separator: " · ")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if !eyebrow.isEmpty {
                Text(eyebrow).font(SiteText.eyebrow).foregroundStyle(SiteTheme.quiet)
                Spacer().frame(height: SiteSpace.related)
            }
            Text(item.title)
                .font(SiteText.pageTitle)
                .foregroundStyle(SiteTheme.ink)
                .lineSpacing(SiteText.bodyLineSpacing)
            Spacer().frame(height: SiteSpace.related)
            Text(
                [item.sourceName.isEmpty ? nil : item.sourceName, feedTimeLabel(item.publishedAt)]
                    .compactMap { $0 }
                    .joined(separator: " · "),
            )
            .siteMetaStyle()
            Spacer().frame(height: SiteSpace.paragraph)
            Divider().background(SiteTheme.line)
            Spacer().frame(height: SiteSpace.paragraph)
            if !item.summary.isEmpty {
                DetailSection(eyebrow: "导读", text: item.summary)
                Spacer().frame(height: SiteSpace.paragraph)
            }
            if !item.reason.isEmpty {
                DetailSection(eyebrow: "推荐理由", text: item.reason)
                Spacer().frame(height: SiteSpace.paragraph)
            }
            if !item.url.isEmpty {
                SourceCta(label: originalActionLabel(item.url), host: hostOf(item.url)) {
                    if let url = URL(string: item.url) { openURL(url) }
                }
            }
        }
        .padding(.horizontal, SiteSpace.page)
    }
}

/// 策展三栏详情：直接渲染跳转载体里的完整条目。
private struct CurationDetailScreen: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    let section: Section
    let item: CurationItem
    let onScrollDelta: (CGFloat) -> Void

    var body: some View {
        VStack(spacing: 0) {
            DetailTopBar(label: section.label) { dismiss() }
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    let authorLabel: String? = {
                        switch item.source.platform {
                        case "x": return item.author.handle.isEmpty ? nil : "@\(item.author.handle)"
                        case "douyin": return item.author.name.isEmpty ? nil : item.author.name
                        default: return item.source.label.isEmpty ? nil : item.source.label
                        }
                    }()
                    Text(
                        [authorLabel, feedTimeLabel(item.displayTime)]
                            .compactMap { $0 }
                            .joined(separator: " · "),
                    )
                    .siteMetaStyle()
                    if let headline = item.title, !headline.isEmpty {
                        Spacer().frame(height: SiteSpace.related)
                        Text(headline)
                            .font(SiteText.pageTitle)
                            .foregroundStyle(SiteTheme.ink)
                            .lineSpacing(SiteText.bodyLineSpacing)
                    }
                    if let summary = item.summary, !summary.isEmpty, summary != item.title {
                        Spacer().frame(height: SiteSpace.related)
                        Text(summary).siteBodyStyle()
                    }
                    if let text = item.text, !text.isEmpty, text != item.title, text != item.summary {
                        Spacer().frame(height: SiteSpace.paragraph)
                        Text(text).siteBodyStyle()
                    }
                    if !item.media.isEmpty {
                        Spacer().frame(height: SiteSpace.paragraph)
                        CurationMediaSection(media: item.media, source: item.source)
                    }
                    if !item.tags.isEmpty {
                        Spacer().frame(height: SiteSpace.paragraph)
                        Text(item.tags.map { "#\($0)" }.joined(separator: " "))
                            .siteMetaStyle()
                    }
                    if !item.source.url.isEmpty {
                        Spacer().frame(height: SiteSpace.item)
                        SourceCta(
                            label: item.source.platform == "x" ? "在 X 查看原帖" : "查看原链接",
                            host: hostOf(item.source.url),
                        ) {
                            if let url = URL(string: item.source.url) { openURL(url) }
                        }
                    }
                    Spacer().frame(height: SiteSpace.section)
                }
                .padding(.horizontal, SiteSpace.page)
            }
            .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.y } action: { old, new in
                onScrollDelta(new - old)
            }
        }
    }
}

/// 开源关注轻详情 + 站点外链。
private struct OpenSourceDetailScreen: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    let entry: OpenSourceListEntry
    let onScrollDelta: (CGFloat) -> Void

    var body: some View {
        VStack(spacing: 0) {
            DetailTopBar(label: "开源关注") { dismiss() }
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text(
                        [entry.status.isEmpty ? nil : entry.status, entry.type.isEmpty ? nil : entry.type]
                            .compactMap { $0 }
                            .joined(separator: " · "),
                    )
                    .font(SiteText.eyebrow)
                    .foregroundStyle(SiteTheme.quiet)
                    Spacer().frame(height: SiteSpace.related)
                    Text(entry.repository)
                        .font(SiteText.pageTitle)
                        .foregroundStyle(SiteTheme.ink)
                    if !entry.dimensions.isEmpty {
                        Spacer().frame(height: SiteSpace.related)
                        Text(entry.dimensions.map { dimensionLabels[$0] ?? $0 }.joined(separator: " · "))
                            .siteMetaStyle()
                    }
                    Spacer().frame(height: SiteSpace.paragraph)
                    Divider().background(SiteTheme.line)
                    Spacer().frame(height: SiteSpace.paragraph)
                    DetailSection(eyebrow: "摘要", text: entry.sourceSummary)
                    Spacer().frame(height: SiteSpace.item)
                    SourceCta(label: "在站点查看判读与仓库", host: "default-coder.lovemyrmb.cn") {
                        let encoded = entry.slug.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? entry.slug
                        openURL(MediaURLs.sitePage("/open-source/\(encoded)"))
                    }
                    Spacer().frame(height: SiteSpace.section)
                }
                .padding(.horizontal, SiteSpace.page)
            }
            .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.y } action: { old, new in
                onScrollDelta(new - old)
            }
        }
    }
}

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

/// 策展媒体的展示：视频逐个播放卡，图片 1 张整宽、多张三列方格。
/// 媒体数组对本视图生命周期不可变（来自跳转载体），位置键即稳定身份。
private struct CurationMediaSection: View {
    let media: [CurationMedia]
    let source: CurationSource

    private var videos: [CurationMedia] { media.filter { $0.videoUrl != nil } }
    private var photos: [CurationMedia] { media.filter { $0.videoUrl == nil } }

    var body: some View {
        VStack(spacing: 10) {
            // 与安卓 forEach 语义一致按位置标识：服务端同一媒体 URL 重复时
            // （CurationMedia.id = url）不会产生重复 ForEach 身份。
            ForEach(Array(videos.enumerated()), id: \.offset) { _, video in
                VideoCard(media: video, source: source)
            }
            if photos.count == 1, let photo = photos.first {
                let aspect = photoAspect(photo, fallback: 4.0 / 3.0)
                AsyncImage(url: URL(string: photo.url)) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFit()
                    } else {
                        SiteTheme.line
                    }
                }
                .aspectRatio(aspect, contentMode: .fit)
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .background(SiteTheme.line)
                .accessibilityLabel("图片")
            } else if photos.count > 1 {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)], spacing: 6) {
                    ForEach(Array(photos.enumerated()), id: \.offset) { _, photo in
                        AsyncImage(url: URL(string: photo.url)) { phase in
                            if let image = phase.image {
                                image.resizable().scaledToFill()
                            } else {
                                SiteTheme.line
                            }
                        }
                        .aspectRatio(1, contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                        .background(SiteTheme.line)
                        .accessibilityLabel("图片")
                    }
                }
            }
        }
    }

    private func photoAspect(_ photo: CurationMedia, fallback: CGFloat) -> CGFloat {
        guard let width = photo.width, width > 0, let height = photo.height, height > 0 else { return fallback }
        return CGFloat(width) / CGFloat(height)
    }
}

/// 视频卡片：默认展示封面 + 播放圆钮，点击后用 AVPlayer 原生播放。
/// X 平台视频自动经 /api/x-media 代理（MediaURLs.video）。
struct VideoCard: View {
    let media: CurationMedia
    let source: CurationSource

    @State private var player: AVPlayer?

    private var aspect: CGFloat {
        guard let width = media.width, width > 0, let height = media.height, height > 0 else { return 16.0 / 9.0 }
        return CGFloat(width) / CGFloat(height)
    }

    var body: some View {
        ZStack {
            if let player {
                VideoPlayer(player: player)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                AsyncImage(url: URL(string: media.posterURL)) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        SiteTheme.line
                    }
                }
                .accessibilityLabel("视频封面")
                Button {
                    startPlaying()
                } label: {
                    ZStack {
                        Circle().fill(SiteTheme.glass)
                        Image(systemName: "play.fill")
                            .font(.system(size: 24))
                            .foregroundStyle(SiteTheme.ink)
                    }
                    .frame(width: 52, height: 52)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("播放视频")
            }
        }
        .aspectRatio(aspect, contentMode: .fit)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .background(SiteTheme.line)
        .onDisappear { player?.pause() }
    }

    private func startPlaying() {
        guard
            let videoURL = media.videoUrl,
            let url = MediaURLs.video(platform: source.platform, videoURL: videoURL)
        else { return }
        let avPlayer = AVPlayer(url: url)
        avPlayer.play()
        player = avPlayer
    }
}
