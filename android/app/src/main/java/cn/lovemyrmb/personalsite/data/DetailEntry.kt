package cn.lovemyrmb.personalsite.data

/**
 * 详情页的跳转载体：列表 → 详情通过内存持有（与站内行为一致，
 * 列表数据已含全文与媒体），进程重建后为空时详情页回退返回。
 */
sealed interface DetailEntry {
    data class AiNews(val id: String) : DetailEntry

    data class Curation(val section: Section, val item: CurationItem) : DetailEntry

    data class OpenSource(val entry: OpenSourceListEntry) : DetailEntry
}
