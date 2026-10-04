import Foundation

// 站点公共接口模型：与安卓端 data/Models.kt 对应（JSON 字段名一致）。
// 解码统一走 JSONKey + decode(_:default:)/decodeOptional(_:) 容错读取：
// 字段缺失、为 null 或类型不符时取默认值，对齐安卓 Json
// { ignoreUnknownKeys, coerceInputValues }。

/// JSON 键直取：键名即字段名，模型无需逐个声明 CodingKeys。
nonisolated private struct JSONKey: CodingKey {
    let stringValue: String

    init(_ string: String) { stringValue = string }
    init?(stringValue: String) { self.stringValue = stringValue }
    var intValue: Int? { nil }
    init?(intValue: Int) { nil }
}

nonisolated private extension KeyedDecodingContainer where K == JSONKey {
    /// 非可选字段的容错读取。
    func decode<Value: Decodable>(_ key: String, default: Value) -> Value {
        (try? decodeIfPresent(Value.self, forKey: JSONKey(key))) ?? `default`
    }

    /// 可选字段的容错读取：类型不符同样收敛为 nil。
    func decodeOptional<Value: Decodable>(_ key: String) -> Value? {
        try? decodeIfPresent(Value.self, forKey: JSONKey(key))
    }
}

/// 站点公共信息流接口的统一分页包装：{ hasMore, items }。
/// Decodable 为条件遵循，保持 PagedFeed 对元素类型无额外约束。
nonisolated struct FeedPage<Value> {
    var hasMore = false
    var items: [Value] = []
}

nonisolated extension FeedPage: Decodable where Value: Decodable {
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: JSONKey.self)
        hasMore = c.decode("hasMore", default: false)
        items = c.decode("items", default: [])
    }
}

nonisolated extension FeedPage: @unchecked Sendable where Value: Sendable {}

/// /api/ai-news 列表与详情共用条目（详情多出 reason/score/url，列表缺省为空）。
nonisolated struct AiNewsItem: Decodable, Identifiable, Sendable {
    var category = ""
    var id = ""
    var publishedAt: String?
    var reason = ""
    var selected = false
    var sourceName = ""
    var summary = ""
    var title = ""
    var url = ""

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: JSONKey.self)
        category = c.decode("category", default: "")
        id = c.decode("id", default: "")
        publishedAt = c.decodeOptional("publishedAt")
        reason = c.decode("reason", default: "")
        selected = c.decode("selected", default: false)
        sourceName = c.decode("sourceName", default: "")
        summary = c.decode("summary", default: "")
        title = c.decode("title", default: "")
        url = c.decode("url", default: "")
    }
}

/// /api/ai-news/{id} 的应答包装。
nonisolated struct AiNewsDetailResponse: Decodable, Sendable {
    let item: AiNewsItem
}

nonisolated struct CurationAuthor: Decodable, Sendable {
    var handle = ""
    var name = ""

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: JSONKey.self)
        handle = c.decode("handle", default: "")
        name = c.decode("name", default: "")
    }
}

nonisolated struct CurationMedia: Decodable, Identifiable, Sendable {
    var height: Int?
    var previewUrl: String?
    var width: Int?
    var url = ""
    var videoUrl: String?

    /// Identifiable 一致性保留；渲染按位置键（对齐安卓 forEach 语义），
    /// 无消费点依赖 url 唯一性。
    var id: String { url }

    var posterURL: String { previewUrl ?? url }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: JSONKey.self)
        height = c.decodeOptional("height")
        previewUrl = c.decodeOptional("previewUrl")
        width = c.decodeOptional("width")
        url = c.decode("url", default: "")
        videoUrl = c.decodeOptional("videoUrl")
    }
}

nonisolated struct CurationSource: Decodable, Sendable {
    var label = ""
    var platform = ""
    var url = ""

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: JSONKey.self)
        label = c.decode("label", default: "")
        platform = c.decode("platform", default: "")
        url = c.decode("url", default: "")
    }
}

/// 每日关注 / 设计收藏 / 抖音收藏共用的条目结构。
nonisolated struct CurationItem: Decodable, Identifiable, Sendable {
    var author = CurationAuthor()
    var collectedAt: String?
    var id = ""
    var media: [CurationMedia] = []
    var publishedAt: String?
    var source = CurationSource()
    var summary: String?
    var tags: [String] = []
    var text: String?
    var title: String?
    var attachments: [String] = []

    /// 列表/详情统一展示时间：X 用发布时间，抖音用收录日期。
    var displayTime: String? { publishedAt ?? collectedAt }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: JSONKey.self)
        author = c.decode("author", default: CurationAuthor())
        collectedAt = c.decodeOptional("collectedAt")
        id = c.decode("id", default: "")
        media = c.decode("media", default: [])
        publishedAt = c.decodeOptional("publishedAt")
        source = c.decode("source", default: CurationSource())
        summary = c.decodeOptional("summary")
        tags = c.decode("tags", default: [])
        text = c.decodeOptional("text")
        title = c.decodeOptional("title")
        attachments = c.decode("attachments", default: [])
    }
}

nonisolated struct OpenSourceListEntry: Decodable, Identifiable, Sendable {
    var checkedAt = ""
    var dimensions: [String] = []
    var repository = ""
    var slug = ""
    var sourceSummary = ""
    var status = ""
    var type = ""

    /// 用作分页去重与跳转 id。
    var id: String { slug }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: JSONKey.self)
        checkedAt = c.decode("checkedAt", default: "")
        dimensions = c.decode("dimensions", default: [])
        repository = c.decode("repository", default: "")
        slug = c.decode("slug", default: "")
        sourceSummary = c.decode("sourceSummary", default: "")
        status = c.decode("status", default: "")
        type = c.decode("type", default: "")
    }
}

/// 顶部栏目：label 是站点导航用词，path 是公共 API 路径，pageSize 与站点客户端一致。
nonisolated struct Section: Identifiable, Hashable, Sendable {
    let label: String
    let path: String
    let pageSize: Int

    var id: String { path }

    static let allCases = [aiNews, curation, design, douyin, openSource]
    static let aiNews = Section(label: "每日动态", path: "api/ai-news", pageSize: 50)
    static let curation = Section(label: "每日关注", path: "api/curation", pageSize: 20)
    static let design = Section(label: "设计收藏", path: "api/design", pageSize: 20)
    static let douyin = Section(label: "抖音收藏", path: "api/douyin", pageSize: 20)
    static let openSource = Section(label: "开源关注", path: "api/open-source", pageSize: 20)
}

/// 开源关注维度 id 的中文标签（与 lib/open-source-types.ts 对齐）。
nonisolated let dimensionLabels: [String: String] = [
    "agent-skills": "Agent Skills",
    "coding-agent": "Coding Agent",
    "agent-runtime": "Agent 运行时",
    "long-running": "长程 Agent",
    "multi-agent": "多智能体协作",
    "agent-control": "Agent 控制面",
    "agent-infra": "Agent 基础设施",
    "agent-context": "Agent 上下文",
    "local-retrieval": "本地检索",
    "model-gateway": "模型网关",
    "ai-ingestion": "AI 数据入口",
]

nonisolated private let aiNewsCategoryLabels = [
    "ai-models": "模型",
    "ai-products": "产品",
    "industry": "行业",
    "paper": "论文",
    "tip": "教程",
]

nonisolated func aiNewsCategoryLabel(_ category: String) -> String {
    aiNewsCategoryLabels[category] ?? category
}
