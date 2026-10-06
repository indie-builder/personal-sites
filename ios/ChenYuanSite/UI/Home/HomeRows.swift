import SwiftUI

/// 每日动态行的导读预览：去标题前缀与起始标点，换行压平为空格。
/// 多段摘要在两行预览里会渲染出空行且截断无省略号，与站点列表 CSS
/// 的空白折叠行为不一致；完整分段导读只在详情页展示。
nonisolated func aiNewsSummaryPreview(title: String, summary: String) -> String {
    var text = summary.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
    if !trimmedTitle.isEmpty, text.hasPrefix(trimmedTitle) { text = String(text.dropFirst(trimmedTitle.count)) }
    // 对应安卓 trimStart(' ', '，', '。', '：', ':', '—', '-', '\n')。
    while let first = text.first, " ，。：:—-\n".contains(first) {
        text.removeFirst()
    }
    return text.split(whereSeparator: \.isWhitespace).joined(separator: " ")
}

/// 每日动态行：无图纯文字（与站点列表一致）：标题、导读、时间与来源。
struct AiNewsRow: View {
    let item: AiNewsItem
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 0) {
                Text(item.title).font(SiteText.title).foregroundStyle(SiteTheme.ink).lineLimit(2).multilineTextAlignment(.leading)
                if !preview.isEmpty { Text(preview).siteSummaryStyle().lineLimit(2).multilineTextAlignment(.leading).padding(.top, SiteSpace.compact) }
                Text(meta).siteMetaStyle().lineLimit(1).padding(.top, SiteSpace.related)
            }
            .listRow(vertical: SiteSpace.item)
        }
        .buttonStyle(SitePressStyle.row)
    }

    private var preview: String { aiNewsSummaryPreview(title: item.title, summary: item.summary) }

    private var meta: String {
        metaLine(feedTimeLabel(item.publishedAt), item.sourceName.isEmpty ? nil : item.sourceName)
    }
}

/// 策展三栏（每日关注 / 设计收藏 / 抖音收藏）共用行：文字 + 右侧缩略图。
struct CurationRow: View {
    let item: CurationItem
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            HStack(alignment: .center, spacing: SiteSpace.paragraph) {
                VStack(alignment: .leading, spacing: SiteSpace.compact) {
                    Text(headline).font(SiteText.listTitle).foregroundStyle(SiteTheme.ink).lineLimit(3).multilineTextAlignment(.leading)
                    Text(meta).siteMetaStyle().lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if let media = item.media.first {
                    DownsampledThumbnail(urlString: media.posterURL, targetSize: CGSize(width: 104, height: 78))
                        .frame(width: 104, height: 78)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .background(SiteTheme.line)
                }
            }
            .listRow(vertical: SiteSpace.paragraph)
        }
        .buttonStyle(SitePressStyle.row)
    }

    /// 行标题：优先 title，回退正文首行（策展条目常无独立标题）。
    private var headline: String {
        if let title = item.title, !title.isEmpty { return title }
        if let text = item.text, let line = text.split(separator: "\n", omittingEmptySubsequences: true).first(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty }) {
            return String(line)
        }
        if let summary = item.summary, !summary.isEmpty { return summary }
        return "（无文字内容）"
    }

    private var meta: String {
        let attachments = item.attachments.prefix(2).joined(separator: "·")
        let author: String? = switch item.source.platform {
        case "x": item.author.handle.isEmpty ? nil : "@\(item.author.handle)"
        case "douyin": item.author.name.isEmpty ? nil : item.author.name
        default: nil
        }
        return metaLine(feedTimeLabel(item.displayTime), attachments.isEmpty ? nil : attachments, author)
    }
}

/// 开源关注行。
struct OpenSourceRow: View {
    let entry: OpenSourceListEntry
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: SiteSpace.compact) {
                Text(entry.repository).font(SiteText.listTitle).foregroundStyle(SiteTheme.ink).lineLimit(1)
                Text(entry.sourceSummary).siteSummaryStyle().lineLimit(2).multilineTextAlignment(.leading)
                Text(meta).siteMetaStyle().lineLimit(1)
                Label("判读与仓库 · 网页阅读", systemImage: "arrow.up.right").siteMetaStyle()
            }
            .listRow(vertical: SiteSpace.paragraph)
        }
        .buttonStyle(SitePressStyle.row)
    }

    private var meta: String {
        metaLine(
            entry.status.isEmpty ? nil : entry.status,
            entry.dimensions.first.map { dimensionLabels[$0] ?? $0 },
            feedTimeLabel(entry.checkedAt),
        )
    }
}
