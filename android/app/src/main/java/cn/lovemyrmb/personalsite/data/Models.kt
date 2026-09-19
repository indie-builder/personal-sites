package cn.lovemyrmb.personalsite.data

import kotlinx.serialization.Serializable

/** 站点公共信息流接口的统一分页包装：{ hasMore, items }。 */
@Serializable
data class FeedPage<T>(
    val hasMore: Boolean = false,
    val items: List<T> = emptyList(),
)

@Serializable
data class AiNewsListItem(
    val category: String = "",
    val id: String,
    val publishedAt: String? = null,
    val selected: Boolean = false,
    val sourceName: String = "",
    val summary: String = "",
    val title: String = "",
)

/** /api/ai-news/[id] 返回的完整条目（含 reason/score/url）。 */
@Serializable
data class AiNewsItem(
    val category: String = "",
    val id: String = "",
    val publishedAt: String? = null,
    val reason: String = "",
    val score: Int? = null,
    val selected: Boolean = false,
    val sourceName: String = "",
    val summary: String = "",
    val title: String = "",
    val url: String = "",
)

@Serializable
data class AiNewsDetailResponse(
    val item: AiNewsItem,
)

@Serializable
data class CurationAuthor(
    val handle: String = "",
    val name: String = "",
)

@Serializable
data class CurationMedia(
    val durationMs: Long? = null,
    val height: Int? = null,
    val previewUrl: String? = null,
    val type: String = "photo",
    val url: String = "",
    val videoUrl: String? = null,
    val width: Int? = null,
) {
    val isVideo: Boolean get() = type == "video" || type == "animated_gif"
    val posterUrl: String get() = previewUrl ?: url
}

@Serializable
data class CurationSource(
    val label: String = "",
    val platform: String = "",
    val url: String = "",
)

/** 每日关注 / 设计收藏 / 抖音收藏共用的条目结构。 */
@Serializable
data class CurationItem(
    val author: CurationAuthor = CurationAuthor(),
    val collectedAt: String? = null,
    val id: String,
    val media: List<CurationMedia> = emptyList(),
    val publishedAt: String? = null,
    val source: CurationSource = CurationSource(),
    val summary: String? = null,
    val tags: List<String> = emptyList(),
    val text: String? = null,
    val title: String? = null,
    val attachments: List<String> = emptyList(),
) {
    /** 列表/详情统一展示时间：X 用发布时间，抖音用收录日期。 */
    val displayTime: String? get() = publishedAt ?: collectedAt
}

@Serializable
data class OpenSourceListEntry(
    val category: String = "",
    val checkedAt: String = "",
    val dimensions: List<String> = emptyList(),
    val repository: String = "",
    val slug: String = "",
    val sourceSummary: String = "",
    val status: String = "",
    val type: String = "",
)

/** 顶部栏目：label 是站点导航用词，path 是公共 API 路径，pageSize 与站点客户端一致。 */
enum class Section(val label: String, val path: String, val pageSize: Int) {
    AI_NEWS("每日动态", "api/ai-news", 50),
    CURATION("每日关注", "api/curation", 20),
    DESIGN("设计收藏", "api/design", 20),
    DOUYIN("抖音收藏", "api/douyin", 20),
    OPEN_SOURCE("开源关注", "api/open-source", 20),
}

/** 开源关注维度 id 的中文标签（与 lib/open-source-types.ts 对齐）。 */
val dimensionLabels = mapOf(
    "agent-skills" to "Agent Skills",
    "coding-agent" to "Coding Agent",
    "agent-runtime" to "Agent 运行时",
    "long-running" to "长程 Agent",
    "multi-agent" to "多智能体协作",
    "agent-control" to "Agent 控制面",
    "agent-infra" to "Agent 基础设施",
    "agent-context" to "Agent 上下文",
    "local-retrieval" to "本地检索",
    "model-gateway" to "模型网关",
    "ai-ingestion" to "AI 数据入口",
)

private val aiNewsCategoryLabels = mapOf(
    "ai-models" to "模型",
    "ai-products" to "产品",
    "industry" to "行业",
    "paper" to "论文",
    "tip" to "教程",
)

fun aiNewsCategoryLabel(category: String) = aiNewsCategoryLabels[category] ?: category
