package cn.lovemyrmb.personalsite.data

/**
 * 详情页的跳转载体：列表 → 详情通过内存持有（与站内行为一致，
 * 列表数据已含全文与媒体），进程重建后为空时详情页回退返回。
 */
sealed interface DetailEntry {
    val section: Section
    val id: String

    data class AiNews(val itemId: String) : DetailEntry {
        override val section = Section.AI_NEWS
        override val id: String get() = itemId
    }

    data class Curation(override val section: Section, val item: CurationItem) : DetailEntry {
        override val id: String get() = item.id
    }

    data class OpenSource(val entry: OpenSourceListEntry) : DetailEntry {
        override val section = Section.OPEN_SOURCE
        override val id: String get() = entry.slug
    }
}

class EntryHolder {
    @Volatile
    var pending: DetailEntry? = null

    fun set(entry: DetailEntry) {
        pending = entry
    }
}
