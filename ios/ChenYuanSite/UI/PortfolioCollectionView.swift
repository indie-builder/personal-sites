import SwiftUI

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
