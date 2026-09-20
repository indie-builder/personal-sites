import Foundation

// 站点公共接口模型：与安卓端 data/Models.kt 对应（JSON 字段名一致）。
// 解码统一走 JSONKey + decode(_:default:)/decodeOptional(_:) 容错读取：
// 字段缺失、为 null 或类型不符时取默认值，对齐安卓 Json
// { ignoreUnknownKeys, coerceInputValues }。

/// JSON 键直取：键名即字段名，模型无需逐个声明 CodingKeys。
nonisolated struct JSONKey: CodingKey {
    let stringValue: String

    init(_ string: String) { stringValue = string }
    init?(stringValue: String) { self.stringValue = stringValue }
    var intValue: Int? { nil }
    init?(intValue: Int) { nil }
}

nonisolated extension KeyedDecodingContainer where K == JSONKey {
    /// 非可选字段的容错读取。
    func decode<Value: Decodable>(_ key: String, default: Value) throws -> Value {
        (try? decodeIfPresent(Value.self, forKey: JSONKey(key))) ?? `default`
    }

    /// 可选字段的容错读取：类型不符同样收敛为 nil。
    func decodeOptional<Value: Decodable>(_ key: String) throws -> Value? {
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
        hasMore = try c.decode("hasMore", default: false)
        items = try c.decode("items", default: [])
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
        category = try c.decode("category", default: "")
        id = try c.decode("id", default: "")
        publishedAt = try c.decodeOptional("publishedAt")
        reason = try c.decode("reason", default: "")
        selected = try c.decode("selected", default: false)
        sourceName = try c.decode("sourceName", default: "")
        summary = try c.decode("summary", default: "")
        title = try c.decode("title", default: "")
        url = try c.decode("url", default: "")
    }
}

/// /api/ai-news/{id} 的应答包装。
nonisolated struct AiNewsDetailResponse: Decodable, Sendable {
    let item: AiNewsItem

    init(from decoder: Decoder) throws {
        item = try decoder.container(keyedBy: JSONKey.self).decode(AiNewsItem.self, forKey: JSONKey("item"))
    }
}

nonisolated struct CurationAuthor: Decodable, Sendable {
    var handle = ""
    var name = ""

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: JSONKey.self)
        handle = try c.decode("handle", default: "")
        name = try c.decode("name", default: "")
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
        height = try c.decodeOptional("height")
        previewUrl = try c.decodeOptional("previewUrl")
        width = try c.decodeOptional("width")
        url = try c.decode("url", default: "")
        videoUrl = try c.decodeOptional("videoUrl")
    }
}

nonisolated struct CurationSource: Decodable, Sendable {
    var label = ""
    var platform = ""
    var url = ""

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: JSONKey.self)
        label = try c.decode("label", default: "")
        platform = try c.decode("platform", default: "")
        url = try c.decode("url", default: "")
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
        author = try c.decode("author", default: CurationAuthor())
        collectedAt = try c.decodeOptional("collectedAt")
        id = try c.decode("id", default: "")
        media = try c.decode("media", default: [])
        publishedAt = try c.decodeOptional("publishedAt")
        source = try c.decode("source", default: CurationSource())
        summary = try c.decodeOptional("summary")
        tags = try c.decode("tags", default: [])
        text = try c.decodeOptional("text")
        title = try c.decodeOptional("title")
        attachments = try c.decode("attachments", default: [])
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
        checkedAt = try c.decode("checkedAt", default: "")
        dimensions = try c.decode("dimensions", default: [])
        repository = try c.decode("repository", default: "")
        slug = try c.decode("slug", default: "")
        sourceSummary = try c.decode("sourceSummary", default: "")
        status = try c.decode("status", default: "")
        type = try c.decode("type", default: "")
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
