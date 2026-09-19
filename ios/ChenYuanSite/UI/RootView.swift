import SwiftUI

enum Route: Hashable {
    case detail
    case about
}

/// 根视图：NavigationStack 内容 + 悬浮胶囊玻璃底栏。
/// 底栏在列表滚动时按 ±16pt 阈值隐藏/显示，切页与跳转时复位（与安卓一致）。
struct RootView: View {
    static let portfolioURL = URL(string: "https://portfolio.default-coder.lovemyrmb.cn/")!

    @Environment(AppEnvironment.self) private var env
    @Environment(\.openURL) private var openURL

    @State private var path: [Route] = []
    @State private var selectedSection = 0
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
                        case .detail:
                            DetailRouteView(onScrollDelta: noteScroll)
                        case .about:
                            AboutView(bottomPadding: barTotal, onScrollDelta: noteScroll)
                        }
                    }
                }
                .background(SiteTheme.background)

                if barVisible {
                    glassBar
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.snappy(duration: 0.22, extraBounce: 0), value: barVisible)
            .frame(width: proxy.size.width, height: proxy.size.height)
            .fullScreenCover(isPresented: $showAsk) {
                AskView(demoResetPrompt: askResetDemo)
            }
            .onAppear { applyLaunchArguments() }
            .onChange(of: selectedSection) { _, _ in showBar() }
            .onChange(of: path) { _, _ in showBar() }
        }
        .background(SiteTheme.background)
    }

    // MARK: 底栏

    private var glassBar: some View {
        HStack(spacing: 0) {
            barItem(icon: "waveform.path.ecg", label: "动态", selected: path.isEmpty) {
                withAnimation(.easeOut(duration: 0.2)) { path = [] }
                withAnimation(.easeOut(duration: 0.22)) { selectedSection = 0 }
                showBar()
            }
            barItem(icon: "ellipsis.bubble", label: "问一问", selected: false) {
                showAsk = true
            }
            barItem(icon: "briefcase", label: "作品集", selected: false) {
                openURL(Self.portfolioURL)
            }
            barItem(icon: "person", label: "关于我", selected: path.last == .about) {
                withAnimation(.easeOut(duration: 0.2)) {
                    path = path.last == .about ? [] : [.about]
                }
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
                Image(systemName: icon)
                    .font(.system(size: 22))
                    .foregroundStyle(SiteTheme.ink)
                Text(label)
                    .font(SiteText.meta)
                    .foregroundStyle(selected ? SiteTheme.ink : SiteTheme.muted)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background {
                if selected {
                    Capsule().fill(SiteTheme.ink.opacity(0.09))
                }
            }
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isButton)
    }

    // MARK: 滚动隐藏（±16pt 阈值，反向滚动先清零累计位移）

    private func noteScroll(_ delta: CGFloat) {
        if travel * delta < 0 { travel = 0 }
        travel += delta
        if abs(travel) >= threshold {
            // iOS contentOffset 向下滚动时增大：向下浏览隐藏底栏。
            barVisible = travel < 0
            travel = 0
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

    /// 演示/联调用启动参数：-route-ask 直达问一问，-route-about 直达关于我，
    /// -route-detail 拉取每日动态第一条并进入详情，-ask-demo 自动发送预设问题，
    /// -ask-reset 在 -ask-demo 基础上再弹出「新对话」确认。
    private func applyLaunchArguments() {
        let arguments = ProcessInfo.processInfo.arguments
        if arguments.contains("-route-ask") { showAsk = true }
        if arguments.contains("-route-about") { path = [.about] }
        if arguments.contains("-ask-demo") || arguments.contains("-ask-reset") {
            showAsk = true
            Task {
                try? await Task.sleep(for: .seconds(0.5))
                env.askController.send("介绍一下陈远", scope: .profile)
            }
        }
        if arguments.contains("-ask-reset") {
            Task {
                try? await Task.sleep(for: .seconds(3))
                askResetDemo = true
            }
        }
        if arguments.contains("-route-detail") {
            Task {
                let page = try? await env.api.aiNews(offset: 0, limit: 1)
                guard let item = page?.items.first else { return }
                openDetail(.aiNews(item.id))
            }
        }
    }
}
