package cn.lovemyrmb.personalsite.data

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

const val PORTFOLIO_BASE_URL = "https://portfolio.default-coder.lovemyrmb.cn/"

/** 作品集产品入口（/api/portfolio）：layouts / muse 原生浏览，其余产品跳站点网页。 */
@Serializable
data class PortfolioProduct(
    val id: String = "",
    val name: String = "",
    val summary: String = "",
    val description: String = "",
    val date: String = "",
    val dateLabel: String = "",
    val cover: String = "",
)

@Serializable
data class PortfolioProducts(val items: List<PortfolioProduct> = emptyList())

@Serializable
data class PortfolioCategory(val id: String = "", val name: String = "", val count: Int = 0)

@Serializable
data class PortfolioMedia(
    val id: String = "",
    val kind: String = "image",
    val url: String = "",
    val poster: String = "",
    val width: Int = 0,
    val height: Int = 0,
) {
    val isVideo: Boolean get() = kind == "video"
    val aspect: Float get() = if (width > 0 && height > 0) width.toFloat() / height else 4f / 3f
}

@Serializable
data class PortfolioItem(
    val id: String = "",
    val title: String = "",
    val category: String = "",
    val topic: String = "",
    val author: String = "",
    val text: String = "",
    @SerialName("sourceURL") val sourceUrl: String = "",
    val thumbnail: String = "",
    val media: List<PortfolioMedia> = emptyList(),
)

@Serializable
data class PortfolioPage(
    val items: List<PortfolioItem> = emptyList(),
    val total: Int = 0,
    val hasMore: Boolean = false,
    val categories: List<PortfolioCategory> = emptyList(),
    val topics: List<PortfolioCategory> = emptyList(),
    val attribution: String = "",
)

@Serializable
data class PortfolioDetail(val item: PortfolioItem)

/** 作品集公共 API（personal-design 服务所有）：GET /api/portfolio[/{collection}[/{id}]]。 */
interface PortfolioApi {
    @GET("api/portfolio")
    suspend fun products(): PortfolioProducts

    @GET("api/portfolio/{collection}")
    suspend fun collection(
        @Path("collection") collection: String,
        @Query("q") q: String = "",
        @Query("cat") cat: String = "",
        @Query("theme") theme: String = "",
        @Query("offset") offset: Long = 0,
        @Query("limit") limit: Int = 24,
    ): PortfolioPage

    @GET("api/portfolio/{collection}/{id}")
    suspend fun detail(@Path("collection") collection: String, @Path("id") id: String): PortfolioDetail
}

/** 集合页头部信息：总数、可筛选的分类/主题与来源署名，按筛选键隔离避免竞态覆盖。 */
data class PortfolioMeta(
    val total: Int = 0,
    val categories: List<PortfolioCategory> = emptyList(),
    val topics: List<PortfolioCategory> = emptyList(),
    val attribution: String = "",
)

/** 落地页产品列表状态：items 为 null 表示尚未成功加载过。 */
data class PortfolioProductsState(
    val items: List<PortfolioProduct>? = null,
    val refreshing: Boolean = false,
    val refreshError: Boolean = false,
)

/**
 * 作品集浏览状态：分页复用 [PagedFeed]（去重/触底/失败文案与站点栏目一致），
 * 每个筛选组合一个实例（LRU 上限 8，搜索逐字输入时旧实例被淘汰）。
 */
class PortfolioViewModel(private val api: PortfolioApi) : ViewModel() {
    private val _products = MutableStateFlow(PortfolioProductsState())
    val products: StateFlow<PortfolioProductsState> = _products.asStateFlow()

    private val _meta = MutableStateFlow<Map<String, PortfolioMeta>>(emptyMap())
    val meta: StateFlow<Map<String, PortfolioMeta>> = _meta.asStateFlow()

    private var productsLoaded = false

    private val feeds = object : LinkedHashMap<String, PagedFeed<PortfolioItem>>(16, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, PagedFeed<PortfolioItem>>) = size > 8
    }

    /** 首次进入拉取产品列表；已成功加载过则复用，配置变更不重拉。 */
    fun loadProducts() {
        if (productsLoaded || _products.value.refreshing) return
        requestProducts()
    }

    /** 下拉刷新；失败时保留已有列表并置 refreshError 供轻提示。 */
    fun refreshProducts() {
        if (_products.value.refreshing) return
        requestProducts()
    }

    private fun requestProducts() {
        _products.value = _products.value.copy(refreshing = true, refreshError = false)
        viewModelScope.launch {
            val result = runCatching { api.products().items }
            val current = _products.value
            result.fold(
                onSuccess = { items ->
                    productsLoaded = true
                    _products.value = PortfolioProductsState(items = items, refreshing = false)
                },
                onFailure = { e ->
                    android.util.Log.w("Portfolio", "products load failed", e)
                    _products.value = current.copy(refreshing = false, refreshError = true)
                },
            )
        }
    }

    fun feedKey(collection: String, q: String, cat: String, theme: String) = "$collection|$q|$cat|$theme"

    fun feed(collection: String, q: String, cat: String, theme: String): PagedFeed<PortfolioItem> {
        val key = feedKey(collection, q, cat, theme)
        synchronized(feeds) { return feeds.getOrPut(key) { createFeed(key, collection, q, cat, theme) } }
    }

    private fun createFeed(key: String, collection: String, q: String, cat: String, theme: String) =
        PagedFeed(viewModelScope, idOf = PortfolioItem::id) { offset ->
            val page = api.collection(collection, q, cat, theme, offset)
            _meta.value = _meta.value + (key to PortfolioMeta(page.total, page.categories, page.topics, page.attribution))
            FeedPage(page.hasMore, page.items)
        }
}

/**
 * 阅读器的跳转载体：集合网格 → 全屏阅读，携带同屏条目支持前后翻页。
 * 进程重建后为空时阅读器回退返回（与详情页 EntryHolder 同策略）。
 */
class PortfolioReaderHolder {
    @Volatile
    var pending: ReaderPayload? = null

    data class ReaderPayload(
        val collection: String,
        val items: List<PortfolioItem>,
        val index: Int,
    )

    fun open(collection: String, items: List<PortfolioItem>, index: Int) {
        pending = ReaderPayload(collection, items, index)
    }
}
