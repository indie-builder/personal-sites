package cn.lovemyrmb.personalsite.ui.portfolio

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import cn.lovemyrmb.personalsite.data.PortfolioItem
import cn.lovemyrmb.personalsite.data.PortfolioViewModel
import cn.lovemyrmb.personalsite.ui.components.ErrorRetry
import cn.lovemyrmb.personalsite.ui.components.SiteSpinner
import cn.lovemyrmb.personalsite.ui.icons.SiteIcons
import cn.lovemyrmb.personalsite.ui.theme.SiteSpace
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import kotlinx.coroutines.delay

/** 集合页四态过渡键：书架态仅此页存在，单独成相位。 */
private enum class CollectionPhase { INITIAL, ERROR, SHELF, CONTENT }

/** 集合浏览页：搜索 + 分类/主题筛选（layouts 另有书架），网格触底分页。 */
@Composable
fun PortfolioCollectionScreen(
    collection: String,
    viewModel: PortfolioViewModel,
    bottomPadding: Dp,
    onBack: () -> Unit,
    onOpenItem: (items: List<PortfolioItem>, index: Int) -> Unit,
) {
    val title = if (collection == "layouts") "布局参考" else "灵感集"
    var query by rememberSaveable { mutableStateOf("") }
    var category by rememberSaveable { mutableStateOf("") }
    var topic by rememberSaveable { mutableStateOf("") }
    var browsingAll by rememberSaveable { mutableStateOf(false) }
    var feed by remember(collection) { mutableStateOf<cn.lovemyrmb.personalsite.data.PagedFeed<PortfolioItem>?>(null) }

    fun currentFeed() = viewModel.feed(collection, query.trim(), category, topic)
    // 搜索逐字输入防抖后切换列表订阅；窗口内操作仍使用当前筛选。
    LaunchedEffect(collection, query, category, topic) {
        delay(250)
        val next = currentFeed()
        feed = next
        next.loadInitial()
    }
    val metadata by viewModel.meta.collectAsStateWithLifecycle()
    val meta = metadata.forFilter(collection, query.trim(), category, topic)
    val emptyState = remember { kotlinx.coroutines.flow.MutableStateFlow(cn.lovemyrmb.personalsite.data.FeedState<PortfolioItem>()) }
    val state by (feed?.state ?: emptyState).collectAsStateWithLifecycle()
    val onShelf = collection == "layouts" && category.isEmpty() && topic.isEmpty() &&
        query.isBlank() && !browsingAll

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SiteTheme.colors.background)
            .statusBarsPadding(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = SiteSpace.compact, vertical = 4.dp),
        ) {
            IconButton(onClick = onBack) { Icon(SiteIcons.ArrowBack, "返回", tint = SiteTheme.colors.ink) }
            Text(title, style = SiteText.title, color = SiteTheme.colors.ink)
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .padding(horizontal = SiteSpace.paragraph)
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(SiteTheme.colors.line),
        ) {
            Icon(
                imageVector = SiteIcons.Search,
                contentDescription = null,
                tint = SiteTheme.colors.muted,
                modifier = Modifier.padding(start = SiteSpace.related).size(20.dp),
            )
            TextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("搜索$title", style = SiteText.body, color = SiteTheme.colors.muted) },
                textStyle = SiteText.body,
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                ),
                modifier = Modifier.weight(1f).testTag("portfolio-search"),
            )
            if (query.isNotEmpty()) {
                IconButton(onClick = { query = "" }, modifier = Modifier.size(SiteSpace.touch)) {
                    Icon(SiteIcons.Close, "清空搜索", tint = SiteTheme.colors.muted, modifier = Modifier.size(18.dp))
                }
            }
        }
        if (!onShelf) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(horizontal = SiteSpace.paragraph).fillMaxWidth(),
            ) {
                if (collection == "layouts") {
                    TextButton(
                        onClick = { query = ""; category = ""; topic = ""; browsingAll = false },
                        modifier = Modifier.heightIn(min = SiteSpace.touch),
                    ) {
                        Text("书架", style = SiteText.label, color = SiteTheme.colors.ink)
                    }
                }
                FilterMenu(
                    label = meta.categories.firstOrNull { it.id == category }?.name ?: "全部分类",
                    entries = meta.categories,
                    allLabel = "全部分类",
                ) {
                    category = it; topic = ""
                }
                if (collection == "layouts") {
                    FilterMenu(
                        label = meta.topics.firstOrNull { it.id == topic }?.name ?: "全部主题",
                        entries = meta.topics,
                        allLabel = "全部主题",
                    ) { topic = it }
                }
                Spacer(Modifier.weight(1f))
                if (meta.total > 0) {
                    Text("${meta.total} 件", style = SiteText.meta, color = SiteTheme.colors.quiet)
                }
            }
        }
        Box(Modifier.weight(1f).fillMaxWidth()) {
            // 首屏失败（含书架态）必须可重试：PagedFeed 的 started 守卫会让缓存实例
            // 的 loadInitial 静默跳过，错误分支优先于书架，避免永久转圈。
            // 首次加载进行中（feed 未建或 initial 未落）保持 INITIAL：相位键真正变化
            // 才触发淡切，否则加载完成不换键、过渡不可见。
            val phase = when {
                feed == null || state.initial -> CollectionPhase.INITIAL
                state.error != null && state.items.isEmpty() -> CollectionPhase.ERROR
                onShelf -> CollectionPhase.SHELF
                else -> CollectionPhase.CONTENT
            }
            Crossfade(targetState = phase, animationSpec = tween(180, easing = FastOutSlowInEasing), label = "collection-phase") { phase ->
                when (phase) {
                    CollectionPhase.INITIAL -> SiteSpinner()
                    CollectionPhase.ERROR -> ErrorRetry(
                        message = state.error ?: "",
                        modifier = Modifier.fillMaxSize(),
                    ) { currentFeed().retry() }
                    CollectionPhase.SHELF -> Shelf(
                        categories = meta.categories,
                        onPick = { category = it; browsingAll = true },
                        onBrowseAll = { browsingAll = true },
                        modifier = Modifier.fillMaxSize(),
                        bottomPadding = bottomPadding,
                    )
                    CollectionPhase.CONTENT -> ItemGrid(
                        state = state,
                        meta = meta,
                        collection = collection,
                        contentPadding = PaddingValues(
                            start = SiteSpace.paragraph,
                            end = SiteSpace.paragraph,
                            bottom = bottomPadding,
                        ),
                        onOpenItem = { index -> onOpenItem(state.items, index) },
                        onLoadMore = { currentFeed().loadMore() },
                        onRetry = { currentFeed().retry() },
                    )
                }
            }
        }
    }
}
