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
