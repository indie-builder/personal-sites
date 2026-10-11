import Network
import Synchronization
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
            throw XCTSkip("需要运行站点 API 并指定 PORTFOLIO_TEST_BASE_URL")
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

    @MainActor
    func testRootListDetailBackRetainsPayloadSectionAndPosition() throws {
        let fixture = try SiteInteractionFixture()
        defer { fixture.stop() }
        let app = XCUIApplication()
        app.launchEnvironment["SITE_TEST_BASE_URL"] = fixture.baseURL
        app.launchArguments = ["-skip-opening", "-route-design"]
        app.launch()

        let row = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Design 08")).firstMatch
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Design 01")).firstMatch.waitForExistence(timeout: 10))
        for _ in 0..<8 {
            if row.exists && row.isHittable { break }
            app.swipeUp()
        }
        XCTAssertTrue(row.isHittable)
        let originalY = row.frame.minY
        let loads = fixture.requestCount("/api/design")
        row.tap()
        XCTAssertTrue(app.staticTexts["Full body for design 08"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Design 08"].exists)
        XCTAssertFalse(app.buttons["bar-动态"].exists)
        app.buttons["返回"].tap()
        XCTAssertTrue(app.buttons["home-tab-api/design"].waitForExistence(timeout: 5))
        XCTAssertTrue(waitSelected(app.buttons["home-tab-api/design"]))
        XCTAssertTrue(row.isHittable)
        XCTAssertEqual(row.frame.minY, originalY, accuracy: 2, "返回必须保留列表阅读位置")
        XCTAssertEqual(fixture.requestCount("/api/design"), loads, "返回不应重载已持有的列表")

        // 再开不同条目，防止跳转载体仍是上一次选择。
        let next = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Design 09")).firstMatch
        if !next.isHittable { app.swipeUp() }
        XCTAssertTrue(next.isHittable)
        next.tap()
        XCTAssertTrue(app.staticTexts["Full body for design 09"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["Full body for design 08"].exists)
        app.buttons["返回"].tap()
        XCTAssertTrue(waitSelected(app.buttons["home-tab-api/design"]))
        XCTAssertTrue(next.isHittable)
        XCTAssertTrue(app.buttons["bar-动态"].exists)
    }

    @MainActor
    func testRootNewsListOpensSelectedDetailID() throws {
        let fixture = try SiteInteractionFixture()
        defer { fixture.stop() }
        let app = XCUIApplication()
        app.launchEnvironment["SITE_TEST_BASE_URL"] = fixture.baseURL
        app.launchArguments = ["-skip-opening"]
        app.launch()
        let row = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "News two")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        row.tap()
        XCTAssertTrue(app.staticTexts["Reason for news two"].waitForExistence(timeout: 5))
        XCTAssertEqual(fixture.requestCount("/api/ai-news/news-two"), 1)
        XCTAssertEqual(fixture.requestCount("/api/ai-news/news-one"), 0)
        app.buttons["返回"].tap()
        XCTAssertTrue(row.waitForExistence(timeout: 5))
        XCTAssertTrue(waitSelected(app.buttons["home-tab-api/ai-news"]))
        XCTAssertTrue(app.buttons["bar-动态"].exists)
    }

    @MainActor
    func testMarkdownCitationTapsInParagraphListAndQuote() throws {
        let fixture = try SiteInteractionFixture()
        defer { fixture.stop() }
        let app = XCUIApplication()
        app.launchEnvironment["SITE_TEST_BASE_URL"] = fixture.baseURL
        app.launchArguments = ["-skip-opening", "-route-ask"]
        app.launch()
        let recommendation = app.buttons["介绍一下陈远"]
        XCTAssertTrue(recommendation.waitForExistence(timeout: 10))
        recommendation.tap()
        app.buttons["ask-send"].tap()
        XCTAssertTrue(app.buttons["重新生成回答"].waitForExistence(timeout: 10))
        XCTAssertEqual(fixture.requestCount("/api/ask"), 1)

        for number in 1...3 {
            let citation = app.links["[\(number)]"]
            XCTAssertTrue(citation.waitForExistence(timeout: 5), "正文引用必须提供可交互链接\n\(app.debugDescription)")
            citation.tap()
            XCTAssertTrue(app.buttons["返回对话"].waitForExistence(timeout: 5))
            XCTAssertTrue(app.staticTexts["引用 \(number)"].exists)
            XCTAssertTrue(app.staticTexts["Evidence body \(number)"].exists, "链接应把零起始索引传给正确资料")
            app.buttons["返回对话"].tap()
            XCTAssertTrue(citation.waitForExistence(timeout: 5))
        }

        for invalid in ["Invalid zero [0]", "Invalid high [4]"] {
            let text = app.staticTexts[invalid]
            XCTAssertTrue(text.exists, "越界引用应保留为正文")
            text.tap()
            XCTAssertFalse(app.buttons["返回对话"].exists)
            XCTAssertTrue(app.buttons["ask-send"].exists)
        }
        XCTAssertFalse(app.links["[0]"].exists)
        XCTAssertFalse(app.links["[4]"].exists)
        XCTAssertEqual(app.links.count, 3)
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

/// XCUITest 与应用分进程：只在 runner 内提供固定的公开接口响应。
/// 随机 localhost 端口、串行请求队列，结束时关闭监听与所有连接。
nonisolated private final class SiteInteractionFixture: Sendable {
    private let listener: NWListener
    private let queue = DispatchQueue(label: "site-interaction-fixture", qos: .userInteractive)
    private let requests = Mutex<[String: Int]>([:])
    private let connections = Mutex<[NWConnection]>([])
    var baseURL: String { "http://127.0.0.1:\(listener.port!.rawValue)/" }

    init() throws {
        listener = try NWListener(using: .tcp, on: .any)
        listener.newConnectionHandler = { [weak self] connection in
            guard let self else { connection.cancel(); return }
            self.connections.withLock { $0.append(connection) }
            connection.start(queue: self.queue)
            self.receive(connection, buffer: Data())
        }
        let ready = DispatchSemaphore(value: 0)
        listener.stateUpdateHandler = { state in
            switch state {
            case .ready, .failed: ready.signal()
            default: break
            }
        }
        listener.start(queue: queue)
        guard ready.wait(timeout: .now() + 5) == .success, listener.port != nil else {
            listener.cancel()
            throw NSError(domain: "SiteInteractionFixture", code: 1)
        }
        // 先确认 runner 内真实 HTTP 可达；失败立即停止，避免整段 UI 超时。
        let fetched = DispatchSemaphore(value: 0)
        let valid = Mutex(false)
        let session = URLSession(configuration: .ephemeral)
        defer { session.invalidateAndCancel() }
        session.dataTask(with: URL(string: baseURL + "fixture-ready")!) { data, response, error in
            valid.withLock { $0 = error == nil && (response as? HTTPURLResponse)?.statusCode == 200 && data != nil }
            fetched.signal()
        }.resume()
        guard fetched.wait(timeout: .now() + 5) == .success,
              valid.withLock({ $0 }), requestCount("/fixture-ready") == 1 else {
            stop()
            throw NSError(domain: "SiteInteractionFixture.HTTPProbe", code: 2)
        }
    }

    func requestCount(_ path: String) -> Int { requests.withLock { $0[path, default: 0] } }

    func stop() {
        listener.cancel()
        connections.withLock { active in
            for connection in active { connection.cancel() }
            active.removeAll()
        }
    }

    private func receive(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65_536) { [weak self] data, _, complete, error in
            guard let self else { return }
            var received = buffer
            if let data { received.append(data) }
            guard let headerEnd = received.range(of: Data("\r\n\r\n".utf8)) else {
                if complete || error != nil { connection.cancel() }
                else { self.receive(connection, buffer: received) }
                return
            }
            let headers = String(decoding: received[..<headerEnd.lowerBound], as: UTF8.self)
            let length = headers.components(separatedBy: "\r\n").first { $0.lowercased().hasPrefix("content-length:") }
                .flatMap { Int($0.split(separator: ":", maxSplits: 1)[1].trimmingCharacters(in: .whitespaces)) } ?? 0
            guard received.count >= headerEnd.upperBound + length else {
                self.receive(connection, buffer: received)
                return
            }
            let target = headers.split(separator: " ").dropFirst().first.map(String.init) ?? "/"
            let path = String(target.split(separator: "?")[0])
            self.requests.withLock { $0[path, default: 0] += 1 }
            let (contentType, body) = Self.response(path)
            let bytes = Data(body.utf8)
            var response = Data("HTTP/1.1 200 OK\r\nContent-Type: \(contentType)\r\nContent-Length: \(bytes.count)\r\nConnection: close\r\n\r\n".utf8)
            response.append(bytes)
            connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
        }
    }

    private static func response(_ path: String) -> (String, String) {
        let object: [String: Any]
        switch path {
        case "/api/design":
            object = ["hasMore": false, "items": (1...16).map { number in
                let suffix = String(format: "%02d", number)
                return ["id": "design-\(suffix)", "title": "Design \(suffix)",
                        "summary": "Guide for design \(suffix)", "text": "Full body for design \(suffix)",
                        "media": [], "author": ["handle": "fixture"],
                        "source": ["platform": "x"]] as [String: Any]
            }]
        case "/api/ai-news":
            object = ["hasMore": false, "items": [
                ["id": "news-one", "title": "News one", "summary": "First guide"],
                ["id": "news-two", "title": "News two", "summary": "Second guide"],
            ]]
        case "/api/ai-news/news-two":
            object = ["item": ["id": "news-two", "title": "News two", "reason": "Reason for news two"]]
        case "/api/ask":
            let sources = (1...3).map { ["id": "source-\($0)", "title": "Evidence \($0)", "content": "Evidence body \($0)"] }
            let markdown = "Paragraph 【1】\n\n- List [2]\n\n> Quote 【3】\n\nInvalid zero [0]\n\nInvalid high [4]"
            let events: [(String, [String: Any])] = [("sources", ["sources": sources]), ("delta", ["delta": markdown]), ("done", [:])]
            return ("text/event-stream", events.map { event, data in
                "event: \(event)\ndata: \(json(data))\n\n"
            }.joined())
        default:
            object = ["hasMore": false, "items": []]
        }
        return ("application/json", json(object))
    }

    private static func json(_ object: [String: Any]) -> String {
        String(decoding: try! JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]), as: UTF8.self)
    }
}
