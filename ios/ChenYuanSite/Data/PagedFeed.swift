import Foundation
import Observation

/// 信息流页面的统一 UI 状态：首屏加载 / 追加 / 下拉刷新 / 失败各有标记。
struct FeedState<Value> {
    var items: [Value] = []
    var hasMore = true
    var initial = true
    var loadingMore = false
    var refreshing = false
    var error: String?
}

/// offset/limit 分页加载器：与站点 use-stream-feed 及安卓 PagedFeed 同策略——
/// 按 id 去重（服务端 offset 向下取整可能带来重复条目）、触底追加、失败可重试。
/// 逐条移植安卓端竞态保护：initial/refreshing/loadingMore 互斥。
@MainActor
@Observable
final class PagedFeed<Value> {
    private(set) var state = FeedState<Value>()

    private let idOf: @Sendable (Value) -> String
    private let fetch: @Sendable (Int) async throws -> FeedPage<Value>
    private var started = false
    private var task: Task<Void, Never>?

    init(idOf: @escaping @Sendable (Value) -> String, fetch: @escaping @Sendable (Int) async throws -> FeedPage<Value>) {
        self.idOf = idOf
        self.fetch = fetch
    }

    func loadInitial() {
        guard !started else { return }
        started = true
        request(offset: 0, append: false)
    }

    func refresh() {
        let current = state
        // 初始加载/追加进行中时忽略刷新：两个并发请求会竞态覆盖状态，
        // 且此时数据马上就会到达，无需重复拉取。
        guard !(current.refreshing || current.loadingMore || current.initial) else { return }
        request(offset: 0, append: false, refreshing: true)
    }

    /// SwiftUI .refreshable 使用的异步版本：等待刷新完成再收起系统转圈。
    func refreshAndWait() async {
        refresh()
        await task?.value
    }

    func loadMore() {
        let current = state
        guard current.hasMore, !current.loadingMore, !current.refreshing, current.error == nil else { return }
        guard !current.items.isEmpty else {
            loadInitial()
            return
        }
        request(offset: current.items.count, append: true)
    }

    func retry() {
        let current = state
        // 首屏重载进行中（前一次 retry 已置 initial）不得再次触发，避免并发重载竞态。
        guard !current.initial else { return }
        if current.items.isEmpty {
            started = false
            state.error = nil
            state.initial = true
            loadInitial()
        } else {
            state.error = nil
            loadMore()
        }
    }

    private func request(offset: Int, append: Bool, refreshing: Bool = false) {
        state.loadingMore = append
        state.refreshing = refreshing
        state.error = nil
        task = Task {
            defer { self.task = nil }
            do {
                let page = try await fetch(offset)
                apply(page: page, append: append)
            } catch {
                fail()
            }
        }
    }

    private func apply(page: FeedPage<Value>, append: Bool) {
        let merged = append ? state.items + page.items : page.items
        // 与站点一致：客户端按 id 去重，取整造成的重复条目直接丢弃。
        var seen = Set<String>(minimumCapacity: merged.count)
        let deduped = merged.filter { seen.insert(idOf($0)).inserted }
        state = FeedState(items: deduped, hasMore: page.hasMore, initial: false)
    }

    private func fail() {
        // 失败不丢已有数据：只清标记并置错误态，可由 retry() 恢复。
        state.initial = false
        state.loadingMore = false
        state.refreshing = false
        state.error = "暂时无法加载更多内容，请重试。"
    }
}

/// 首页五个栏目的信息流容器（对应安卓 HomeViewModel）。
@MainActor
@Observable
final class HomeModel {
    let aiNews: PagedFeed<AiNewsItem>
    let curation: PagedFeed<CurationItem>
    let design: PagedFeed<CurationItem>
    let douyin: PagedFeed<CurationItem>
    let openSource: PagedFeed<OpenSourceListEntry>

    init(api: SiteAPI) {
        aiNews = PagedFeed(idOf: { $0.id }) { try await api.feed(.aiNews, offset: $0) }
        curation = PagedFeed(idOf: { $0.id }) { try await api.feed(.curation, offset: $0) }
        design = PagedFeed(idOf: { $0.id }) { try await api.feed(.design, offset: $0) }
        douyin = PagedFeed(idOf: { $0.id }) { try await api.feed(.douyin, offset: $0) }
        openSource = PagedFeed(idOf: { $0.slug }) { try await api.feed(.openSource, offset: $0) }
    }
}
