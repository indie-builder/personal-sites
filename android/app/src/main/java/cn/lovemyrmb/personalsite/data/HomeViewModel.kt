package cn.lovemyrmb.personalsite.data

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** 信息流页面的统一 UI 状态：首屏加载 / 追加 / 下拉刷新 / 失败各有标记。 */
data class FeedState<T>(
    val items: List<T> = emptyList(),
    val hasMore: Boolean = true,
    val initial: Boolean = true,
    val loadingMore: Boolean = false,
    val refreshing: Boolean = false,
    val error: String? = null,
)

/**
 * offset/limit 分页加载器：与站点 use-stream-feed 同策略——按 id 去重
 * （服务端 offset 向下取整可能带来重复条目）、触底追加、失败可重试。
 */
class PagedFeed<T>(
    private val scope: kotlinx.coroutines.CoroutineScope,
    private val idOf: (T) -> String,
    private val pageSize: Int,
    private val fetch: suspend (offset: Long) -> FeedPage<T>,
) {
    private val _state = MutableStateFlow(FeedState<T>())
    val state: StateFlow<FeedState<T>> = _state.asStateFlow()

    private var started = false

    fun loadInitial() {
        if (started) return
        started = true
        request(offset = 0, append = false)
    }

    fun refresh() {
        if (_state.value.refreshing) return
        request(offset = 0, append = false, refreshing = true)
    }

    fun loadMore() {
        val current = _state.value
        if (!current.hasMore || current.loadingMore || current.refreshing || current.error != null) return
        if (current.items.isEmpty()) {
            loadInitial()
            return
        }
        request(offset = current.items.size.toLong(), append = true)
    }

    fun retry() {
        val current = _state.value
        if (current.items.isEmpty()) {
            started = false
            _state.value = current.copy(error = null, initial = true)
            loadInitial()
        } else {
            _state.value = current.copy(error = null)
            loadMore()
        }
    }

    private fun request(offset: Long, append: Boolean, refreshing: Boolean = false) {
        _state.value = _state.value.copy(
            loadingMore = append,
            refreshing = refreshing,
            error = null,
        )
        scope.launch {
            val result = runCatching { fetch(offset) }
            val current = _state.value
            result.fold(
                onSuccess = { page ->
                    val merged = if (append) current.items + page.items else page.items
                    // 与站点一致：客户端按 id 去重，取整造成的重复条目直接丢弃。
                    val seen = HashSet<String>(merged.size)
                    val deduped = merged.filter { seen.add(idOf(it)) }
                    _state.value = FeedState(
                        items = deduped,
                        hasMore = page.hasMore,
                        initial = false,
                        loadingMore = false,
                        refreshing = false,
                        error = null,
                    )
                },
                onFailure = { e ->
                    _state.value = current.copy(
                        initial = false,
                        loadingMore = false,
                        refreshing = false,
                        error = "暂时无法加载更多内容，请重试。",
                    )
                    if (append || refreshing) android.util.Log.w("PagedFeed", "feed load failed", e)
                },
            )
        }
    }
}

class HomeViewModel(private val api: SiteApi) : ViewModel() {
    val aiNews = PagedFeed(viewModelScope, idOf = AiNewsListItem::id, pageSize = Section.AI_NEWS.pageSize) { offset ->
        api.aiNews(offset, Section.AI_NEWS.pageSize)
    }
    val curation = PagedFeed(viewModelScope, idOf = CurationItem::id, pageSize = Section.CURATION.pageSize) { offset ->
        api.curation(offset, Section.CURATION.pageSize)
    }
    val design = PagedFeed(viewModelScope, idOf = CurationItem::id, pageSize = Section.DESIGN.pageSize) { offset ->
        api.design(offset, Section.DESIGN.pageSize)
    }
    val douyin = PagedFeed(viewModelScope, idOf = CurationItem::id, pageSize = Section.DOUYIN.pageSize) { offset ->
        api.douyin(offset, Section.DOUYIN.pageSize)
    }
    val openSource = PagedFeed(viewModelScope, idOf = OpenSourceListEntry::slug, pageSize = Section.OPEN_SOURCE.pageSize) { offset ->
        api.openSource(offset, Section.OPEN_SOURCE.pageSize)
    }

    fun loadInitial(section: Section) {
        feed(section).loadInitial()
    }

    fun refresh(section: Section) {
        feed(section).refresh()
    }

    fun loadMore(section: Section) {
        feed(section).loadMore()
    }

    fun retry(section: Section) {
        feed(section).retry()
    }

    private fun feed(section: Section) = when (section) {
        Section.AI_NEWS -> aiNews
        Section.CURATION -> curation
        Section.DESIGN -> design
        Section.DOUYIN -> douyin
        Section.OPEN_SOURCE -> openSource
    }
}
