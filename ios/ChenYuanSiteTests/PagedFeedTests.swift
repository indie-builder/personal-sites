import Foundation
import Synchronization
import Testing

@testable import ChenYuanSite

/// 移植安卓 PagedFeedTest 的核心行为规格：分页追加、按 id 去重、
/// 失败不丢数据、刷新/追加互斥、首屏重载防重入。
@MainActor
struct PagedFeedTests {
    private struct Entry: Identifiable, Sendable {
        let id: String
    }

    private func makeFeed(
        idOf: @escaping @Sendable (Entry) -> String = { $0.id },
        fetch: @escaping @Sendable (Int) async throws -> FeedPage<Entry>,
    ) -> PagedFeed<Entry> {
        PagedFeed(idOf: idOf, fetch: fetch)
    }

    private func entry(_ id: String) -> Entry { Entry(id: id) }

    @Test func initialLoadFillsState() async {
        let feed = makeFeed { _ in
            FeedPage(hasMore: false, items: [Entry(id: "a"), Entry(id: "b")])
        }
        feed.loadInitial()
        await waitUntil { !(feed.state.initial || feed.state.refreshing || feed.state.loadingMore) }
        #expect(feed.state.items.map { $0.id } == ["a", "b"])
        #expect(!feed.state.hasMore)
        #expect(feed.state.error == nil)
    }

    @Test func loadMoreAppendsWithOffsetAndDedups() async {
        let offsets = Mutex<[Int]>([])
        let feed = makeFeed { offset in
            offsets.withLock { $0.append(offset) }
            if offset == 0 {
                return FeedPage(hasMore: true, items: [Entry(id: "a"), Entry(id: "b")])
            }
            // 服务端 offset 取整可能重复返回 b。
            return FeedPage(hasMore: false, items: [Entry(id: "b"), Entry(id: "c")])
        }
        feed.loadInitial()
        await waitUntil { !feed.state.loadingMore && feed.state.items.count == 2 }
        feed.loadMore()
        await waitUntil { !feed.state.loadingMore }
        #expect(offsets.withLock { $0 } == [0, 2])
        #expect(feed.state.items.map { $0.id } == ["a", "b", "c"])
        #expect(!feed.state.hasMore)
    }

    @Test func loadMoreFailureKeepsItemsAndRetryRecovers() async {
        let shouldFail = Mutex(true)
        let feed = makeFeed { offset in
            if offset == 0 {
                return FeedPage(hasMore: true, items: [Entry(id: "a")])
            }
            let previous = shouldFail.withLock { value in
                let current = value
                value = false
                return current
            }
            if previous {
                throw URLError(.networkConnectionLost)
            }
            return FeedPage(hasMore: false, items: [Entry(id: "b")])
        }
        feed.loadInitial()
        await waitUntil { !feed.state.initial && feed.state.items.count == 1 }
        feed.loadMore()
        await waitUntil { feed.state.error != nil }
        #expect(feed.state.items.map { $0.id } == ["a"])
        feed.retry()
        // retry 的 loadMore 在后台 Task 中完成，等待数据真正到位。
        await waitUntil { feed.state.error == nil && feed.state.items.count == 2 }
        #expect(feed.state.items.map { $0.id } == ["a", "b"])
    }

    @Test func initialFailureThenRetryReloadsFromStart() async {
        let shouldFail = Mutex(true)
        let calls = Mutex(0)
        let feed = makeFeed { _ in
            calls.withLock { $0 += 1 }
            if shouldFail.withLock({ value in
                let previous = value
                value = false
                return previous
            }) {
                throw URLError(.timedOut)
            }
            return FeedPage(hasMore: false, items: [Entry(id: "a")])
        }
        feed.loadInitial()
        await waitUntil { feed.state.error != nil }
        #expect(feed.state.items.isEmpty)
        // initial 重载进行中不得再次触发 retry。
        feed.retry()
        feed.retry()
        await waitUntil { feed.state.error == nil && feed.state.items.count == 1 }
        #expect(calls.withLock { $0 } == 2)
    }

    @Test func refreshReplacesItems() async {
        let calls = Mutex(0)
        let feed = makeFeed { offset in
            let sequence = calls.withLock { value in
                value += 1
                return value
            }
            if offset == 2 {
                return FeedPage(hasMore: false, items: [Entry(id: "c")])
            }
            if sequence <= 1 {
                return FeedPage(hasMore: true, items: [Entry(id: "a"), Entry(id: "b")])
            }
            // 刷新重新拉取第一页，返回全新内容。
            return FeedPage(hasMore: false, items: [Entry(id: "fresh-\(sequence)")])
        }
        feed.loadInitial()
        await waitUntil { feed.state.items.count == 2 }
        feed.loadMore()
        await waitUntil { feed.state.items.count == 3 }
        feed.refresh()
        await waitUntil { !feed.state.refreshing && feed.state.items.count == 1 }
        #expect(feed.state.items.map { $0.id } == ["fresh-3"])
        #expect(!feed.state.hasMore)
    }

    /// 刷新/追加进行中时互斥：refresh() 应直接忽略（对应安卓的竞态保护注释）。
    @Test func refreshIgnoredWhileLoadingMore() async {
        nonisolated final class Gate: @unchecked Sendable {
            private let lock = Mutex<(cont: CheckedContinuation<FeedPage<Entry>, Never>?, suspended: Bool)>((nil, false))

            var isSuspended: Bool {
                lock.withLock { $0.suspended }
            }

            func suspend() async -> FeedPage<Entry> {
                await withCheckedContinuation { continuation in
                    lock.withLock {
                        $0.cont = continuation
                        $0.suspended = true
                    }
                }
            }

            func resume(with build: @escaping @Sendable () -> FeedPage<Entry>) {
                let pending = lock.withLock { state -> CheckedContinuation<FeedPage<Entry>, Never>? in
                    state.suspended = false
                    return state.cont
                }
                pending?.resume(returning: build())
                lock.withLock { $0.cont = nil }
            }
        }

        let gate = Gate()
        let feed = makeFeed { offset in
            if offset == 0 {
                return FeedPage(hasMore: true, items: [Entry(id: "a")])
            }
            return await gate.suspend()
        }
        feed.loadInitial()
        await waitUntil { !feed.state.initial }
        feed.loadMore()
        // 等 fetch 真正挂起（续体已注册）再放行，避免注册前的 resume 丢失。
        await waitUntil { gate.isSuspended }
        feed.refresh()
        feed.refresh()
        gate.resume { FeedPage(hasMore: false, items: [Entry(id: "b")]) }
        await waitUntil { !feed.state.loadingMore }
        #expect(feed.state.items.map { $0.id } == ["a", "b"])
        #expect(!feed.state.refreshing)
    }

    private func waitUntil(
        _ condition: @MainActor () -> Bool,
        timeout: Duration = .seconds(2),
    ) async {
        let deadline = ContinuousClock.now + timeout
        while !condition() {
            guard ContinuousClock.now < deadline else {
                Issue.record("等待状态变更超时")
                return
            }
            await Task.yield()
            try? await Task.sleep(for: .milliseconds(5))
        }
    }
}
