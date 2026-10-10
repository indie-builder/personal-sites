import Foundation
import Testing

@testable import ChenYuanSite

/// 七个在售产品的目的地契约：四个原生页面，其余（含未知 id）打开统一站点产品页，不误入「个人网站」。
@MainActor
struct PortfolioDestinationTests {
    @Test(arguments: [
        ("layout-compositions", Route.portfolioCollection("layouts")),
        ("muse", Route.portfolioCollection("muse")),
        ("design-engineer-tools", Route.portfolioTools),
        ("personal-sites", Route.portfolioSite),
    ])
    func nativeDestinations(id: String, route: Route) {
        #expect(PortfolioView.nativeDestination(id) == route)
    }

    @Test(arguments: ["ai-coding-dictionary", "ai-chat", "word-arcade", "future-product"])
    func webProductsOpenUnifiedSiteProductPages(id: String) {
        #expect(PortfolioView.nativeDestination(id) == nil)
        #expect(PortfolioView.productPage(id) == URL(string: "https://default-coder.lovemyrmb.cn/products/\(id)"))
    }
}
