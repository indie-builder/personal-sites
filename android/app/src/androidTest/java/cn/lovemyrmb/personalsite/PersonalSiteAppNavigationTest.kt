package cn.lovemyrmb.personalsite

import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasScrollToIndexAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import cn.lovemyrmb.personalsite.data.AiNewsDetailResponse
import cn.lovemyrmb.personalsite.data.AiNewsListItem
import cn.lovemyrmb.personalsite.data.CurationAuthor
import cn.lovemyrmb.personalsite.data.CurationItem
import cn.lovemyrmb.personalsite.data.CurationSource
import cn.lovemyrmb.personalsite.data.DetailEntry
import cn.lovemyrmb.personalsite.data.FeedPage
import cn.lovemyrmb.personalsite.data.OpenSourceListEntry
import cn.lovemyrmb.personalsite.data.PortfolioApi
import cn.lovemyrmb.personalsite.data.PortfolioCategory
import cn.lovemyrmb.personalsite.data.PortfolioDetail
import cn.lovemyrmb.personalsite.data.PortfolioItem
import cn.lovemyrmb.personalsite.data.PortfolioPage
import cn.lovemyrmb.personalsite.data.PortfolioProduct
import cn.lovemyrmb.personalsite.data.PortfolioProducts
import cn.lovemyrmb.personalsite.data.Section
import cn.lovemyrmb.personalsite.data.SiteApi
import cn.lovemyrmb.personalsite.ui.theme.PersonalSiteTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CopyOnWriteArrayList

/** Crosses the same app/container seam as MainActivity, including payload assignment and NavHost back stack. */
@RunWith(AndroidJUnit4::class)
class PersonalSiteAppNavigationTest {
    @get:Rule val compose = createComposeRule()

    @Test fun designListOpensFullPayloadAndBackRetainsSectionAndPosition() =
        openCurationAndReturn(Section.DESIGN)

    @Test fun dailyListOpensFullPayloadAndBackRetainsSectionAndPosition() =
        openCurationAndReturn(Section.CURATION)

    @Test fun douyinListOpensFullPayloadAndBackRetainsSectionAndPosition() =
        openCurationAndReturn(Section.DOUYIN)

    @Test fun layoutsReaderPagesAndBackRetainsSearchCategoryTopicAndGridPosition() =
        openCollectionAndReturn("layouts")

    @Test fun museReaderPagesAndBackRetainsSearchCategoryAndGridPosition() =
        openCollectionAndReturn("muse")

    @Test fun savedDetailWithRetainedAppOwnerRestoresPayloadAndReturnsToSelectedSection() =
        restoreCurationDetail(replaceContainer = false)

    @Test fun savedDetailWithNewAppOwnerPopsToSelectedSectionAndCanOpenAgain() =
        restoreCurationDetail(replaceContainer = true)

    private fun restoreCurationDetail(replaceContainer: Boolean) {
        val site = NavigationSiteApi()
        val portfolio = NavigationPortfolioApi()
        val originalContainer = AppContainer(ApplicationProvider.getApplicationContext(), site, portfolio)
        var container = originalContainer
        var disposals = 0
        val restoration = StateRestorationTester(compose)
        restoration.setContent {
            // Swap owners only after the tester saves and removes the old composition.
            // A plain variable keeps this from changing the live detail before state is saved.
            DisposableEffect(Unit) {
                onDispose {
                    disposals++
                    if (replaceContainer) {
                        container = AppContainer(ApplicationProvider.getApplicationContext(), site, portfolio)
                    }
                }
            }
            PersonalSiteTheme { PersonalSiteApp(container) }
        }
        waitForText("每日动态")
        val section = Section.DESIGN
        compose.onNodeWithText(section.label).performClick()
        val items = site.items(section)
        val item = items[12]
        val title = requireNotNull(item.title)
        val text = requireNotNull(item.text)
        waitForText(items.first().title!!)
        compose.onNode(verticalList() and hasAnyDescendant(hasText("${section.label}条目", substring = true)))
            .performScrollToIndex(12)
        val list = verticalList() and hasAnyDescendant(hasText(title))
        val position = scrollPosition(list)
        assertTrue("The test must leave the first list page", position > 0f)
        compose.onNodeWithText(title).performClick()
        waitForText(text)
        compose.onNodeWithContentDescription("返回").assertIsDisplayed()
        compose.runOnIdle { assertEquals(DetailEntry.Curation(section, item), container.pendingDetail) }

        restoration.emulateSavedInstanceStateRestore()

        compose.runOnIdle {
            assertEquals("The app composition must have been disposed for restoration", 1, disposals)
            assertEquals(!replaceContainer, container === originalContainer)
            assertEquals(
                if (replaceContainer) null else DetailEntry.Curation(section, item),
                container.pendingDetail,
            )
        }
        if (!replaceContainer) {
            waitForText(text)
            compose.onNodeWithText(title).assertIsDisplayed()
            compose.onNodeWithText(item.summary!!).assertIsDisplayed()
            compose.onNodeWithText(text).assertIsDisplayed()
            compose.onNodeWithText("#fixture-${section.name}").assertIsDisplayed()
            compose.onNodeWithContentDescription("返回").performClick()
        }
        waitForText(title)
        compose.onNodeWithText(section.label).assertIsSelected()
        compose.onNodeWithText(title).assertIsDisplayed()
        compose.onNodeWithText(text).assertDoesNotExist()
        compose.onNodeWithContentDescription("返回").assertDoesNotExist()
        assertEquals(position, scrollPosition(list), 0.01f)
        // After the empty-owner route pops, the retained list still assigns to the new owner.
        compose.onNodeWithText(title).performClick()
        waitForText(text)
        compose.onNodeWithText(text).assertIsDisplayed()
        compose.runOnIdle { assertEquals(DetailEntry.Curation(section, item), container.pendingDetail) }
        compose.onNodeWithContentDescription("返回").performClick()
        waitForText(title)
        compose.onNodeWithText(section.label).assertIsSelected()
    }

    private fun openCurationAndReturn(section: Section) {
        val site = NavigationSiteApi()
        val container = launchApp(site, NavigationPortfolioApi())
        // Later tabs start offscreen on narrow devices, including the CI emulator.
        compose.onNodeWithText(section.label).performScrollTo().assertIsDisplayed().performClick()
        val item = site.items(section)[12]
        waitForText(site.items(section).first().title!!)
        val list = verticalList() and hasAnyDescendant(hasText("${section.label}条目", substring = true))
        compose.onNode(list).performScrollToIndex(12)
        requireNotNull(item.title)
        compose.onNodeWithText(item.title).assertIsDisplayed()
        val position = scrollPosition(verticalList() and hasAnyDescendant(hasText(item.title)))
        assertTrue("The test must leave the first list page", position > 0f)
        compose.onNodeWithText(item.title).performClick()
        waitForText(item.text!!)
        compose.onNodeWithText(section.label).assertIsDisplayed()
        compose.onNodeWithText(item.title).assertIsDisplayed()
        compose.onNodeWithText(item.summary!!).assertIsDisplayed()
        compose.onNodeWithText(item.text).assertIsDisplayed()
        compose.onNodeWithText("#fixture-${section.name}").assertIsDisplayed()
        compose.runOnIdle { assertEquals(DetailEntry.Curation(section, item), container.pendingDetail) }

        compose.onNodeWithContentDescription("返回").performClick()
        waitForText(item.title)
        compose.onNodeWithText(section.label).assertIsSelected()
        compose.onNodeWithText(item.title).assertIsDisplayed()
        assertEquals(position, scrollPosition(verticalList() and hasAnyDescendant(hasText(item.title))), 0.01f)
        compose.onNodeWithText(item.text).assertDoesNotExist()
        // Opening another row must replace the previous owner-held payload through the real callback.
        val next = site.items(section)[13]
        compose.onNode(verticalList() and hasAnyDescendant(hasText(item.title)))
            .performScrollToIndex(13)
        requireNotNull(next.title)
        compose.onNodeWithText(next.title).performClick()
        waitForText(next.text!!)
        compose.onNodeWithText(item.text).assertDoesNotExist()
        compose.runOnIdle { assertEquals(DetailEntry.Curation(section, next), container.pendingDetail) }
        compose.onNodeWithContentDescription("返回").performClick()
        waitForText(next.title)
        compose.onNodeWithText(section.label).assertIsSelected()
    }

    private fun openCollectionAndReturn(collection: String) {
        val portfolio = NavigationPortfolioApi()
        val container = launchApp(NavigationSiteApi(), portfolio)
        compose.onNodeWithText("作品集").performClick()
        val title = if (collection == "layouts") "布局参考" else "灵感集"
        waitForText(title)
        compose.onNodeWithText(title).performClick()
        if (collection == "layouts") {
            waitForText("从一本书开始")
            compose.onNodeWithText("构图").performClick()
            waitForText("全部主题")
            compose.onNodeWithContentDescription("选择全部主题").performClick()
            compose.onNodeWithText("经典法则").performClick()
        } else {
            waitForText("全部分类")
            compose.onNodeWithContentDescription("选择全部分类").performClick()
            compose.onNodeWithText("构图").performClick()
        }
        compose.onNodeWithTag("portfolio-search").performTextInput("三分法")
        compose.onNodeWithTag("portfolio-search").performImeAction()
        val items = portfolio.items(collection)
        waitForText(items.first().title)
        val selected = items[10]
        compose.onNode(verticalList() and hasAnyDescendant(hasText(items.first().title)))
            .performScrollToIndex(10)
        compose.onNodeWithText(selected.title).assertIsDisplayed()
        val grid = verticalList() and hasAnyDescendant(hasText(selected.title))
        val position = scrollPosition(grid)
        assertTrue("The test must leave the first grid page", position > 0f)
        compose.onNodeWithText(selected.title).performClick()
        waitForText(selected.text)
        compose.onNodeWithText(selected.text).assertIsDisplayed()
        compose.onNodeWithText("11 / 24").assertIsDisplayed()
        compose.runOnIdle {
            val payload = container.pendingPortfolioReader!!
            assertEquals(collection, payload.collection)
            assertEquals(items, payload.items)
            assertEquals(10, payload.index)
        }
        compose.onNodeWithContentDescription("下一件").performClick()
        waitForText(items[11].text)
        compose.onNodeWithText("12 / 24").assertIsDisplayed()
        compose.onNodeWithText(items[11].text).assertIsDisplayed()
        compose.onNodeWithContentDescription("上一件").performClick()
        waitForText(selected.text)
        compose.onNodeWithText("11 / 24").assertIsDisplayed()
        compose.onNodeWithText(selected.text).assertIsDisplayed()
        compose.onNodeWithContentDescription("返回$title").performClick()

        waitForText(selected.title)
        compose.onNodeWithTag("portfolio-search").assertTextContains("三分法")
        compose.onNodeWithContentDescription("选择构图").assertIsDisplayed()
        if (collection == "layouts") compose.onNodeWithContentDescription("选择经典法则").assertIsDisplayed()
        compose.onNodeWithText(selected.title).assertIsDisplayed()
        assertEquals(position, scrollPosition(grid), 0.01f)
        // Reopen from the retained grid position to exercise a second assignment/navigation.
        compose.onNodeWithText(selected.title).performClick()
        waitForText(selected.text)
        compose.onNodeWithText("11 / 24").assertIsDisplayed()
        compose.onNodeWithContentDescription("返回$title").performClick()
        waitForText(selected.title)
        compose.runOnIdle {
            assertTrue(portfolio.detailRequests.contains(collection to selected.id))
            assertTrue(portfolio.detailRequests.contains(collection to items[11].id))
            assertTrue(portfolio.detailRequests.all { it.first == collection })
        }
        compose.onNodeWithContentDescription("返回").performClick()
        waitForText("设计参考与工程实践")
        compose.onNodeWithText(title).assertIsDisplayed()
    }

    private fun launchApp(site: SiteApi, portfolio: PortfolioApi): AppContainer {
        val container = AppContainer(ApplicationProvider.getApplicationContext(), site, portfolio)
        compose.setContent { PersonalSiteTheme { PersonalSiteApp(container) } }
        waitForText("每日动态")
        return container
    }

    private fun waitForText(text: String) {
        compose.waitUntil(5000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }

    private fun verticalList() = hasScrollToIndexAction() and
        SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange)

    private fun scrollPosition(matcher: SemanticsMatcher): Float =
        compose.onNode(matcher).fetchSemanticsNode().config[SemanticsProperties.VerticalScrollAxisRange].value()

    private class NavigationSiteApi : SiteApi {
        fun items(section: Section) = List(24) { index ->
            CurationItem(
                id = "${section.name}-$index",
                title = "${section.label}条目 $index",
                summary = "${section.label}导读 $index",
                text = "${section.label}列表携带的完整原帖 $index",
                tags = listOf("fixture-${section.name}"),
                author = CurationAuthor(handle = "fixture", name = "测试作者"),
                source = CurationSource(platform = if (section == Section.DOUYIN) "douyin" else "x"),
            )
        }
        override suspend fun aiNews(offset: Long, limit: Int): FeedPage<AiNewsListItem> = FeedPage()
        override suspend fun aiNewsDetail(id: String): AiNewsDetailResponse = error("Curation navigation must use its list payload")
        override suspend fun curation(offset: Long, limit: Int) = FeedPage(items = items(Section.CURATION))
        override suspend fun design(offset: Long, limit: Int) = FeedPage(items = items(Section.DESIGN))
        override suspend fun douyin(offset: Long, limit: Int) = FeedPage(items = items(Section.DOUYIN))
        override suspend fun openSource(offset: Long, limit: Int): FeedPage<OpenSourceListEntry> = FeedPage()
    }

    private class NavigationPortfolioApi : PortfolioApi {
        val detailRequests = CopyOnWriteArrayList<Pair<String, String>>()
        fun items(collection: String) = List(24) { index ->
            PortfolioItem(
                id = "$collection-$index",
                title = "$collection 筛选作品 $index",
                category = "构图",
                topic = "经典法则",
                author = "测试作者",
                text = "$collection 列表携带的全文 $index",
            )
        }
        override suspend fun products() = PortfolioProducts(listOf(
            PortfolioProduct(id = "layout-compositions", name = "布局参考"),
            PortfolioProduct(id = "muse", name = "灵感集"),
        ))
        override suspend fun collection(collection: String, q: String, cat: String, theme: String, offset: Long, limit: Int): PortfolioPage {
            val filtered = q == "三分法" && cat == "c1" && (collection != "layouts" || theme == "t1")
            return PortfolioPage(
                items = if (filtered) items(collection) else listOf(PortfolioItem(id = "unfiltered", title = "未筛选条目")),
                total = if (filtered) 24 else 1,
                categories = listOf(PortfolioCategory("c1", "构图", 24)),
                topics = listOf(PortfolioCategory("t1", "经典法则", 24)),
            )
        }
        override suspend fun detail(collection: String, id: String): PortfolioDetail {
            detailRequests.add(collection to id)
            return PortfolioDetail(items(collection).single { it.id == id })
        }
    }
}
