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

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// 加载/失败/空态/内容四相位；相位切换交叉淡入，条目追加不参与动画。
    private enum Phase { case loading, failed, empty, content }

    private var phase: Phase {
        if feed.state.initial { return .loading }
        if feed.state.error != nil, feed.state.items.isEmpty { return .failed }
        if feed.state.items.isEmpty { return .empty }
        return .content
    }

    @ViewBuilder
    var body: some View {
        Group {
            switch phase {
            case .loading:
                VStack {
                    Spacer()
                    ProgressView().tint(SiteTheme.muted).controlSize(.small)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
                .task { feed.loadInitial() }
                .transition(.opacity)
            case .failed:
                ScrollView { ErrorRetry(message: feed.state.error ?? "") { feed.retry() }.frame(minHeight: 420) }
                    .transition(.opacity)
            case .empty:
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
                .transition(.opacity)
            case .content:
                feedList.transition(.opacity)
            }
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: phase)
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
