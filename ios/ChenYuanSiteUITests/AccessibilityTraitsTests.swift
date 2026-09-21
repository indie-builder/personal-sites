import XCTest

/// 首页栏目 Tab 与玻璃底栏的无障碍选中语义：VoiceOver 必须能读出当前选中项
/// （对应安卓端 a11y 提交补齐的选中语义）。通过 accessibilityIdentifier 定位，
/// 断言 isSelected 随交互正确迁移。
/// 工程默认 MainActor 隔离与 XCTestCase 的 nonisolated 父类成员冲突：
/// 类保持 nonisolated，测试方法逐个标 @MainActor。
nonisolated final class AccessibilityTraitsTests: XCTestCase {
    @MainActor
    func testSectionTabSelectedTraitFollowsInteraction() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-skip-opening"]
        app.launch()

        let aiNewsTab = app.buttons["home-tab-api/ai-news"]
        XCTAssertTrue(aiNewsTab.waitForExistence(timeout: 10), "首页栏目 Tab 未出现")
        XCTAssertTrue(waitSelected(aiNewsTab), "初始栏目（每日动态）应标记选中")

        let designTab = app.buttons["home-tab-api/design"]
        XCTAssertTrue(designTab.exists)
        XCTAssertFalse(designTab.isSelected, "未选中栏目不应标记选中")

        let selectedAfterTap = app.buttons["home-tab-api/design"]
        XCTAssertTrue(tapAndAwaitSelected(selectedAfterTap), "点击后新栏目应标记选中")
        XCTAssertTrue(waitNotSelected(app.buttons["home-tab-api/ai-news"]), "切换后旧栏目不应保持选中")
    }

    @MainActor
    func testBottomBarSelectedTraitFollowsNavigation() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-skip-opening"]
        app.launch()

        let homeItem = app.buttons["bar-动态"]
        XCTAssertTrue(homeItem.waitForExistence(timeout: 10), "底栏「动态」未出现")
        XCTAssertTrue(waitSelected(homeItem), "首页状态下「动态」应标记选中")

        let aboutItem = app.buttons["bar-关于我"]
        XCTAssertTrue(aboutItem.exists)
        XCTAssertFalse(aboutItem.isSelected)

        let aboutSelected = app.buttons["bar-关于我"]
        XCTAssertTrue(tapAndAwaitSelected(aboutSelected), "进入关于我后应标记选中")
        XCTAssertTrue(waitNotSelected(app.buttons["bar-动态"]), "离开首页后「动态」不应保持选中")

        let homeSelected = app.buttons["bar-动态"]
        XCTAssertTrue(tapAndAwaitSelected(homeSelected), "返回首页后「动态」应恢复选中")
    }

    @MainActor
    func testNavigationPreservesSectionAndAboutIsIdempotent() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-skip-opening"]
        app.launch()
        let design = app.buttons["home-tab-api/design"]
        XCTAssertTrue(design.waitForExistence(timeout: 10))
        XCTAssertTrue(tapAndAwaitSelected(design))
        XCTAssertTrue(tapAndAwaitSelected(app.buttons["bar-关于我"]))
        app.buttons["bar-关于我"].tap()
        XCTAssertTrue(waitSelected(app.buttons["bar-关于我"]))
        XCTAssertTrue(tapAndAwaitSelected(app.buttons["bar-动态"]))
        XCTAssertTrue(waitSelected(app.buttons["home-tab-api/design"]))
        XCTAssertTrue(app.buttons["bar-作品集"].exists)
    }

    @MainActor
    func testAskDraftSurvivesDismissal() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-skip-opening", "-route-ask"]
        app.launch()
        let recommended = app.buttons["介绍一下陈远"]
        XCTAssertTrue(recommended.waitForExistence(timeout: 10))
        recommended.tap()
        let input = app.textFields["ask-input"]
        let populated = NSPredicate(format: "value == %@", "介绍一下陈远")
        expectation(for: populated, evaluatedWith: input)
        waitForExpectations(timeout: 5)
        app.buttons["返回"].tap()
        let ask = app.buttons["bar-问一问"]
        XCTAssertTrue(ask.waitForExistence(timeout: 5))
        ask.tap()
        XCTAssertTrue(input.waitForExistence(timeout: 5))
        XCTAssertEqual(input.value as? String, "介绍一下陈远")
        XCTAssertTrue(app.buttons["个人资料"].exists)
    }

    @MainActor
    func testPortfolioNativeBrowsing() throws {
        guard let base = ProcessInfo.processInfo.environment["PORTFOLIO_TEST_BASE_URL"] else {
            throw XCTSkip("需要运行 personal-design API 并指定 PORTFOLIO_TEST_BASE_URL")
        }
        let app = XCUIApplication()
        app.launchEnvironment["PORTFOLIO_BASE_URL"] = base
        app.launchArguments = ["-skip-opening", "-route-portfolio"]
        app.launch()
        let layouts = app.buttons["portfolio-layout-compositions"]
        XCTAssertTrue(layouts.waitForExistence(timeout: 15))
        layouts.tap()
        let book = app.buttons["layout-book-01-composition-logic"]
        XCTAssertTrue(book.waitForExistence(timeout: 15))
        XCTAssertEqual(app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "layout-book-")).count, 8)
        book.tap()
        let first = app.buttons["portfolio-item-001"]
        XCTAssertTrue(first.waitForExistence(timeout: 15))
        first.tap()
        XCTAssertTrue(app.buttons["放大图片"].waitForExistence(timeout: 15))
        app.buttons["完成"].tap()
        XCTAssertTrue(first.waitForExistence(timeout: 5))
        app.buttons["书架"].tap()
        XCTAssertTrue(book.waitForExistence(timeout: 5))
        book.tap()
        XCTAssertTrue(first.waitForExistence(timeout: 10))
        let search = app.textFields["portfolio-search"]
        search.tap()
        search.typeText("no-match-98273")
        XCTAssertTrue(app.staticTexts["没有找到内容"].waitForExistence(timeout: 10))
        app.buttons["清空搜索"].tap()
        XCTAssertTrue(first.waitForExistence(timeout: 10))
        app.buttons["返回"].tap()
        XCTAssertTrue(app.buttons["portfolio-muse"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["bar-作品集"].isSelected)
    }

    /// tap 返回到下一帧 trait 翻转之间存在快照时差：轮询等待isSelected 达到
    /// 期望值再断言，避免偶发快照过早（waitForExistence 对已存在元素立即返回）。
    /// 上限 5s：CI 重负载 runner 上快照与帧提交都可能显著变慢。
    @MainActor
    private func waitSelected(_ element: XCUIElement, timeout: TimeInterval = 5) -> Bool {
        waitTrait(element, expected: true, timeout: timeout)
    }

    @MainActor
    private func waitNotSelected(_ element: XCUIElement, timeout: TimeInterval = 5) -> Bool {
        waitTrait(element, expected: false, timeout: timeout)
    }

    @MainActor
    private func waitTrait(_ element: XCUIElement, expected: Bool, timeout: TimeInterval) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        var latest = !expected
        while Date() < deadline {
            latest = element.isSelected
            if latest == expected { return true }
            usleep(50_000)
        }
        return latest == expected
    }

    /// 点击并等待选中：合成触摸在高负载下偶发未命中（选中态全程未翻转），
    /// 短等未选中则补点一次再长等。重复点击同一目标幂等（选中态不变）。
    @MainActor
    private func tapAndAwaitSelected(_ element: XCUIElement) -> Bool {
        element.tap()
        if waitSelected(element, timeout: 2) { return true }
        element.tap()
        return waitSelected(element, timeout: 5)
    }
}
