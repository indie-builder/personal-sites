import SwiftUI

enum Route: Hashable {
    case detail
    case about
    case portfolio
    case portfolioCollection(String)
    case portfolioTools
    case portfolioSite
}

/// 根视图：NavigationStack 内容 + 悬浮胶囊玻璃底栏。
/// 向下阅读累计 16pt 后隐藏底栏；回滑立即显示，切页与跳转时复位。
struct RootView: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var path: [Route] = []
    @State private var selectedSection = Section.aiNews
    @State private var showAsk = false
    @State private var askResetDemo = false
    @State private var barVisible = true
    @State private var travel: CGFloat = 0

    private let barHeight: CGFloat = 72
    private let threshold: CGFloat = 16

    var body: some View {
        GeometryReader { proxy in
            let barTotal = barHeight + 12 + proxy.safeAreaInsets.bottom
            ZStack(alignment: .bottom) {
                NavigationStack(path: $path) {
                    HomeView(
                        selectedSection: $selectedSection,
                        bottomBarPadding: barTotal + 24,
                        onScrollDelta: noteScroll,
                        onOpenDetail: openDetail,
                    )
                    .navigationDestination(for: Route.self) { route in
                        switch route {
                        case .detail: DetailRouteView(onScrollDelta: noteScroll)
                        case .portfolio: PortfolioView(bottomPadding: barTotal)
                        case .portfolioCollection(let collection): PortfolioCollectionView(collection: collection)
                        case .portfolioTools: PortfolioToolsView()
                        case .portfolioSite: PortfolioSiteView()
                        case .about:
                            VStack(spacing: 0) {
                                HStack {
                                    BackButton { path.removeLast() }
                                    Spacer()
                                }
                                .padding(.horizontal, SiteSpace.paragraph)
                                AboutView(bottomPadding: barTotal, onScrollDelta: noteScroll)
                            }
                        }
                    }
                }
                .background(SiteTheme.background)

                if barVisible && (path.isEmpty || path.last == .about || path.last == .portfolio) {
                    glassBar.transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(reduceMotion ? nil : .snappy(duration: 0.22, extraBounce: 0), value: barVisible)
            .frame(width: proxy.size.width, height: proxy.size.height)
            .fullScreenCover(isPresented: $showAsk) { AskView(demoResetPrompt: askResetDemo) }
            .onAppear { applyLaunchArguments() }
            .onChange(of: selectedSection) { _, _ in showBar() }
            .onChange(of: path) { _, _ in showBar() }
        }
        .background(SiteTheme.background)
    }

    private var glassBar: some View {
        HStack(spacing: 0) {
            barItem(icon: "waveform.path.ecg", label: "动态", selected: path.isEmpty) {
                withAnimation(reduceMotion ? nil : .easeOut(duration: 0.2)) { path = [] }
                showBar()
            }
            barItem(icon: "ellipsis.bubble", label: "问一问", selected: false) { showAsk = true }
            barItem(icon: "briefcase", label: "作品集", selected: path.last == .portfolio) {
                if path.last != .portfolio { path = [.portfolio] }
                showBar()
            }
            barItem(icon: "person", label: "关于我", selected: path.last == .about) {
                withAnimation(reduceMotion ? nil : .easeOut(duration: 0.2)) { path = [.about] }
            }
        }
        .padding(5)
        .frame(height: barHeight)
        .glassEffect(.regular, in: .capsule)
        .padding(.horizontal, 12)
        .padding(.bottom, 6)
    }

    private func barItem(icon: String, label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Image(systemName: icon).font(.system(size: 22)).foregroundStyle(SiteTheme.ink)
                Text(label).font(SiteText.meta)
                    .foregroundStyle(selected ? SiteTheme.ink : SiteTheme.muted)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background {
                if selected { Capsule().fill(SiteTheme.ink.opacity(0.09)) }
            }
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("bar-\(label)")
    }

    // MARK: 向下阅读隐藏，回滑立即显示

    private func noteScroll(_ delta: CGFloat) {
        guard delta != 0 else { return }
        if delta < 0 {
            showBar()
        } else {
            travel += delta
            if travel >= threshold {
                barVisible = false
                travel = 0
            }
        }
    }

    private func showBar() {
        travel = 0
        barVisible = true
    }

    private func openDetail(_ entry: DetailEntry) {
        env.entryHolder.pending = entry
        path.append(.detail)
    }

    /// 演示/联调用启动参数（README 有参数表）。
    private func applyLaunchArguments() {
        let flag = ProcessInfo.processInfo.arguments.contains
        if flag("-route-ask") { showAsk = true }
        if flag("-route-portfolio") { path = [.portfolio] }
        if flag("-route-about") { path = [.about] }
        if flag("-route-design") { selectedSection = .design }
        if flag("-ask-demo") || flag("-ask-reset") {
            showAsk = true
            Task {
                try? await Task.sleep(for: .seconds(0.5))
                env.askController.send("介绍一下陈远", scope: .profile)
            }
        }
        if flag("-ask-reset") {
            Task {
                try? await Task.sleep(for: .seconds(3))
                askResetDemo = true
            }
        }
        if flag("-route-detail") {
            Task {
                let page = try? await env.api.feed(.aiNews, offset: 0) as FeedPage<AiNewsItem>
                guard let id = page?.items.first?.id else { return }
                openDetail(.aiNews(id))
            }
        }
    }
}
