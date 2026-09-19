import Foundation
import Testing

@testable import ChenYuanSite

/// 问一问会话控制器的状态机规格（「新对话」确认弹窗背后的逻辑）：
/// 输入校验、连接失败兜底、新对话重置、重试最近一问。
/// 用 URLProtocol 桩让请求在任何环境（含 CI runner）都确定性失败，
/// 不依赖真实网络行为。
@MainActor
struct AskControllerTests {
    /// 拦截一切请求并立即报连接失败：send 后毫秒级进入错误态。
    /// URLProtocol 由加载系统在任意线程调用，须保持 nonisolated。
    nonisolated private final class FailingURLProtocol: URLProtocol {
        override class func canInit(with request: URLRequest) -> Bool { true }
        override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
        override func startLoading() {
            client?.urlProtocol(self, didFailWithError: URLError(.cannotConnectToHost))
        }
        override func stopLoading() {}
    }

    private func makeController() -> AskController {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [FailingURLProtocol.self]
        let client = AskClient(session: URLSession(configuration: configuration))
        return AskController(client: client, visitorId: "test-visitor-000000000000")
    }

    @Test func sendRejectsShortQuestion() {
        let controller = makeController()
        controller.send("问")
        #expect(controller.messages.isEmpty)
        #expect(!controller.streaming)
        #expect(controller.error == nil)
    }

    @Test func connectionFailureFinishesAnswerWithError() async {
        let controller = makeController()
        controller.send("介绍一下陈远", scope: .profile)
        #expect(controller.messages.count == 2)
        await waitUntil { !self.isStreaming(controller) && controller.error != nil }
        #expect(controller.messages.count == 2)
        #expect(controller.messages[0].role == .question)
        #expect(controller.messages[0].text == "介绍一下陈远")
        #expect(controller.messages[1].role == .answer)
        #expect(controller.messages[1].status == .error)
    }

    @Test func newConversationClearsMessagesAndError() async {
        let controller = makeController()
        controller.send("介绍一下陈远")
        await waitUntil { controller.error != nil }
        controller.newConversation()
        #expect(controller.messages.isEmpty)
        #expect(!controller.streaming)
        #expect(controller.error == nil)
    }

    @Test func retryLastDropsFailedPairAndResendsQuestion() async {
        let controller = makeController()
        controller.send("介绍一下陈远")
        await waitUntil { controller.error != nil }
        controller.retryLast()
        // 旧的一对被移除，新的一对立即入列且问题原文保留。
        #expect(controller.messages.count == 2)
        #expect(controller.messages[0].text == "介绍一下陈远")
        #expect(controller.streaming)
        #expect(controller.error == nil)
        await waitUntil { !self.isStreaming(controller) && controller.error != nil }
    }

    private func isStreaming(_ controller: AskController) -> Bool {
        controller.streaming
    }

    private func waitUntil(
        _ condition: @MainActor () -> Bool,
        timeout: Duration = .seconds(5),
    ) async {
        let deadline = ContinuousClock.now + timeout
        while !condition() {
            guard ContinuousClock.now < deadline else {
                Issue.record("等待状态变更超时")
                return
            }
            await Task.yield()
            try? await Task.sleep(for: .milliseconds(5))
        }
    }
}
