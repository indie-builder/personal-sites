import AVKit
import SwiftUI

/// Products from the unified site's portfolio API. Four destinations stay native; the rest open the site product page.
struct PortfolioView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.openURL) private var openURL
    @State private var products: [PortfolioProduct] = []
    @State private var error = false
    @State private var attempt = 0
    let bottomPadding: CGFloat

    /// 内容/失败/加载三相位；相位切换交叉淡入，条目刷新不参与动画。
    private enum Phase { case content, failed, loading }

    private var phase: Phase {
        products.isEmpty ? (error ? .failed : .loading) : .content
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("作品集").font(SiteText.pageTitle).foregroundStyle(SiteTheme.ink)
                    Text("设计参考与工程实践").siteSummaryStyle()
                }
                Spacer()
                ProfileLink()
            }
            .padding(.horizontal, SiteSpace.page)
            .padding(.top, 12)
            .padding(.bottom, 16)
            ScrollView {
                if products.isEmpty {
                    if error {
                        // 与 Home 信息流错误态一致：给 420 高度支撑让内容大致居中，
                        // 不紧贴页头。
                        ErrorRetry(message: "暂时无法读取作品集。") { attempt += 1 }
                            .frame(minHeight: 420)
                            .transition(.opacity)
                    } else {
                        ProgressView("正在读取作品…")
                            .frame(minWidth: 0, maxWidth: .infinity, minHeight: 420)
                            .transition(.opacity)
                    }
                } else {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(products) { product in
                            if let route = Self.nativeDestination(product.id) {
                                NavigationLink(value: route) { PortfolioProductRow(product: product) }
                                    .buttonStyle(SitePressStyle.row)
                                    .accessibilityIdentifier("portfolio-\(product.id)")
                            } else {
                                Button {
                                    openURL(Self.productPage(product.id))
                                } label: {
                                    PortfolioProductRow(product: product)
                                }
                                .buttonStyle(SitePressStyle.row)
                                .accessibilityIdentifier("portfolio-\(product.id)")
                                .accessibilityHint("在浏览器打开产品页面")
                            }
                            Divider().overlay(SiteTheme.line)
                        }
                        // 已有内容时刷新失败不顶掉列表（对齐 Home 信息流与集合页的页脚重试）。
                        if error {
                            ErrorRetry(message: "刷新失败，请重试。") { attempt += 1 }
                        }
                    }
                    .padding(.horizontal, SiteSpace.page)
                    .padding(.bottom, bottomPadding + 16)
                    .transition(.opacity)
                }
            }
            .refreshable { await load() }
            .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: phase)
        }
        .background(SiteTheme.background)
        .toolbar(.hidden, for: .navigationBar)
        .task(id: attempt) { await load() }
    }

    /// 四个原生页面之外的产品（含未知 id）打开统一站点产品页，不再误入「个人网站」。
    static func nativeDestination(_ id: String) -> Route? {
        switch id {
        case "layout-compositions": .portfolioCollection("layouts")
        case "muse": .portfolioCollection("muse")
        case "design-engineer-tools": .portfolioTools
        case "personal-sites": .portfolioSite
        default: nil
        }
    }

    static func productPage(_ id: String) -> URL { SiteAPI.url("products/\(id)") }

    private func load() async {
        error = false
        do {
            let response: PortfolioProducts = try await PortfolioAPI().get()
            products = response.items
            // 与入口清一次的差别：并发的前一次失败回调可能晚于本次入口清，
            // 成功落地时再清一次，避免「有内容 + 误报刷新失败」的页脚残留。
            error = false
        } catch { if !Task.isCancelled { self.error = true } }
    }
}

/// 落地页产品行：名称、简介、日期与封面，原生导航与网页外链共用。
private struct PortfolioProductRow: View {
    let product: PortfolioProduct

    var body: some View {
        HStack(alignment: .center, spacing: 20) {
            VStack(alignment: .leading, spacing: 9) {
                Text(product.name).font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(SiteTheme.ink)
                Text(product.summary).siteSummaryStyle().fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 6) {
                    Text("\(product.date) · \(product.dateLabel)")
                    Image(systemName: "chevron.right").font(.system(size: 9, weight: .semibold))
                }
                .siteMetaStyle().padding(.top, 3)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Group {
                if product.cover.isEmpty {
                    Image(systemName: "square.grid.2x2")
                        .font(.system(size: 30, weight: .ultraLight))
                        .foregroundStyle(SiteTheme.ink)
                } else {
                    RemoteImage(url: URL(string: product.cover), contentMode: .fit)
                        .padding(product.id == "layout-compositions" ? 8 : 0)
                }
            }
            .frame(width: 100, height: 112)
            .background(SiteTheme.line.opacity(0.35))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .accessibilityHidden(true)
        }
        .padding(.vertical, 20)
        .contentShape(Rectangle())
    }
}

struct PortfolioHeader: View {
    let title: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        HStack {
            BackButton { dismiss() }
            Spacer()
        }
        .overlay {
            Text(title).font(SiteText.title).foregroundStyle(SiteTheme.ink)
                .allowsHitTesting(false)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
    }
}

struct PortfolioToolsView: View {
    @Environment(\.openURL) private var openURL
    @State private var categories: [PortfolioToolCategory] = []
    @State private var failed = false
    @State private var attempt = 0

    var body: some View {
        VStack(spacing: 0) {
            PortfolioHeader(title: "设计工程工具")
            ScrollView {
                if failed { ErrorRetry(message: "暂时无法读取工具目录。") { attempt += 1 } }
                else if categories.isEmpty { ProgressView().padding(40) }
                LazyVStack(alignment: .leading, spacing: 24) {
                    ForEach(categories) { category in
                        VStack(alignment: .leading, spacing: 14) {
                            Text(category.name).font(SiteText.title).foregroundStyle(SiteTheme.ink)
                            LazyVGrid(columns: [GridItem(.flexible(), spacing: 20), GridItem(.flexible(), spacing: 20)], spacing: 6) {
                            ForEach(Array(category.tools.enumerated()), id: \.offset) { _, tool in
                                if let url = URL(string: tool.url) {
                                    Button { openURL(url) } label: {
                                        HStack(spacing: 10) {
                                            if !tool.icon.isEmpty {
                                                RemoteImage(url: URL(string: tool.icon), contentMode: .fit, showsRetry: false).frame(width: 24, height: 24)
                                            }
                                            Text(tool.name).font(SiteText.label).lineLimit(2).multilineTextAlignment(.leading)
                                            Spacer()
                                        }
                                        .foregroundStyle(SiteTheme.ink).frame(minHeight: 52).contentShape(Rectangle())
                                    }
                                    .buttonStyle(SitePressStyle.row).accessibilityHint("在浏览器打开工具官网")
                                }
                            }
                            }
                            Divider()
                        }
                    }
                }
                .padding(SiteSpace.page)
            }
        }
        .background(SiteTheme.background).toolbar(.hidden, for: .navigationBar)
        .task(id: attempt) {
            failed = false
            do { let result: PortfolioTools = try await PortfolioAPI().get(["tools"]); categories = result.categories }
            catch { if !Task.isCancelled { failed = true } }
        }
    }
}

struct PortfolioSiteView: View {
    @Environment(\.openURL) private var openURL
    @State private var site: PortfolioSite?
    @State private var failed = false
    @State private var attempt = 0

    var body: some View {
        VStack(spacing: 0) {
            PortfolioHeader(title: "个人网站")
            ScrollView {
                if let site {
                    VStack(alignment: .leading, spacing: SiteSpace.section) {
                        PortfolioVideo(urlString: site.video, poster: site.poster)
                            .aspectRatio(16 / 9, contentMode: .fit)
                            .background(SiteTheme.line.opacity(0.4), in: RoundedRectangle(cornerRadius: 8))
                        Text("一份持续更新的个人工程档案。").font(SiteText.pageTitle).foregroundStyle(SiteTheme.ink)
                        Text(site.description).siteBodyStyle(SiteTheme.muted)
                        if let url = URL(string: site.website) {
                            SourceCta(label: "打开网站", host: hostOf(site.website)) { openURL(url) }
                        }
                    }.padding(SiteSpace.page)
                } else if failed { ErrorRetry(message: "暂时无法读取介绍。") { attempt += 1 } }
                else { ProgressView().padding(40) }
            }
        }
        .background(SiteTheme.background).toolbar(.hidden, for: .navigationBar)
        .task(id: attempt) {
            failed = false
            do { site = try await PortfolioAPI().get(["site"]) }
            catch { if !Task.isCancelled { failed = true } }
        }
    }
}

struct PortfolioVideo: View {
    let urlString: String
    let poster: String
    @State private var playback = VideoPlayerModel()

    var body: some View {
        ZStack {
            switch playback.phase {
            case .idle:
                RemoteImage(url: URL(string: poster), contentMode: .fit, retryAlignment: .bottom)
                Button {
                    if let url = URL(string: urlString) { playback.play(url: url) }
                } label: {
                    Image(systemName: "play.fill").font(.system(size: 22))
                        .foregroundStyle(SiteTheme.ink).frame(width: 52, height: 52)
                        .background(SiteTheme.background, in: Circle())
                }
                .buttonStyle(SitePressStyle.compact).accessibilityLabel("播放视频")
            case .playing(let player):
                VideoPlayer(player: player)
            case .failed:
                ErrorRetry(message: "视频暂时无法播放。") { playback.retry() }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(SiteTheme.background)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .onDisappear { playback.pause() }
        .onChange(of: urlString) { _, _ in playback.pause() }
    }
}
