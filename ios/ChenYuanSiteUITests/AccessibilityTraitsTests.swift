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
        XCTAssertTrue(aiNewsTab.isSelected, "初始栏目（每日动态）应标记选中")

        let designTab = app.buttons["home-tab-api/design"]
        XCTAssertTrue(designTab.exists)
        XCTAssertFalse(designTab.isSelected, "未选中栏目不应标记选中")

        designTab.tap()
        let selectedAfterTap = app.buttons["home-tab-api/design"]
        XCTAssertTrue(selectedAfterTap.waitForExistence(timeout: 5))
        XCTAssertTrue(selectedAfterTap.isSelected, "点击后新栏目应标记选中")
        XCTAssertFalse(app.buttons["home-tab-api/ai-news"].isSelected, "切换后旧栏目不应保持选中")
    }

    @MainActor
    func testBottomBarSelectedTraitFollowsNavigation() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-skip-opening"]
        app.launch()

        let homeItem = app.buttons["bar-动态"]
        XCTAssertTrue(homeItem.waitForExistence(timeout: 10), "底栏「动态」未出现")
        XCTAssertTrue(homeItem.isSelected, "首页状态下「动态」应标记选中")

        let aboutItem = app.buttons["bar-关于我"]
        XCTAssertTrue(aboutItem.exists)
        XCTAssertFalse(aboutItem.isSelected)

        aboutItem.tap()
        let aboutSelected = app.buttons["bar-关于我"]
        XCTAssertTrue(aboutSelected.waitForExistence(timeout: 5))
        XCTAssertTrue(aboutSelected.isSelected, "进入关于我后应标记选中")
        XCTAssertFalse(app.buttons["bar-动态"].isSelected, "离开首页后「动态」不应保持选中")

        app.buttons["bar-动态"].tap()
        let homeSelected = app.buttons["bar-动态"]
        XCTAssertTrue(homeSelected.waitForExistence(timeout: 5))
        XCTAssertTrue(homeSelected.isSelected, "返回首页后「动态」应恢复选中")
    }
}
