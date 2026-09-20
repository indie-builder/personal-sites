import Foundation
import Testing

@testable import ChenYuanSite

/// 移植安卓 AskClientTest：SSE data 帧按 JSON 形状分发、引用保真、错误文案回退。
struct AskProtocolTests {
    @Test func deltaFrameYieldsText() {
        #expect(AskClient.parseFrame(event: "message", data: #"{"delta": "你好"}"#) == .delta("你好"))
    }

    @Test func sourcesFramePreservesOrder() {
        let data = #"{"sources": [{"title": "甲", "content": "c1"}, {"title": "乙", "content": "c2"}]}"#
        guard case let .sources(sources)? = AskClient.parseFrame(event: "message", data: data) else {
            Issue.record("期望 sources 事件")
            return
        }
        #expect(sources.map { $0.title } == ["甲", "乙"])
        #expect(sources[0].id == "index-0")
    }

    @Test func messageFrameBecomesError() {
        #expect(AskClient.parseFrame(event: "error", data: #"{"message": "提问过于频繁"}"#) == .error("提问过于频繁"))
    }

    @Test func emptyObjectOnlyFinishesWithDoneEvent() {
        #expect(AskClient.parseFrame(event: "done", data: "{}") == .done)
        #expect(AskClient.parseFrame(event: "done", data: "") == .done)
        #expect(AskClient.parseFrame(event: "message", data: "{}") == nil)
        #expect(AskClient.parseFrame(event: "message", data: "") == nil)
    }

    @Test func malformedFramesYieldErrors() {
        guard case let .error(message)? = AskClient.parseFrame(event: "message", data: "not-json") else {
            Issue.record("期望错误事件")
            return
        }
        #expect(message == "回答数据格式异常，请重试。")
        // 非字符串来源字段视为异常项，不能静默丢弃（否则编号指向错误资料）。
        guard case let .error(sourceMessage)? = AskClient.parseFrame(event: "message", data: #"{"sources": [{"title": 3}]}"#) else {
            Issue.record("期望错误事件")
            return
        }
        #expect(sourceMessage == "引用或回答数据格式异常，请重试。")
    }

    @Test func errorMessageFallsBackByStatus() {
        #expect(AskClient.errorMessage(status: 429, body: Data()) == "提问过于频繁，请稍后再试。")
        #expect(AskClient.errorMessage(status: 500, body: Data()) == "暂时无法回答，请稍后再试。")
        #expect(AskClient.errorMessage(status: 429, body: Data(#"{"error": "慢一点"}"#.utf8)) == "慢一点")
        #expect(AskClient.errorMessage(status: 500, body: Data("not-json".utf8)) == "暂时无法回答，请稍后再试。")
        #expect(AskClient.errorMessage(status: 500, body: Data(#"{"error": " "}"#.utf8)) == "暂时无法回答，请稍后再试。")
    }
}
