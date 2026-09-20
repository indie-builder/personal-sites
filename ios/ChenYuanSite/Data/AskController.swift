import Foundation
import Observation

/// 问答界面的一条消息：question 是用户输入，answer 流式增长。
struct AskMessage: Identifiable, Equatable {
    enum Role: Equatable { case question, answer }
    enum Status: Equatable { case streaming, complete, stopped, error }

    let id: Int
    let role: Role
    var text: String = ""
    var sources: [AskSource] = []
    var status: Status = .complete
    var scope: AskScope = .all
}

/// 问一问会话控制器：SSE 事件归并到主线程状态；文本增量追加到末尾的 answer 消息上。
/// generation 计数器做代次隔离（停止/新对话后旧回调一律丢弃），语义与安卓 AskController 一致。
@MainActor
@Observable
final class AskController {
    private(set) var messages: [AskMessage] = []
    private(set) var streaming = false
    private(set) var error: String?

    private let client: AskClient
    private let visitorId: String
    private var conversationId = AskController.newConversationId()
    private var nextMessageID = 0
    private var generation = 0
    private var streamTask: Task<Void, Never>?

    init(client: AskClient, visitorId: String) {
        self.client = client
        self.visitorId = visitorId
    }

    func send(_ question: String, scope: AskScope = .all) {
        let trimmed = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (2...1000).contains(trimmed.count), !streaming else { return }
        generation += 1
        let requestGeneration = generation

        let answerID = makeMessageID()
        messages += [
            AskMessage(id: makeMessageID(), role: .question, text: trimmed, scope: scope),
            AskMessage(id: answerID, role: .answer, status: .streaming),
        ]
        streaming = true
        error = nil

        let conversation = conversationId
        let visitor = visitorId
        var appended = ""
        var sources: [AskSource] = []
        streamTask = Task { [client] in
            // 客户端把全部失败映射为 .error 事件，这里的 throw 仅覆盖流自身的取消。
            do {
                for try await event in client.events(
                    question: trimmed, conversationId: conversation, visitorId: visitor, scope: scope,
                ) {
                    guard requestGeneration == generation else { break }
                    switch event {
                    case .delta(let text):
                        appended += text
                        patchAnswer(answerID, appended, sources)
                    case .sources(let items):
                        sources = items
                        patchAnswer(answerID, appended, sources)
                    case .error(let message):
                        generation += 1
                        streamTask = nil
                        finishAnswer(.error, message: message)
                        return
                    case .done:
                        generation += 1
                        streamTask = nil
                        let answer = appended.isEmpty ? "（这次没有可回答的内容，换个问法试试。）" : appended
                        patchAnswer(answerID, answer, sources)
                        finishAnswer(.complete)
                        return
                    }
                }
            } catch {
                // 流异常终止：非取消场景由 UI 通过 retryLast 恢复。
            }
        }
    }

    func cancel() {
        generation += 1
        streamTask?.cancel()
        streamTask = nil
        if streaming {
            finishAnswer(.stopped)
        }
    }

    func newConversation() {
        cancel()
        conversationId = Self.newConversationId()
        messages = []
        streaming = false
        error = nil
    }

    func retryLast() {
        guard !streaming, messages.count >= 2, messages.last?.role == .answer else { return }
        let question = messages[messages.count - 2]
        guard question.role == .question else { return }
        messages = Array(messages.dropLast(2))
        send(question.text, scope: question.scope)
    }

    private func finishAnswer(_ status: AskMessage.Status, message: String? = nil) {
        streaming = false
        error = message
        for index in messages.indices where messages[index].status == .streaming {
            messages[index].status = status
        }
    }

    private func patchAnswer(_ answerID: Int, _ text: String, _ sources: [AskSource]) {
        guard let index = messages.firstIndex(where: { $0.id == answerID }) else { return }
        messages[index].text = text
        messages[index].sources = sources
    }

    private func makeMessageID() -> Int {
        nextMessageID += 1
        return nextMessageID
    }

    /// 服务端要求 [A-Za-z0-9_-]{16,128}：取 uuid 十六进制串（32 位）即可。
    private static func newConversationId() -> String {
        UUID().uuidString.replacingOccurrences(of: "-", with: "")
    }
}
