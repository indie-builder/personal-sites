package cn.lovemyrmb.personalsite.data

import org.junit.Assert.assertEquals
import org.junit.Test

/** 七个在售产品的目的地契约：原生集合或统一站点产品页；未知 id 落在自己的产品页，不误跳旧作品集根路径。 */
class PortfolioDestinationTest {
    @Test
    fun nativeProductsOpenInAppCollections() {
        assertEquals(PortfolioDestination.NativeCollection("layouts"), PortfolioProduct(id = "layout-compositions").destination())
        assertEquals(PortfolioDestination.NativeCollection("muse"), PortfolioProduct(id = "muse").destination())
    }

    @Test
    fun webProductsOpenUnifiedSiteProductPages() {
        for (id in listOf("design-engineer-tools", "personal-sites", "ai-coding-dictionary", "ai-chat", "word-arcade")) {
            assertEquals("wrong destination for $id", PortfolioDestination.WebPage("https://default-coder.lovemyrmb.cn/products/$id"), PortfolioProduct(id = id).destination())
        }
    }

    @Test
    fun unknownProductOpensItsOwnProductPageInsteadOfWrongSite() {
        assertEquals(
            PortfolioDestination.WebPage("https://default-coder.lovemyrmb.cn/products/future-product"),
            PortfolioProduct(id = "future-product").destination(),
        )
    }
}
