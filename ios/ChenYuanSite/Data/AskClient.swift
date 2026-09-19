import Foundation

/// /api/ask 的 SSE 事件（lib/ask-types.ts 契约的 App 侧投影）。
nonisolated enum AskEvent: Equatable, Sendable {
    case sources([AskSource])
    case delta(String)
    case done
    case error(String)
}

nonisolated enum AskScope: String, CaseIterable, Identifiable, Sendable {
    case all
    case profile
    case aiNews = "ai-news"
    case daily
    case openSource = "open-source"

    var id: String { rawValue }

    var apiValue: String { rawValue }

    var label: String {
        switch self {
        case .all: "全部资料"
        case .profile: "个人资料"
        case .aiNews: "每日动态"
        case .daily: "每日关注"
        case .openSource: "开源内容"
        }
    }
}

nonisolated struct AskSource: Decodable, Identifiable, Hashable, Sendable {
    var id = ""
    var sourceId = ""
    var content = ""
    var scope = ""
    var publishedAt: String?
    var title = ""
    var sourceUrl = ""
    var section: String?

    init(
        id: String = "",
        sourceId: String = "",
        content: String = "",
        scope: String = "",
        publishedAt: String? = nil,
        title: String = "",
        sourceUrl: String = "",
        section: String? = nil,
    ) {
        self.id = id
        self.sourceId = sourceId
        self.content = content
        self.scope = scope
        self.publishedAt = publishedAt
        self.title = title
        self.sourceUrl = sourceUrl
        self.section = section
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeString(.id)
        sourceId = try c.decodeString(.sourceId)
        content = try c.decodeString(.content)
        scope = try c.decodeString(.scope)
        publishedAt = try c.decodeIfPresent(String.self, forKey: .publishedAt)
        title = try c.decodeString(.title)
        sourceUrl = try c.decodeString(.sourceUrl)
        section = try c.decodeIfPresent(String.self, forKey: .section)
    }

    private enum CodingKeys: String, CodingKey {
        case id, sourceId, content, scope, publishedAt, title, sourceUrl, section
    }
}

/// 问一问流式客户端：POST /api/ask（SSE），逐行解析 event/data 帧。
/// 非 2xx 优先采用服务端 error 字段文案（route 契约），网络失败回退固定中文提示，
/// 全部以 AskEvent.error 返回由 UI 呈现。逐条移植安卓 AskClient 的帧协议语义。
nonisolated struct AskClient: Sendable {
    var baseURL: URL = SiteAPI.baseURL

    private let session: URLSession

    init(session: URLSession = Self.makeSession()) {
        self.session = session
    }

    private static func makeSession() -> URLSession {
        let configuration = URLSessionConfiguration.default
        // ask 专用长超时（安卓 readTimeout 300s 对应空闲读超时）。
        configuration.timeoutIntervalForRequest = 300
        configuration.timeoutIntervalForResource = 600
        return URLSession(configuration: configuration)
    }

    func events(question: String, conversationId: String, visitorId: String, scope: AskScope) -> AsyncThrowingStream<AskEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                await streamEvents(
                    question: question,
                    conversationId: conversationId,
                    visitorId: visitorId,
                    scope: scope,
                    continuation: continuation,
                )
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    private func streamEvents(
        question: String,
        conversationId: String,
        visitorId: String,
        scope: AskScope,
        continuation: AsyncThrowingStream<AskEvent, Error>.Continuation,
    ) async {
        struct Payload: Encodable {
            let conversationId: String
            let visitorId: String
            let question: String
            let scope: String
        }
        var request = URLRequest(url: baseURL.appending(path: "api/ask"))
        request.httpMethod = "POST"
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode(
            Payload(conversationId: conversationId, visitorId: visitorId, question: question, scope: scope.apiValue),
        )

        // 连接阶段失败：超时与网络不可用分别给文案（对应安卓 onFailure）。
        let bytes: URLSession.AsyncBytes
        let response: URLResponse
        do {
            (bytes, response) = try await session.bytes(for: request)
        } catch is CancellationError {
            return
        } catch {
            continuation.yield(.error(connectionErrorMessage(error)))
            return
        }

        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let status = (response as? HTTPURLResponse)?.statusCode ?? -1
            var body = Data()
            // 读取错误响应体用于解析 {"error": "..."}；读中断则回退固定文案。
            do {
                for try await byte in bytes {
                    body.append(byte)
                    if body.count > 64 * 1024 { break }
                }
            } catch {}
            continuation.yield(.error(Self.errorMessage(status: status, body: body)))
            return
        }

        // 帧组装：event: 行 + 多行 data:（空行分帧）。
        var currentEvent = ""
        var data = ""
        var terminal = false
        do {
            for try await line in Self.lines(bytes) {
                if line.isEmpty {
                    if let event = Self.parseFrame(event: currentEvent, data: data) {
                        continuation.yield(event)
                        if event.isTerminal { terminal = true }
                    }
                    currentEvent = ""
                    data = ""
                    if terminal { break }
                } else if line.hasPrefix("event:") {
                    currentEvent = String(line.dropFirst("event:".count)).trimmingCharacters(in: .whitespaces)
                } else if line.hasPrefix("data:") {
                    if !data.isEmpty { data += "\n" }
                    data += String(line.dropFirst("data:".count)).drop(while: { $0 == " " })
                }
            }
            if !terminal {
                if let event = Self.parseFrame(event: currentEvent, data: data), event.isTerminal {
                    continuation.yield(event)
                } else {
                    // EOF 未收到 done 视为错误。
                    continuation.yield(.error("连接提前结束了，请重试。"))
                }
            }
        } catch is CancellationError {
            // 用户主动停止：静默收尾，由控制器补 STOPPED 状态。
        } catch {
            continuation.yield(.error("连接中断了，请重试。"))
        }
    }

    /// URLSession.AsyncBytes.lines 会吞掉空行，而 SSE 依赖空行分帧，这里自己按字节切行。
    private static func lines(_ bytes: URLSession.AsyncBytes) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                var buffer: [UInt8] = []
                do {
                    for try await byte in bytes {
                        if byte == 0x0A {
                            continuation.yield(String(decoding: buffer, as: UTF8.self))
                            buffer.removeAll(keepingCapacity: true)
                        } else if byte != 0x0D {
                            buffer.append(byte)
                        }
                    }
                    if !buffer.isEmpty {
                        continuation.yield(String(decoding: buffer, as: UTF8.self))
                    }
                } catch is CancellationError {
                    // 上游取消时正常关闭行流。
                } catch {
                    continuation.finish(throwing: error)
                    return
                }
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    /// data 帧按 JSON 形状分发：delta→文本增量、sources→来源、message→错误、空对象→结束。
    static func parseFrame(event: String, data: String) -> AskEvent? {
        if data.isEmpty || data == "{}" {
            return event == "done" ? .done : nil
        }
        guard
            let json = try? JSONSerialization.jsonObject(with: Data(data.utf8), options: []),
            let object = json as? [String: Any]
        else {
            return .error("回答数据格式异常，请重试。")
        }
        if let delta = object["delta"] {
            guard let text = delta as? String else { return .error("回答数据格式异常，请重试。") }
            return .delta(text)
        }
        if let sources = object["sources"] {
            guard let array = sources as? [[String: Any]] else {
                return .error("引用或回答数据格式异常，请重试。")
            }
            var decoded: [AskSource] = []
            for (index, element) in array.enumerated() {
                guard var source = Self.decodeSource(element) else {
                    // 保留来源顺序；不能静默丢弃异常项，否则回答中的编号会指向错误资料。
                    return .error("引用或回答数据格式异常，请重试。")
                }
                if source.id.isEmpty { source.id = "index-\(index)" }
                decoded.append(source)
            }
            return .sources(decoded)
        }
        if let message = object["message"] {
            guard let text = message as? String else { return .error("回答数据格式异常，请重试。") }
            return .error(text)
        }
        if event == "done" { return .done }
        return nil
    }

    private static func decodeSource(_ object: [String: Any]) -> AskSource? {
        // content/title 等必须是字符串；出现其他类型视为异常项。
        for key in ["id", "sourceId", "content", "scope", "title", "sourceUrl"] {
            if let value = object[key], !(value is String) { return nil }
        }
        return AskSource(
            id: object["id"] as? String ?? "",
            sourceId: object["sourceId"] as? String ?? "",
            content: object["content"] as? String ?? "",
            scope: object["scope"] as? String ?? "",
            publishedAt: object["publishedAt"] as? String,
            title: object["title"] as? String ?? "",
            sourceUrl: object["sourceUrl"] as? String ?? "",
            section: object["section"] as? String,
        )
    }

    /// 非 2xx：服务端统一返回 {"error": "..."}；缺失、为空、非字符串或非 JSON 时回退固定文案。
    static func errorMessage(status: Int, body: Data) -> String {
        let fallback = status == 429 ? "提问过于频繁，请稍后再试。" : "暂时无法回答，请稍后再试。"
        guard let text = String(data: body, encoding: .utf8), !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return fallback
        }
        guard
            let json = try? JSONSerialization.jsonObject(with: body),
            let object = json as? [String: Any],
            let message = object["error"] as? String,
            !message.trimmingCharacters(in: .whitespaces).isEmpty
        else {
            return fallback
        }
        return message
    }

    private func connectionErrorMessage(_ error: Error) -> String {
        if let urlError = error as? URLError {
            if urlError.code == .timedOut { return "回答超时了，请稍后再试。" }
            if urlError.code == .cancelled { return "网络不可用，请检查连接后重试。" }
        }
        return "网络不可用，请检查连接后重试。"
    }
}

nonisolated extension AskEvent {
    var isTerminal: Bool {
        switch self {
        case .done, .error: true
        default: false
        }
    }
}
