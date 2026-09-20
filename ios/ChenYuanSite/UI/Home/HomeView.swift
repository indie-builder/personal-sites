import SwiftUI

/// 首页：顶部栏目导航 + 横向翻页 + 五类信息流（首屏加载、下拉刷新、触底追加、失败重试）。
struct HomeView: View {
    @Environment(AppEnvironment.self) private var env
    @Binding var selectedSection: Int
    let bottomBarPadding: CGFloat
    let onScrollDelta: (CGFloat) -> Void
    let onOpenDetail: (DetailEntry) -> Void

    var body: some View {
        VStack(spacing: 0) {
            SectionTabs(selectedIndex: selectedSection) { index in
                withAnimation(.easeOut(duration: 0.22)) { selectedSection = index }
            }
            TabView(selection: $selectedSection) {
                FeedPageUI(
                    feed: env.homeModel.aiNews,
                    section: .aiNews,
                    bottomPadding: bottomBarPadding,
                    onScrollDelta: onScrollDelta,
                ) { news in
                    AiNewsRow(item: news) { onOpenDetail(.aiNews(news.id)) }
                }
                .tag(Section.aiNews.index)
                FeedPageUI(
                    feed: env.homeModel.curation,
                    section: .curation,
                    bottomPadding: bottomBarPadding,
                    onScrollDelta: onScrollDelta,
                ) { item in
                    CurationRow(item: item) { onOpenDetail(.curation(.curation, item)) }
                }
                .tag(Section.curation.index)
                FeedPageUI(
                    feed: env.homeModel.design,
                    section: .design,
                    bottomPadding: bottomBarPadding,
                    onScrollDelta: onScrollDelta,
                ) { item in
                    CurationRow(item: item) { onOpenDetail(.curation(.design, item)) }
                }
                .tag(Section.design.index)
                FeedPageUI(
                    feed: env.homeModel.douyin,
                    section: .douyin,
                    bottomPadding: bottomBarPadding,
                    onScrollDelta: onScrollDelta,
                ) { item in
                    CurationRow(item: item) { onOpenDetail(.curation(.douyin, item)) }
                }
                .tag(Section.douyin.index)
                FeedPageUI(
                    feed: env.homeModel.openSource,
                    section: .openSource,
                    bottomPadding: bottomBarPadding,
                    onScrollDelta: onScrollDelta,
                ) { entry in
                    OpenSourceRow(entry: entry) { onOpenDetail(.openSource(entry)) }
                }
                .tag(Section.openSource.index)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
        .background(SiteTheme.background)
    }
}

/// 顶部栏目导航：头像 + 横向滚动、单色文字 + 短下划线。
private struct SectionTabs: View {
    let selectedIndex: Int
    let onSelectIndex: (Int) -> Void

    @Namespace private var underline

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .center, spacing: 0) {
                    Image("profile_avatar")
                        .resizable()
                        .scaledToFill()
                        .frame(width: 32, height: 32)
                        .clipShape(Circle())
                        .padding(.leading, SiteSpace.paragraph)
                        .padding(.trailing, SiteSpace.micro)
                        .accessibilityLabel("陈远的头像")
                    ForEach(Section.allCases) { section in
                        let selected = section.index == selectedIndex
                        Button {
                            onSelectIndex(section.index)
                        } label: {
                            VStack(spacing: 5) {
                                Text(section.label)
                                    .font(selected ? SiteText.tabSelected : SiteText.tab)
                                    .foregroundStyle(selected ? SiteTheme.ink : SiteTheme.muted)
                                    .padding(.horizontal, 14)
                                Group {
                                    if selected {
                                        Capsule()
                                            .fill(SiteTheme.ink)
                                            .frame(height: 2)
                                            .matchedGeometryEffect(id: "tab-underline", in: underline)
                                    } else {
                                        Color.clear.frame(height: 2)
                                    }
                                }
                            }
                            .padding(.vertical, 13)
                            .frame(minHeight: SiteSpace.touch)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
                        .accessibilityIdentifier("home-tab-\(section.id)")
                        .id(section.index)
                    }
                }
            }
            .onChange(of: selectedIndex) { _, newValue in
                withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo(newValue, anchor: .center) }
            }
        }
    }
}

/// 单个栏目的信息流：首屏加载、下拉刷新、触底追加、失败重试。
private struct FeedPageUI<Value: Identifiable, Row: View>: View {
    let feed: PagedFeed<Value>
    let section: Section
    let bottomPadding: CGFloat
    let onScrollDelta: (CGFloat) -> Void
    @ViewBuilder let row: (Value) -> Row

    var body: some View {
        Group {
            if feed.state.initial {
                VStack {
                    Spacer()
                    ProgressView()
                        .tint(SiteTheme.muted)
                        .controlSize(.small)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
                .task { feed.loadInitial() }
            } else if let error = feed.state.error, feed.state.items.isEmpty {
                ScrollView {
                    ErrorRetry(message: error) { feed.retry() }
                        .frame(minHeight: 420)
                }
            } else {
                feedList
            }
        }
    }

    private var feedList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(feed.state.items) { item in
                    row(item)
                    HorizontalRule()
                }
                FeedFooter(
                    loadingMore: feed.state.loadingMore,
                    error: feed.state.error,
                    hasMore: feed.state.hasMore,
                    isEmpty: feed.state.items.isEmpty,
                ) { feed.retry() }
                .onAppear {
                    if feed.state.hasMore { feed.loadMore() }
                }
            }
            .padding(.bottom, bottomPadding)
        }
        .refreshable { await feed.refreshAndWait() }
        .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.y } action: { old, new in
            onScrollDelta(new - old)
        }
    }
}

/// 页脚：追加转圈 / 失败重试 / 到底三态。
private struct FeedFooter: View {
    let loadingMore: Bool
    let error: String?
    let hasMore: Bool
    let isEmpty: Bool
    let onRetry: () -> Void

    var body: some View {
        if loadingMore {
            HStack {
                ProgressView()
                    .tint(SiteTheme.muted)
                    .controlSize(.small)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 18)
        } else if let error {
            ErrorRetry(message: error, onRetry: onRetry)
        } else if !hasMore, !isEmpty {
            Text("已经到底了")
                .siteMetaStyle()
                .frame(maxWidth: .infinity)
                .padding(.vertical, 18)
        }
    }
}

/// 每日动态行的导读预览：去标题前缀与起始标点，换行压平为空格。
/// 多段摘要在两行预览里会渲染出空行且截断无省略号，与站点列表 CSS
/// 的空白折叠行为不一致；完整分段导读只在详情页展示。
nonisolated func aiNewsSummaryPreview(title: String, summary: String) -> String {
    var text = summary.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
    if !trimmedTitle.isEmpty, text.hasPrefix(trimmedTitle) {
        text = String(text.dropFirst(trimmedTitle.count))
    }
    // 对应安卓 trimStart(' ', '，', '。', '：', ':', '—', '-', '\n')。
    while let first = text.first, " ，。：:—-\n".contains(first) {
        text.removeFirst()
    }
    return text.split(whereSeparator: \.isWhitespace).joined(separator: " ")
}

/// 每日动态行：无图纯文字（与站点列表一致）：标题、导读、时间与来源。
private struct AiNewsRow: View {
    let item: AiNewsListItem
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 0) {
                Text(item.title)
                    .font(SiteText.title)
                    .foregroundStyle(SiteTheme.ink)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                if !summary.isEmpty {
                    Spacer().frame(height: SiteSpace.compact)
                    Text(summary)
                        .siteSummaryStyle()
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                Spacer().frame(height: SiteSpace.related)
                Text(meta)
                    .siteMetaStyle()
                    .lineLimit(1)
            }
            .padding(.horizontal, SiteSpace.page)
            .padding(.vertical, SiteSpace.item)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isButton)
    }

    private var summary: String {
        aiNewsSummaryPreview(title: item.title, summary: item.summary)
    }

    private var meta: String {
        [feedTimeLabel(item.publishedAt), item.sourceName.isEmpty ? nil : item.sourceName]
            .compactMap { $0 }
            .joined(separator: " · ")
    }
}

/// 策展三栏（每日关注 / 设计收藏 / 抖音收藏）共用行：文字 + 右侧缩略图。
private struct CurationRow: View {
    let item: CurationItem
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            HStack(alignment: .center, spacing: SiteSpace.paragraph) {
                VStack(alignment: .leading, spacing: SiteSpace.compact) {
                    Text(headline)
                        .font(SiteText.listTitle)
                        .foregroundStyle(SiteTheme.ink)
                        .lineLimit(3)
                        .multilineTextAlignment(.leading)
                    Text(meta)
                        .siteMetaStyle()
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if let media = item.media.first {
                    DownsampledThumbnail(urlString: media.posterURL, targetSize: CGSize(width: 104, height: 78))
                        .frame(width: 104, height: 78)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .background(SiteTheme.line)
                }
            }
            .padding(.horizontal, SiteSpace.page)
            .padding(.vertical, SiteSpace.paragraph)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isButton)
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
        var parts: [String?] = [feedTimeLabel(item.displayTime)]
        let attachmentPrefix = item.attachments.prefix(2).joined(separator: "·")
        parts.append(attachmentPrefix.isEmpty ? nil : attachmentPrefix)
        switch item.source.platform {
        case "x": parts.append(item.author.handle.isEmpty ? nil : "@\(item.author.handle)")
        case "douyin": parts.append(item.author.name.isEmpty ? nil : item.author.name)
        default: parts.append(nil)
        }
        return parts.compactMap { $0 }.joined(separator: " · ")
    }
}

/// 开源关注行。
private struct OpenSourceRow: View {
    let entry: OpenSourceListEntry
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: SiteSpace.compact) {
                Text(entry.repository)
                    .font(SiteText.listTitle)
                    .foregroundStyle(SiteTheme.ink)
                    .lineLimit(1)
                Text(entry.sourceSummary)
                    .siteSummaryStyle()
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Text(meta)
                    .siteMetaStyle()
                    .lineLimit(1)
            }
            .padding(.horizontal, SiteSpace.page)
            .padding(.vertical, SiteSpace.paragraph)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isButton)
    }

    private var meta: String {
        [
            entry.status.isEmpty ? nil : entry.status,
            entry.dimensions.first.map { dimensionLabels[$0] ?? $0 },
            feedTimeLabel(entry.checkedAt),
        ].compactMap { $0 }.joined(separator: " · ")
    }
}
