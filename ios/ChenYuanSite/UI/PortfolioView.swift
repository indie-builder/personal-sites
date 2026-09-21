import AVKit
import SwiftUI

/// Four actual products from the portfolio service. Navigation stays in the app.
struct PortfolioView: View {
    @State private var products: [PortfolioProduct] = []
    @State private var error = false
    @State private var attempt = 0
    let bottomPadding: CGFloat

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
                if error {
                    ErrorRetry(message: "暂时无法读取作品集。") { attempt += 1 }
                } else if products.isEmpty {
                    ProgressView("正在读取作品…").padding(40)
                } else {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(products) { product in
                            NavigationLink(value: destination(product.id)) {
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
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("portfolio-\(product.id)")
                            Divider().overlay(SiteTheme.line)
                        }
                    }
                    .padding(.horizontal, SiteSpace.page)
                    .padding(.bottom, bottomPadding + 16)
                }
            }
            .refreshable { await load() }
        }
        .background(SiteTheme.background)
        .toolbar(.hidden, for: .navigationBar)
        .task(id: attempt) { await load() }
    }

    private func destination(_ id: String) -> Route {
        switch id {
        case "layout-compositions": .portfolioCollection("layouts")
        case "muse": .portfolioCollection("muse")
        case "design-engineer-tools": .portfolioTools
        default: .portfolioSite
        }
    }

    private func load() async {
        error = false
        do {
            let response: PortfolioProducts = try await PortfolioAPI().get()
            products = response.items
        } catch { if !Task.isCancelled { self.error = true } }
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

struct PortfolioCollectionView: View {
    let collection: String
    @State private var query = ""
    @State private var category = ""
    @State private var topic = ""
    @State private var items: [PortfolioItem] = []
    @State private var categories: [PortfolioCategory] = []
    @State private var topics: [PortfolioCategory] = []
    @State private var total = 0
    @State private var hasMore = false
    @State private var loading = false
    @State private var error = false
    @State private var attribution = ""
    @State private var generation = UUID()
    @State private var selectedItem: PortfolioItem?
    @State private var browsingAll = false

    private var showsShelf: Bool { collection == "layouts" && category.isEmpty && topic.isEmpty && query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !browsingAll }
    private var filters: [String] { [query, category, topic] }
    private var title: String { collection == "layouts" ? "布局参考" : "灵感集" }

    var body: some View {
        VStack(spacing: 0) {
            PortfolioHeader(title: title)
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").foregroundStyle(SiteTheme.muted)
                TextField("搜索\(title)", text: $query)
                    .font(SiteText.body).autocorrectionDisabled()
                    .accessibilityIdentifier("portfolio-search")
                if !query.isEmpty {
                    IconButton(systemName: "xmark", accessibilityLabel: "清空搜索") { query = "" }
                }
            }
            .padding(.horizontal, 12)
            .frame(height: 44)
            .background(SiteTheme.line.opacity(0.55), in: RoundedRectangle(cornerRadius: 10))
            .padding(.horizontal, 20)
            .padding(.top, 8)
            if !showsShelf {
            HStack {
                if collection == "layouts" {
                    Button {
                        query = ""; category = ""; topic = ""; browsingAll = false
                    } label: {
                        Label("书架", systemImage: "books.vertical").font(SiteText.label).frame(minHeight: 48)
                    }
                }
                Menu {
                    Button("全部分类") { category = ""; topic = ""; browsingAll = true }
                    ForEach(categories) { value in
                        Button(value.name) { category = value.id; topic = "" }
                    }
                } label: {
                    HStack(spacing: 6) {
                        Text(categories.first(where: { $0.id == category })?.name ?? "全部分类")
                        Image(systemName: "chevron.down").font(.system(size: 10, weight: .semibold))
                    }
                    .font(SiteText.label).frame(minHeight: 48)
                }
                if collection == "layouts" {
                    Menu {
                        Button("全部主题") { topic = "" }
                        ForEach(topics) { value in Button(value.name) { topic = value.id } }
                    } label: {
                        HStack(spacing: 6) {
                            Text(topics.first(where: { $0.id == topic })?.name ?? "全部主题")
                            Image(systemName: "chevron.down").font(.system(size: 10, weight: .semibold))
                        }
                        .font(SiteText.label).frame(minHeight: 48)
                    }
                }
                Spacer()
                Text("\(total) 件").siteMetaStyle().monospacedDigit()
            }
            .foregroundStyle(SiteTheme.ink).padding(.horizontal, 20)
            }
            ScrollView {
                if showsShelf {
                    if !categories.isEmpty {
                        LayoutBookshelf(categories: categories) { value in
                            category = value.id
                            topic = ""
                        }
                        Button {
                            browsingAll = true
                        } label: {
                            HStack {
                                Text("浏览全部图鉴")
                                Spacer()
                                Text("\(categories.reduce(0) { $0 + $1.count }) 张").foregroundStyle(SiteTheme.muted)
                                Image(systemName: "arrow.right")
                            }
                            .font(SiteText.label).foregroundStyle(SiteTheme.ink)
                            .frame(minHeight: 48).contentShape(Rectangle())
                        }
                        .buttonStyle(.plain).padding(.horizontal, 24).padding(.bottom, 24)
                    }
                } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 145), spacing: 14)], spacing: 24) {
                    ForEach(items) { item in
                        Button { selectedItem = item } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                GeometryReader { geometry in
                                    ZStack(alignment: .bottomTrailing) {
                                        if item.thumbnail.isEmpty {
                                            SiteTheme.line.opacity(0.45)
                                                .overlay { Image(systemName: "photo").foregroundStyle(SiteTheme.muted) }
                                        } else if collection == "layouts" {
                                            RemoteImage(url: URL(string: item.thumbnail), contentMode: .fit)
                                                .frame(width: geometry.size.width, height: geometry.size.height)
                                        } else {
                                            DownsampledThumbnail(urlString: item.thumbnail, targetSize: CGSize(width: 200, height: 160))
                                                .frame(width: geometry.size.width, height: geometry.size.height).clipped()
                                        }
                                        if item.media.first?.kind == "video" {
                                            Image(systemName: "play.fill").font(.system(size: 10, weight: .semibold))
                                                .foregroundStyle(.white)
                                                .frame(width: 26, height: 26)
                                                .background(.black.opacity(0.65), in: Circle()).padding(8)
                                        }
                                    }
                                    .frame(width: geometry.size.width, height: geometry.size.height)
                                    .background(SiteTheme.line.opacity(0.35)).clipped()
                                }
                                .aspectRatio(collection == "layouts" ? 0.72 : 1.25, contentMode: .fit)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                Text(item.title).font(SiteText.listTitle).lineLimit(2).multilineTextAlignment(.leading)
                                Text(item.author.isEmpty ? item.category : item.author).siteMetaStyle().lineLimit(1)
                            }
                            .foregroundStyle(SiteTheme.ink).frame(maxWidth: .infinity, alignment: .topLeading)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("portfolio-item-\(item.id)")
                        .onAppear {
                            if item.id == items.last?.id, hasMore, !loading, !error {
                                Task { await load(reset: false) }
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
                }
                if loading { ProgressView().padding(24) }
                else if error {
                    ErrorRetry(message: "暂时无法读取内容，请重试。") { Task { await load(reset: items.isEmpty) } }
                } else if items.isEmpty {
                    ContentUnavailableView("没有找到内容", systemImage: "magnifyingglass", description: Text("试试其他关键词或分类。"))
                }
                if !attribution.isEmpty { Text(attribution).siteMetaStyle().padding(SiteSpace.page) }
            }
            .scrollDismissesKeyboard(.interactively)
            .refreshable { await load(reset: true) }
        }
        .background(SiteTheme.background)
        .toolbar(.hidden, for: .navigationBar)
        .task(id: filters) {
            // Invalidates pagination immediately; old results cannot overwrite a new search.
            generation = UUID()
            items = []
            loading = true
            do { try await Task.sleep(for: .milliseconds(250)) } catch { return }
            await load(reset: true)
        }
        .fullScreenCover(item: $selectedItem) { item in
            PortfolioItemReader(collection: collection, initialItem: item, siblings: items)
        }
    }

    private func load(reset: Bool) async {
        if !reset && loading { return }
        if reset { generation = UUID() }
        let request = generation
        loading = true
        error = false
        do {
            let page: PortfolioPage = try await PortfolioAPI().get([collection], query: [
                "q": query, "cat": category, "theme": topic, "offset": String(reset ? 0 : items.count), "limit": "24",
            ])
            guard request == generation, !Task.isCancelled else { return }
            if reset { items = page.items }
            else {
                let existing = Set(items.map(\.id))
                items += page.items.filter { !existing.contains($0.id) }
            }
            total = page.total
            hasMore = page.hasMore
            categories = page.categories
            topics = page.topics
            attribution = page.attribution
            loading = false
        } catch {
            guard request == generation, !Task.isCancelled else { return }
            self.error = true
            loading = false
        }
    }
}

/// 分类作为八本可点选的书展示，色彩沿用网站书架的受控局部配色。
private struct LayoutBookshelf: View {
    let categories: [PortfolioCategory]
    let onSelect: (PortfolioCategory) -> Void

    private let colors: [UInt32] = [0xB94A35, 0xD6C7A6, 0x557477, 0xD4AC49, 0x465676, 0xA65E47, 0x707453, 0xDDD5C3]
    private let heights: [CGFloat] = [204, 188, 198, 182, 194, 204, 184, 198]

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 7) {
                Text("从一本书开始").font(SiteText.pageTitle).foregroundStyle(SiteTheme.ink)
                Text("\(categories.count) 个分类，按主题翻阅排版图鉴。").siteSummaryStyle()
            }
            ForEach(Array(stride(from: 0, to: categories.count, by: 4)), id: \.self) { start in
                VStack(spacing: 0) {
                    HStack(alignment: .bottom, spacing: 10) {
                        ForEach(start..<min(start + 4, categories.count), id: \.self) { index in
                            book(categories[index], index: index)
                        }
                    }
                    .padding(.horizontal, 6)
                    Rectangle().fill(SiteTheme.quiet.opacity(0.3)).frame(height: 2)
                    Rectangle().fill(SiteTheme.line.opacity(0.65)).frame(height: 7)
                }
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 24)
        .padding(.bottom, 20)
    }

    private func book(_ category: PortfolioCategory, index: Int) -> some View {
        let hex = colors[index % colors.count]
        let color = Color(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255)
        let ink: Color = [1, 3, 7].contains(index % colors.count) ? Color(red: 0.22, green: 0.21, blue: 0.18) : .white
        return Button { onSelect(category) } label: {
            VStack(spacing: 0) {
                Text(String(format: "%02d", index + 1)).font(.system(size: 10, weight: .medium)).opacity(0.8)
                Rectangle().fill(ink.opacity(0.3)).frame(height: 0.5).padding(.vertical, 10)
                Text(category.name.replacingOccurrences(of: " ", with: ""))
                    .font(.system(size: 15, weight: .semibold))
                    .multilineTextAlignment(.center)
                    .frame(width: 22)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 10)
                Text("\(category.count) 张").font(.system(size: 10, weight: .medium))
            }
            .foregroundStyle(ink)
            .padding(.vertical, 14)
            .padding(.horizontal, 10)
            .frame(maxWidth: .infinity)
            .frame(height: heights[index % heights.count])
            .background(color)
            .overlay(alignment: .leading) {
                Rectangle().fill(.black.opacity(0.12)).frame(width: 4)
            }
            .overlay(alignment: .trailing) {
                Rectangle().fill(.white.opacity(0.15)).frame(width: 1)
            }
            .clipShape(.rect(topLeadingRadius: 3, bottomLeadingRadius: 1, bottomTrailingRadius: 2, topTrailingRadius: 5))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(category.name)，\(category.count) 张图鉴")
        .accessibilityHint("打开分类")
        .accessibilityIdentifier("layout-book-\(category.id)")
    }
}

/// Reading sheet leaves collection query, loaded pages and scroll position intact.
private struct PortfolioItemReader: View {
    let collection: String
    let initialItem: PortfolioItem
    let siblings: [PortfolioItem]
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var currentID = ""
    @State private var detail: PortfolioItem?
    @State private var failed = false
    @State private var attempt = 0
    @State private var photo: PortfolioMedia?

    private var index: Int { siblings.firstIndex(where: { $0.id == currentID }) ?? 0 }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(collection == "layouts" ? "布局参考" : "灵感集")
                    .font(SiteText.label).foregroundStyle(SiteTheme.muted)
                Spacer()
                Button("完成") { dismiss() }
                    .font(SiteText.label).foregroundStyle(SiteTheme.ink)
                    .frame(minWidth: 48, minHeight: 48)
            }
            .padding(.horizontal, 20)
            ScrollView {
                if let item = detail {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(item.media) { media in
                            Group {
                                if media.kind == "video" {
                                    PortfolioVideo(urlString: media.url, poster: media.poster)
                                        .aspectRatio(media.aspect, contentMode: .fit)
                                } else {
                                    Button { photo = media } label: {
                                        RemoteImage(url: URL(string: media.url), contentMode: .fit)
                                            .aspectRatio(media.aspect, contentMode: .fit)
                                    }
                                    .buttonStyle(.plain).accessibilityLabel("放大图片")
                                }
                            }
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .padding(.bottom, 12)
                        }
                        if item.media.isEmpty {
                            ContentUnavailableView("暂无图片", systemImage: "photo")
                        }
                        Text(item.title).font(SiteText.pageTitle).foregroundStyle(SiteTheme.ink)
                            .padding(.top, 12)
                        Text(metaLine(item.author, item.category, item.topic)).siteMetaStyle()
                            .padding(.top, 8)
                        if !item.text.isEmpty {
                            Text(item.text).siteBodyStyle().textSelection(.enabled).padding(.top, 20)
                        }
                        if let url = URL(string: item.sourceURL), !item.sourceURL.isEmpty {
                            Divider().padding(.top, 24)
                            Button { openURL(url) } label: {
                                HStack {
                                    Text("查看原作").font(SiteText.label)
                                    Spacer()
                                    Text(hostOf(item.sourceURL)).font(SiteText.meta).foregroundStyle(SiteTheme.muted)
                                    Image(systemName: "arrow.up.right").font(.system(size: 12))
                                }
                                .foregroundStyle(SiteTheme.ink).frame(minHeight: 52).contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                        if collection == "layouts" {
                            Text("nevertoday / 350-layout-compositions · CC BY 4.0")
                                .siteMetaStyle().padding(.top, 8)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 24)
                    .id(currentID)
                } else if failed {
                    ErrorRetry(message: "暂时无法读取详情。") { attempt += 1 }
                } else { ProgressView("正在读取详情…").padding(40) }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            Divider()
            HStack {
                Button { move(-1) } label: {
                    Label("上一件", systemImage: "chevron.left").frame(minHeight: 48)
                }.disabled(index == 0)
                Spacer()
                Text("第 \(index + 1) 件").siteMetaStyle().monospacedDigit()
                Spacer()
                Button { move(1) } label: {
                    HStack(spacing: 6) { Text("下一件"); Image(systemName: "chevron.right") }.frame(minHeight: 48)
                }.disabled(index + 1 >= siblings.count)
            }
            .font(SiteText.label).buttonStyle(.plain).foregroundStyle(SiteTheme.ink)
            .padding(.horizontal, 20)
        }
        .background(SiteTheme.background)
            .fullScreenCover(item: $photo) { media in PhotoReader(urlString: media.url) }
            .task(id: "\(currentID)-\(attempt)") {
                let id = currentID.isEmpty ? initialItem.id : currentID
                if currentID.isEmpty { currentID = id; return }
                detail = nil
                failed = false
                do {
                    let response: PortfolioDetail = try await PortfolioAPI().get([collection, id])
                    guard !Task.isCancelled else { return }
                    detail = response.item
                } catch { if !Task.isCancelled { failed = true } }
            }
    }

    private func move(_ delta: Int) {
        guard let next = siblings[safe: index + delta] else { return }
        currentID = next.id
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
                                    .buttonStyle(.plain).accessibilityHint("在浏览器打开工具官网")
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

private struct PortfolioVideo: View {
    let urlString: String
    let poster: String
    @State private var playback = VideoPlayerModel()

    var body: some View {
        ZStack {
            switch playback.phase {
            case .idle:
                RemoteImage(url: URL(string: poster), contentMode: .fit)
                Button {
                    if let url = URL(string: urlString) { playback.play(url: url) }
                } label: {
                    Image(systemName: "play.fill").font(.system(size: 22))
                        .foregroundStyle(SiteTheme.ink).frame(width: 52, height: 52)
                        .background(SiteTheme.background, in: Circle())
                }
                .buttonStyle(.plain).accessibilityLabel("播放视频")
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
