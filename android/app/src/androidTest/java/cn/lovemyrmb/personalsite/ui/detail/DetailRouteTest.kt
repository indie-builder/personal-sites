package cn.lovemyrmb.personalsite.ui.detail

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import cn.lovemyrmb.personalsite.AppContainer
import cn.lovemyrmb.personalsite.data.CurationItem
import cn.lovemyrmb.personalsite.data.DetailEntry
import cn.lovemyrmb.personalsite.data.Section
import cn.lovemyrmb.personalsite.ui.theme.PersonalSiteTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DetailRouteTest {
    @get:Rule val compose = createComposeRule()

    @Test fun curationDetailReadsFullPayloadFromAppOwnerAndReturns() {
        val container = AppContainer(ApplicationProvider.getApplicationContext())
        container.pendingDetail = DetailEntry.Curation(
            Section.DESIGN,
            CurationItem(id = "fixture", title = "跳转标题", summary = "导读", text = "列表携带的完整原帖"),
        )
        var returned = 0
        compose.setContent {
            PersonalSiteTheme {
                DetailRoute(container.pendingDetail, container.api, PaddingValues(), { returned++ })
            }
        }
        compose.onNodeWithText("设计收藏").assertIsDisplayed()
        compose.onNodeWithText("跳转标题").assertIsDisplayed()
        compose.onNodeWithText("导读").assertIsDisplayed()
        compose.onNodeWithText("列表携带的完整原帖").assertIsDisplayed()
        compose.onNodeWithContentDescription("返回").performClick()
        compose.runOnIdle { assertEquals(1, returned) }
    }

    @Test fun emptyAppOwnerReturnsInsteadOfShowingStaleDetail() {
        val container = AppContainer(ApplicationProvider.getApplicationContext())
        var returned = 0
        compose.setContent {
            PersonalSiteTheme {
                DetailRoute(container.pendingDetail, container.api, PaddingValues(), { returned++ })
            }
        }
        compose.runOnIdle { assertEquals(1, returned) }
    }
}
