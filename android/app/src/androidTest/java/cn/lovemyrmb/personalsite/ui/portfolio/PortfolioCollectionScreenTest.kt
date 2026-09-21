package cn.lovemyrmb.personalsite.ui.portfolio

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import cn.lovemyrmb.personalsite.data.PortfolioApi
import cn.lovemyrmb.personalsite.data.PortfolioCategory
import cn.lovemyrmb.personalsite.data.PortfolioDetail
import cn.lovemyrmb.personalsite.data.PortfolioItem
import cn.lovemyrmb.personalsite.data.PortfolioPage
import cn.lovemyrmb.personalsite.data.PortfolioProducts
import cn.lovemyrmb.personalsite.data.PortfolioViewModel
import cn.lovemyrmb.personalsite.ui.theme.PersonalSiteTheme
import kotlinx.coroutines.delay
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.IOException

/**
 * 集合页状态机（防抖加载/书架切换/搜索/失败重试）的仪器化测试。
 * PortfolioApi 是接口，直接用假实现喂固定数据，不触网（与 AskScreenTest 同策略）。
 * 等待一律门控在被断言的 UI 节点上：请求计数早于节点出现，不能作门控条件。
 */
@RunWith(AndroidJUnit4::class)
class PortfolioCollectionScreenTest {
    @get:Rule val compose = createComposeRule()

    private class FakePortfolioApi : PortfolioApi {
        @Volatile var failCollection = false
        @Volatile var collectionCalls = 0

        override suspend fun products(): PortfolioProducts = PortfolioProducts()
        override suspend fun collection(
            collection: String,
            q: String,
            cat: String,
            theme: String,
            offset: Long,
            limit: Int,
        ): PortfolioPage {
            collectionCalls++
            if (failCollection) throw IOException("network")
            delay(50)
            val items = when {
                q.isNotBlank() -> listOf(item("hit-1", "搜索命中作品"))
                cat == "c1" -> listOf(item("cat-1", "构图条目"))
                else -> listOf(item("all-1", "全部条目一"), item("all-2", "全部条目二"))
            }
            return PortfolioPage(
                items = items,
                total = items.size,
                hasMore = false,
                categories = listOf(PortfolioCategory("c1", "构图", 86)),
                topics = listOf(PortfolioCategory("t1", "经典法则", 15)),
            )
        }

        override suspend fun detail(collection: String, id: String): PortfolioDetail =
            PortfolioDetail(PortfolioItem(id = id))

        private fun item(id: String, title: String) = PortfolioItem(
            id = id,
            title = title,
            category = "构图逻辑",
            thumbnail = "",
        )
    }

    private fun setContent(api: FakePortfolioApi, collection: String = "layouts") {
        val viewModel = PortfolioViewModel(api)
        compose.setContent {
            PersonalSiteTheme {
                PortfolioCollectionScreen(
                    collection = collection,
                    viewModel = viewModel,
                    bottomPadding = 0.dp,
                    onBack = {},
                    onOpenItem = { _, _ -> },
                )
            }
        }
    }

    private fun waitUntilTextShown(text: String, timeoutMillis: Long = 5000L) {
        compose.waitUntil(timeoutMillis) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    @Test
    fun layoutsShowsShelfThenCategorySwitchesToFilteredGrid() {
        val api = FakePortfolioApi()
        setContent(api)
        // 防抖 250ms + 假接口延迟后，书架带假分类出现。
        waitUntilTextShown("从一本书开始")
        compose.onNodeWithText("从一本书开始").assertIsDisplayed()
        compose.onNodeWithText("构图").performClick()
        waitUntilTextShown("构图条目")
        compose.onNodeWithText("构图条目").assertIsDisplayed()
        compose.onNodeWithText("从一本书开始").assertDoesNotExist()
    }

    @Test
    fun searchShowsMatchingItemsAfterDebounce() {
        val api = FakePortfolioApi()
        setContent(api)
        // 此测试验证"搜索词经防抖窗口传入请求并渲染命中"；
        // 250ms 窗口本身由实现保证，不在此断言（单次 IME 提交无法区分有无防抖）。
        waitUntilTextShown("从一本书开始")
        compose.onNodeWithTag("portfolio-search").performTextInput("三分法")
        waitUntilTextShown("搜索命中作品")
        compose.onNodeWithText("搜索命中作品").assertIsDisplayed()
    }

    @Test
    fun initialFailureShowsRetryThenRecovers() {
        val api = FakePortfolioApi()
        api.failCollection = true
        setContent(api)
        waitUntilTextShown("重试")
        compose.onNodeWithText("重试").assertIsDisplayed()
        api.failCollection = false
        compose.onNodeWithText("重试").performClick()
        waitUntilTextShown("从一本书开始")
        compose.onNodeWithText("从一本书开始").assertIsDisplayed()
    }
}
