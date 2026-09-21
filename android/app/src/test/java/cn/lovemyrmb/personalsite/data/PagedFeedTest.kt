package cn.lovemyrmb.personalsite.data

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class PagedFeedTest {
    private data class Row(val id: String)

    @Test
    fun loadInitialDedupesByIdAndKeepsOrder() = runTest {
        val feed = PagedFeed(this, idOf = Row::id) {
            FeedPage(hasMore = true, items = listOf(Row("a"), Row("a"), Row("b")))
        }
        feed.loadInitial()
        advanceUntilIdle()
        val state = feed.state.value
        assertEquals(listOf("a", "b"), state.items.map(Row::id))
        assertTrue(state.hasMore)
        assertFalse(state.initial)
        assertFalse(state.refreshing)
    }

    @Test
    fun loadMoreAppendsNextPageDedupesAndStopsAtHasMoreFalse() = runTest {
        val requested = mutableListOf<Long>()
        val feed = PagedFeed(this, idOf = Row::id) { offset ->
            requested.add(offset)
            if (offset == 0L) FeedPage(true, listOf(Row("1"), Row("2")))
            else FeedPage(false, listOf(Row("2"), Row("3")))
        }
        feed.loadInitial()
        advanceUntilIdle()
        feed.loadMore()
        advanceUntilIdle()
        assertEquals(listOf("1", "2", "3"), feed.state.value.items.map(Row::id))
        assertEquals(listOf(0L, 2L), requested)
        assertFalse(feed.state.value.hasMore)
        // 已经到底后 loadMore 是空操作，不再发起请求。
        feed.loadMore()
        advanceUntilIdle()
        assertEquals(listOf(0L, 2L), requested)
    }

    @Test
    fun refreshDuringInFlightRefreshIsIgnored() = runTest {
        var fetches = 0
        val feed = PagedFeed(this, idOf = Row::id) {
            fetches++
            FeedPage(hasMore = false, items = listOf(Row("a")))
        }
        feed.loadInitial()
        advanceUntilIdle()
        assertEquals(1, fetches)
        // refresh 已置 refreshing 但尚未执行 fetch，连续下拉不得并发请求。
        feed.refresh()
        feed.refresh()
        advanceUntilIdle()
        assertEquals(2, fetches)
        assertFalse(feed.state.value.refreshing)
    }

    @Test
    fun retryDuringInFlightReloadIsIgnored() = runTest {
        var fetches = 0
        var fail = true
        val feed = PagedFeed(this, idOf = Row::id) {
            fetches++
            if (fail) throw IOException("network")
            FeedPage(false, listOf(Row("a")))
        }
        feed.loadInitial()
        advanceUntilIdle()
        assertEquals(1, fetches)
        assertNotNull(feed.state.value.error)
        // 首屏重载已排队（initial 已置 true），第二次 retry 不得并发请求。
        fail = false
        feed.retry()
        feed.retry()
        advanceUntilIdle()
        assertEquals(2, fetches)
        assertEquals(listOf("a"), feed.state.value.items.map(Row::id))
        assertNull(feed.state.value.error)
    }

    @Test
    fun refreshDuringInFlightLoadMoreIsIgnored() = runTest {
        var fetches = 0
        val feed = PagedFeed(this, idOf = Row::id) { offset ->
            fetches++
            if (offset == 0L) FeedPage(true, listOf(Row("1")))
            else FeedPage(false, listOf(Row("2")))
        }
        feed.loadInitial()
        advanceUntilIdle()
        assertEquals(1, fetches)
        // loadMore 已置 loadingMore 但尚未执行 fetch，此时下拉刷新不得并发请求。
        feed.loadMore()
        feed.refresh()
        advanceUntilIdle()
        assertEquals(2, fetches)
        assertEquals(listOf("1", "2"), feed.state.value.items.map(Row::id))
        assertFalse(feed.state.value.refreshing)
    }

    @Test
    fun refreshDuringInitialLoadIsIgnored() = runTest {
        var fetches = 0
        val feed = PagedFeed(this, idOf = Row::id) {
            fetches++
            FeedPage(hasMore = false, items = listOf(Row("a")))
        }
        feed.loadInitial()
        feed.refresh()
        advanceUntilIdle()
        assertEquals(1, fetches)
        assertEquals(listOf("a"), feed.state.value.items.map(Row::id))
    }

    @Test
    fun refreshAfterLoadReplacesItemsWithFreshPage() = runTest {
        var fresh = false
        val feed = PagedFeed(this, idOf = Row::id) {
            if (fresh) FeedPage(false, listOf(Row("new")))
            else FeedPage(true, listOf(Row("old")))
        }
        feed.loadInitial()
        advanceUntilIdle()
        fresh = true
        feed.refresh()
        advanceUntilIdle()
        assertEquals(listOf("new"), feed.state.value.items.map(Row::id))
        assertFalse(feed.state.value.refreshing)
    }

    @Test
    fun appendFailureKeepsItemsSetsErrorAndRetryRecovers() = runTest {
        var failAppend = true
        val feed = PagedFeed(this, idOf = Row::id) { offset ->
            if (offset == 0L) FeedPage(true, listOf(Row("1")))
            else if (failAppend) { failAppend = false; throw IOException("network") }
            else FeedPage(false, listOf(Row("2")))
        }
        feed.loadInitial()
        advanceUntilIdle()
        feed.loadMore()
        advanceUntilIdle()
        val state = feed.state.value
        assertEquals(listOf("1"), state.items.map(Row::id))
        assertEquals("暂时无法加载更多内容，请重试。", state.error)
        assertFalse(state.loadingMore)
        feed.retry()
        advanceUntilIdle()
        assertEquals(listOf("1", "2"), feed.state.value.items.map(Row::id))
        assertNull(feed.state.value.error)
    }

    @Test
    fun initialFailureThenRetryReloadsFromScratch() = runTest {
        var fail = true
        val feed = PagedFeed(this, idOf = Row::id) {
            if (fail) throw IOException("network")
            FeedPage(false, listOf(Row("a")))
        }
        feed.loadInitial()
        advanceUntilIdle()
        // 首屏失败没有"更多"可加载，文案须按读取场景表述。
        assertEquals("暂时无法读取内容，请重试。", feed.state.value.error)
        assertTrue(feed.state.value.items.isEmpty())
        fail = false
        feed.retry()
        advanceUntilIdle()
        assertEquals(listOf("a"), feed.state.value.items.map(Row::id))
        assertNull(feed.state.value.error)
        assertFalse(feed.state.value.initial)
    }

    @Test
    fun refreshFailureAfterInitialFailureStillReportsReadCopy() = runTest {
        var fail = true
        val feed = PagedFeed(this, idOf = Row::id) {
            if (fail) throw IOException("network")
            FeedPage(false, listOf(Row("a")))
        }
        feed.loadInitial()
        advanceUntilIdle()
        assertEquals("暂时无法读取内容，请重试。", feed.state.value.error)
        // 首屏失败后（initial=false）refresh 守卫放行；列表仍空，文案必须仍是"读取"而非"刷新"。
        feed.refresh()
        advanceUntilIdle()
        assertEquals("暂时无法读取内容，请重试。", feed.state.value.error)
        fail = false
        feed.retry()
        advanceUntilIdle()
        assertEquals(listOf("a"), feed.state.value.items.map(Row::id))
    }

    @Test
    fun refreshFailureKeepsItemsAndReportsRefreshCopy() = runTest {
        var fail = false
        val feed = PagedFeed(this, idOf = Row::id) {
            if (fail) throw IOException("network")
            FeedPage(true, listOf(Row("old")))
        }
        feed.loadInitial()
        advanceUntilIdle()
        fail = true
        feed.refresh()
        advanceUntilIdle()
        assertEquals(listOf("old"), feed.state.value.items.map(Row::id))
        assertEquals("暂时无法刷新内容，请重试。", feed.state.value.error)
        assertFalse(feed.state.value.refreshing)
        fail = false
        feed.refresh()
        advanceUntilIdle()
        assertNull(feed.state.value.error)
    }
}
