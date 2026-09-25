package cn.lovemyrmb.personalsite.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PortfolioViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private class FakeApi : PortfolioApi {
        var requests = 0
        var productFailures = 0
        override suspend fun products(): PortfolioProducts {
            requests++
            if (productFailures > 0) {
                productFailures--
                throw java.io.IOException("network")
            }
            return PortfolioProducts(items = listOf(PortfolioProduct(id = "p1", name = "布局参考")))
        }
        override suspend fun collection(
            collection: String,
            q: String,
            cat: String,
            theme: String,
            offset: Long,
            limit: Int,
        ): PortfolioPage {
            requests++
            return PortfolioPage(
                items = listOf(PortfolioItem(id = "$collection-$offset", title = "t")),
                total = 350,
                hasMore = offset == 0L,
                categories = listOf(PortfolioCategory("c1", "构图", 86)),
                attribution = "CC BY 4.0",
            )
        }
        override suspend fun detail(collection: String, id: String) = PortfolioDetail(PortfolioItem(id = id))
    }

    @Test
    fun sameFilterReusesFeedInstanceDifferentFilterGetsNewOne() = runTest(dispatcher) {
        val viewModel = PortfolioViewModel(FakeApi())
        val first = viewModel.feed("layouts", "", "", "")
        assertSame(first, viewModel.feed("layouts", "", "", ""))
        assertNotEquals(first, viewModel.feed("layouts", "三分法", "", ""))
        assertNotEquals(first, viewModel.feed("muse", "", "", ""))
    }

    @Test
    fun fetchMapsPageAndPublishesMetaUnderFilterKey() = runTest(dispatcher) {
        val api = FakeApi()
        val viewModel = PortfolioViewModel(api)
        val feed = viewModel.feed("layouts", "", "", "")
        feed.loadInitial()
        advanceUntilIdle()
        val meta = viewModel.meta.value[viewModel.feedKey("layouts", "", "", "")]!!
        assertEquals(350, meta.total)
        assertEquals("构图", meta.categories.single().name)
        assertEquals("CC BY 4.0", meta.attribution)
        assertEquals(listOf("layouts-0"), feed.state.value.items.map(PortfolioItem::id))
        assertTrue(feed.state.value.hasMore)
        assertEquals(1, api.requests)
    }

    @Test
    fun feedCacheEvictsBeyondEightFilterKeys() = runTest(dispatcher) {
        val viewModel = PortfolioViewModel(FakeApi())
        val oldest = viewModel.feed("layouts", "0", "", "")
        repeat(8) { viewModel.feed("layouts", "${it + 1}", "", "") }
        advanceUntilIdle()
        assertNotEquals(oldest, viewModel.feed("layouts", "0", "", ""))
    }

    @Test
    fun loadProductsCachesAndRefreshFailureKeepsItems() = runTest(dispatcher) {
        val api = FakeApi()
        val viewModel = PortfolioViewModel(api)
        // 首拉失败：items 仍为 null，productsLoaded 未置位。
        api.productFailures = 1
        viewModel.loadProducts()
        advanceUntilIdle()
        assertNull(viewModel.products.value.items)
        // 重新进入落地页时 loadProducts 必须重试而非被缓存挡住。
        viewModel.loadProducts()
        advanceUntilIdle()
        assertEquals(2, api.requests)
        assertEquals("布局参考", viewModel.products.value.items!!.single().name)
        // 已加载后 loadProducts 是空操作，不重复请求。
        viewModel.loadProducts()
        advanceUntilIdle()
        assertEquals(2, api.requests)
        // 刷新失败保留已有列表并置 refreshError。
        api.productFailures = 1
        viewModel.refreshProducts()
        advanceUntilIdle()
        val state = viewModel.products.value
        assertEquals("布局参考", state.items!!.single().name)
        assertTrue(state.refreshError)
        assertFalse(state.refreshing)
        // 恢复后刷新成功清除错误。
        viewModel.refreshProducts()
        advanceUntilIdle()
        assertFalse(viewModel.products.value.refreshError)
    }
}
