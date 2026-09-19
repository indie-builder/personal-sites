import Foundation

// 站点公共接口模型：与安卓端 data/Models.kt 一一对应（JSON 字段名一致）。
// 服务端字段可能缺省或为 null，全部按安卓 coerceInputValues 语义给默认值。

/// 站点公共信息流接口的统一分页包装：{ hasMore, items }。
/// Decodable 为条件遵循，保持 PagedFeed 对元素类型无额外约束。
nonisolated struct FeedPage<Value> {
    var hasMore: Bool = false
    var items: [Value] = []

    init(hasMore: Bool, items: [Value]) {
        self.hasMore = hasMore
        self.items = items
    }
}

nonisolated extension FeedPage: Decodable where Value: Decodable {
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        hasMore = try container.decodeIfPresent(Bool.self, forKey: .hasMore) ?? false
        items = try container.decodeIfPresent([Value].self, forKey: .items) ?? []
    }

    private enum CodingKeys: String, CodingKey { case hasMore, items }
}

nonisolated extension FeedPage: @unchecked Sendable where Value: Sendable {}

nonisolated struct AiNewsListItem: Decodable, Identifiable, Sendable {
    var category: String = ""
    var id: String = ""
    var publishedAt: String?
    var selected: Bool = false
    var sourceName: String = ""
    var summary: String = ""
    var title: String = ""

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        category = try c.decodeString(.category)
        id = try c.decodeString(.id)
        publishedAt = try c.decodeIfPresent(String.self, forKey: .publishedAt)
        selected = try c.decodeIfPresent(Bool.self, forKey: .selected) ?? false
        sourceName = try c.decodeString(.sourceName)
        summary = try c.decodeString(.summary)
        title = try c.decodeString(.title)
    }

    private enum CodingKeys: String, CodingKey {
        case category, id, publishedAt, selected, sourceName, summary, title
    }
}

/// /api/ai-news/{id} 返回的完整条目（含 reason/score/url）。
nonisolated struct AiNewsItem: Decodable, Identifiable, Sendable {
    var category: String = ""
    var id: String = ""
    var publishedAt: String?
    var reason: String = ""
    var score: Int?
    var selected: Bool = false
    var sourceName: String = ""
    var summary: String = ""
    var title: String = ""
    var url: String = ""

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        category = try c.decodeString(.category)
        id = try c.decodeString(.id)
        publishedAt = try c.decodeIfPresent(String.self, forKey: .publishedAt)
        reason = try c.decodeString(.reason)
        score = try c.decodeIfPresent(Int.self, forKey: .score)
        selected = try c.decodeIfPresent(Bool.self, forKey: .selected) ?? false
        sourceName = try c.decodeString(.sourceName)
        summary = try c.decodeString(.summary)
        title = try c.decodeString(.title)
        url = try c.decodeString(.url)
    }

    private enum CodingKeys: String, CodingKey {
        case category, id, publishedAt, reason, score, selected, sourceName, summary, title, url
    }
}

nonisolated struct AiNewsDetailResponse: Decodable, Sendable {
    var item: AiNewsItem

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        item = try c.decode(AiNewsItem.self, forKey: .item)
    }

    private enum CodingKeys: String, CodingKey { case item }
}

nonisolated struct CurationAuthor: Decodable, Sendable {
    static let empty = CurationAuthor()

    var handle: String = ""
    var name: String = ""

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        handle = try c.decodeString(.handle)
        name = try c.decodeString(.name)
    }

    private enum CodingKeys: String, CodingKey { case handle, name }
}

nonisolated struct CurationMedia: Decodable, Identifiable, Sendable {
    var durationMs: Int64?
    var height: Int?
    var previewUrl: String?
    var type: String = "photo"
    var url: String = ""
    var videoUrl: String?
    var width: Int?

    /// 与安卓一致：同一媒体以 url 作为稳定标识。
    var id: String { url }

    var isVideo: Bool { type == "video" || type == "animated_gif" }
    var posterURL: String { previewUrl ?? url }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        durationMs = try c.decodeIfPresent(Int64.self, forKey: .durationMs)
        height = try c.decodeIfPresent(Int.self, forKey: .height)
        previewUrl = try c.decodeIfPresent(String.self, forKey: .previewUrl)
        type = try c.decodeString(.type, default: "photo")
        url = try c.decodeString(.url)
        videoUrl = try c.decodeIfPresent(String.self, forKey: .videoUrl)
        width = try c.decodeIfPresent(Int.self, forKey: .width)
    }

    private enum CodingKeys: String, CodingKey {
        case durationMs, height, previewUrl, type, url, videoUrl, width
    }
}

nonisolated struct CurationSource: Decodable, Sendable {
    static let empty = CurationSource()

    var label: String = ""
    var platform: String = ""
    var url: String = ""

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        label = try c.decodeString(.label)
        platform = try c.decodeString(.platform)
        url = try c.decodeString(.url)
    }

    private enum CodingKeys: String, CodingKey { case label, platform, url }
}

/// 每日关注 / 设计收藏 / 抖音收藏共用的条目结构。
nonisolated struct CurationItem: Decodable, Identifiable, Sendable {
    var author: CurationAuthor = CurationAuthor.empty
    var collectedAt: String?
    var id: String = ""
    var media: [CurationMedia] = []
    var publishedAt: String?
    var source: CurationSource = CurationSource.empty
    var summary: String?
    var tags: [String] = []
    var text: String?
    var title: String?
    var attachments: [String] = []

    /// 列表/详情统一展示时间：X 用发布时间，抖音用收录日期。
    var displayTime: String? { publishedAt ?? collectedAt }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        author = (try? c.decodeIfPresent(CurationAuthor.self, forKey: .author)) ?? CurationAuthor.empty
        collectedAt = try c.decodeIfPresent(String.self, forKey: .collectedAt)
        id = try c.decodeString(.id)
        media = (try? c.decodeIfPresent([CurationMedia].self, forKey: .media)) ?? []
        publishedAt = try c.decodeIfPresent(String.self, forKey: .publishedAt)
        source = (try? c.decodeIfPresent(CurationSource.self, forKey: .source)) ?? CurationSource.empty
        summary = try c.decodeIfPresent(String.self, forKey: .summary)
        tags = (try? c.decodeIfPresent([String].self, forKey: .tags)) ?? []
        text = try c.decodeIfPresent(String.self, forKey: .text)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        attachments = (try? c.decodeIfPresent([String].self, forKey: .attachments)) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case author, collectedAt, id, media, publishedAt, source, summary, tags, text, title, attachments
    }
}

nonisolated struct OpenSourceListEntry: Decodable, Identifiable, Sendable {
    var category: String = ""
    var checkedAt: String = ""
    var dimensions: [String] = []
    var repository: String = ""
    /// 用作分页去重与跳转 id。
    var slug: String = ""
    var sourceSummary: String = ""
    var status: String = ""
    var type: String = ""

    var id: String { slug }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        category = try c.decodeString(.category)
        checkedAt = try c.decodeString(.checkedAt)
        dimensions = (try? c.decodeIfPresent([String].self, forKey: .dimensions)) ?? []
        repository = try c.decodeString(.repository)
        slug = try c.decodeString(.slug)
        sourceSummary = try c.decodeString(.sourceSummary)
        status = try c.decodeString(.status)
        type = try c.decodeString(.type)
    }

    private enum CodingKeys: String, CodingKey {
        case category, checkedAt, dimensions, repository, slug, sourceSummary, status, type
    }
}

/// 顶部栏目：label 是站点导航用词，path 是公共 API 路径，pageSize 与站点客户端一致。
enum Section: CaseIterable, Identifiable, Sendable {
    case aiNews
    case curation
    case design
    case douyin
    case openSource

    var id: String { path }

    /// TabView/底栏使用的固定序号。
    var index: Int {
        switch self {
        case .aiNews: 0
        case .curation: 1
        case .design: 2
        case .douyin: 3
        case .openSource: 4
        }
    }

    var label: String {
        switch self {
        case .aiNews: "每日动态"
        case .curation: "每日关注"
        case .design: "设计收藏"
        case .douyin: "抖音收藏"
        case .openSource: "开源关注"
        }
    }

    var path: String {
        switch self {
        case .aiNews: "api/ai-news"
        case .curation: "api/curation"
        case .design: "api/design"
        case .douyin: "api/douyin"
        case .openSource: "api/open-source"
        }
    }

    var pageSize: Int {
        switch self {
        case .aiNews: 50
        default: 20
        }
    }
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

nonisolated private let aiNewsCategoryLabels: [String: String] = [
    "ai-models": "模型",
    "ai-products": "产品",
    "industry": "行业",
    "paper": "论文",
    "tip": "教程",
]

nonisolated func aiNewsCategoryLabel(_ category: String) -> String {
    aiNewsCategoryLabels[category] ?? category
}

// 与安卓 Json { ignoreUnknownKeys, coerceInputValues } 等价的容错读取。
nonisolated extension KeyedDecodingContainer {
    func decodeString(_ key: K, default: String = "") throws -> String {
        let value = try? decodeIfPresent(String.self, forKey: key)
        return value ?? `default`
    }
}
