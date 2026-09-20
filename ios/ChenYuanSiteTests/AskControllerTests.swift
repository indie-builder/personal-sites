import Foundation
import Synchronization
import Testing

@testable import ChenYuanSite

/// 问一问会话控制器的状态机规格（「新对话」确认弹窗背后的逻辑）：
/// 输入校验、连接失败兜底、新对话重置、重试最近一问、流式中途取消。
/// 用 URLProtocol 桩让请求在任何环境（含 CI runner）都确定性可控，
/// 不依赖真实网络行为。用例共享进程级 URLProtocol/网络栈状态，
/// 并行运行时桩事件偶发丢失（多次实测非确定失败），故串行执行。
@Suite(.serialized)
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

    /// 挂起请求直到测试放行（或 session 取消触发 stopLoading 释放）：
    /// 用于验证流式中途 cancel 的状态迁移。信号量为类型共享，仅当前
    /// 单个用例使用；若将来复用，须在用例开头复位 received/gate。
    nonisolated private final class SuspendedURLProtocol: URLProtocol {
        nonisolated(unsafe) static let gate = DispatchSemaphore(value: 0)
        nonisolated(unsafe) static let received = Mutex(false)

        override class func canInit(with request: URLRequest) -> Bool { true }
        override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
        override func startLoading() {
            Self.received.withLock { $0 = true }
            Self.gate.wait()
            // 竞态窗口下本调用可能晚于 stopLoading 返回：task 已取消，
            // 此事件会被加载系统丢弃，不再送达 client 流。
            client?.urlProtocol(self, didFailWithError: URLError(.cancelled))
        }
        override func stopLoading() {
            Self.gate.signal()
        }
    }

    private func makeController() -> AskController {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [FailingURLProtocol.self]
        let client = AskClient(session: URLSession(configuration: configuration))
        return AskController(client: client, visitorId: "test-visitor-000000000000")
    }

    private func makeSuspendedController() -> AskController {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [SuspendedURLProtocol.self]
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

    /// 流式中途取消（「停止生成」按钮）：消息标记 stopped、streaming 复位、
    /// 不落入错误态（对应 UI 的「已停止生成」提示路径）。
    @Test func cancelMidStreamMarksStoppedWithoutError() async {
        let controller = makeSuspendedController()
        controller.send("介绍一下陈远", scope: .profile)
        #expect(controller.messages.count == 2)
        #expect(controller.streaming)
        // 等请求真正到达桩（挂起中），再触发取消。
        await waitUntil { SuspendedURLProtocol.received.withLock { $0 } }
        controller.cancel()
        #expect(controller.messages.count == 2)
        #expect(controller.messages[0].text == "介绍一下陈远")
        #expect(controller.messages[1].status == .stopped)
        #expect(!controller.streaming)
        #expect(controller.error == nil)
    }

    private func isStreaming(_ controller: AskController) -> Bool {
        controller.streaming
    }

    /// 上限 15s：CI runner 过载时（单个同步测试可达 12s）事件送达仍能收敛。
    private func waitUntil(
        _ condition: @MainActor () -> Bool,
        timeout: Duration = .seconds(15),
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
