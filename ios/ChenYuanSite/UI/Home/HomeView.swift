import SwiftUI

/// 首页：顶部栏目导航 + 横向翻页 + 五类信息流（首屏加载、下拉刷新、触底追加、失败重试）。
struct HomeView: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding var selectedSection: Section
    let bottomBarPadding: CGFloat
    let onScrollDelta: (CGFloat) -> Void
    let onOpenDetail: (DetailEntry) -> Void

    var body: some View {
        VStack(spacing: 0) {
            SectionTabs(selected: selectedSection) { section in
                withAnimation(reduceMotion ? nil : .easeOut(duration: 0.22)) { selectedSection = section }
            }
            TabView(selection: $selectedSection) {
                ForEach(Section.allCases) { page($0).tag($0) }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
        .background(SiteTheme.background)
    }

    @ViewBuilder
    private func page(_ section: Section) -> some View {
        switch section {
        case .aiNews:
            FeedPageUI(feed: env.homeModel.aiNews, section: section, bottomPadding: bottomBarPadding, onScrollDelta: onScrollDelta) { item in
                AiNewsRow(item: item) { onOpenDetail(.aiNews(item.id)) }
            }
        case .openSource:
            FeedPageUI(feed: env.homeModel.openSource, section: section, bottomPadding: bottomBarPadding, onScrollDelta: onScrollDelta) { entry in
                OpenSourceRow(entry: entry) { onOpenDetail(.openSource(entry)) }
            }
        default:
            // 策展三栏（每日关注 / 设计收藏 / 抖音收藏）共用 CurationItem 行。
            FeedPageUI(feed: env.homeModel.curated(section), section: section, bottomPadding: bottomBarPadding, onScrollDelta: onScrollDelta) { item in
                CurationRow(item: item) { onOpenDetail(.curation(section, item)) }
            }
        }
    }
}

/// 策展三栏共用的分页器查表。
extension HomeModel {
    func curated(_ section: Section) -> PagedFeed<CurationItem> {
        switch section {
        case .curation: curation
        case .design: design
        default: douyin
        }
    }
}

/// 单行页头：左侧固定身份区块，右侧栏目独立横滚；下划线不参与文字对齐。
private struct SectionTabs: View {
    let selected: Section
    let onSelect: (Section) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Namespace private var underline

    var body: some View {
        HStack(spacing: 0) {
            ProfileLink()
                .fixedSize()
                .padding(.leading, SiteSpace.paragraph)
                .padding(.trailing, SiteSpace.compact)
            Rectangle()
                .fill(SiteTheme.quiet.opacity(0.3))
                .frame(width: 1, height: 16)
                .accessibilityHidden(true)
            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .center, spacing: 0) {
                        ForEach(Section.allCases) { tab($0).accessibilityIdentifier("home-tab-\($0.id)").id($0.id) }
                    }
                }
                .onChange(of: selected) { _, newValue in
                    withAnimation(reduceMotion ? nil : .easeOut(duration: 0.2)) { proxy.scrollTo(newValue.id, anchor: .center) }
                }
            }
            Menu {
                Picker("栏目", selection: Binding(get: { selected }, set: { onSelect($0) })) {
                    ForEach(Section.allCases) { Text($0.label).tag($0) }
                }
            } label: {
                Image(systemName: "chevron.down")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(SiteTheme.ink)
                    .frame(width: 44, height: 48)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("选择栏目")
            .accessibilityValue(selected.label)
        }
    }

    private func tab(_ section: Section) -> some View {
        let isSelected = section == selected
        return Button {
            onSelect(section)
        } label: {
            Text(section.label)
                .font(isSelected ? SiteText.tabSelected : SiteText.tab)
                .foregroundStyle(isSelected ? SiteTheme.ink : SiteTheme.muted)
                .padding(.horizontal, 12)
                .frame(height: SiteSpace.touch)
                .overlay(alignment: .bottom) {
                    if isSelected {
                        Capsule().fill(SiteTheme.ink).frame(height: 2)
                            .matchedGeometryEffect(id: "tab-underline", in: underline)
                            .padding(.bottom, 4)
                    }
                }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

/// 单个栏目的信息流：首屏加载、下拉刷新、触底追加、失败重试。
private struct FeedPageUI<Value: Identifiable, Row: View>: View {
    let feed: PagedFeed<Value>
    let section: Section
    let bottomPadding: CGFloat
    let onScrollDelta: (CGFloat) -> Void
    @ViewBuilder let row: (Value) -> Row

    @ViewBuilder
    var body: some View {
        if feed.state.initial {
                VStack {
                    Spacer()
                    ProgressView().tint(SiteTheme.muted).controlSize(.small)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
                .task { feed.loadInitial() }
            } else if let error = feed.state.error, feed.state.items.isEmpty {
                ScrollView { ErrorRetry(message: error) { feed.retry() }.frame(minHeight: 420) }
        } else if feed.state.items.isEmpty {
            ScrollView {
                ContentUnavailableView {
                    Label("暂无内容", systemImage: "text.page")
                } description: {
                    Text("这里还没有\(section.label)内容，稍后再来看看。")
                } actions: {
                    Button(feed.state.refreshing ? "刷新中…" : "刷新") { feed.refresh() }
                        .disabled(feed.state.refreshing)
                        .frame(minHeight: SiteSpace.touch)
                }
                .padding(.top, SiteSpace.section)
            }
            .refreshable { await feed.refreshAndWait() }
        } else {
            feedList
        }
    }

    private var feedList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(feed.state.items) { item in
                    row(item)
                    HorizontalRule()
                }
                footer.onAppear {
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

    /// 页脚：追加转圈 / 失败重试 / 到底三态。
    @ViewBuilder
    private var footer: some View {
        if feed.state.loadingMore {
            ProgressView().tint(SiteTheme.muted).controlSize(.small).frame(maxWidth: .infinity).padding(.vertical, 18)
        } else if let error = feed.state.error {
            ErrorRetry(message: error) { feed.retry() }
        } else if !feed.state.hasMore, !feed.state.items.isEmpty {
            Text("已经到底了").siteMetaStyle().frame(maxWidth: .infinity).padding(.vertical, 18)
        }
    }
}

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
private struct AiNewsRow: View {
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
        .buttonStyle(.plain)
    }

    private var preview: String { aiNewsSummaryPreview(title: item.title, summary: item.summary) }

    private var meta: String {
        metaLine(feedTimeLabel(item.publishedAt), item.sourceName.isEmpty ? nil : item.sourceName)
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
        .buttonStyle(.plain)
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
private struct OpenSourceRow: View {
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
        .buttonStyle(.plain)
    }

    private var meta: String {
        metaLine(
            entry.status.isEmpty ? nil : entry.status,
            entry.dimensions.first.map { dimensionLabels[$0] ?? $0 },
            feedTimeLabel(entry.checkedAt),
        )
    }
}
