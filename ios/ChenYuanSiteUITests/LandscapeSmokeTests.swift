import XCTest

/// 横屏冒烟：应用声明支持左右横屏（InfoPlist UISupportedInterfaceOrientations），
/// 关键界面元素在横屏下必须仍然存在可交互。旋转状态由 XCUIDevice 驱动，
/// 用例结束恢复竖屏，避免污染后续用例。
nonisolated final class LandscapeSmokeTests: XCTestCase {
    @MainActor
    func testLandscapeHomeRendersKeyElements() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchArguments = ["-skip-opening"]
        app.launch()
        defer { XCUIDevice.shared.orientation = .portrait }

        XCTAssertTrue(app.buttons["home-tab-api/ai-news"].waitForExistence(timeout: 10), "横屏首页栏目 Tab 未出现")
        XCTAssertTrue(app.buttons["bar-动态"].exists, "横屏玻璃底栏未出现")

        XCUIDevice.shared.orientation = .landscapeRight
        XCTAssertTrue(app.buttons["bar-问一问"].exists, "右横屏下底栏未出现")
        XCTAssertTrue(app.buttons["home-tab-api/ai-news"].exists, "右横屏下栏目导航未出现")
    }
}
