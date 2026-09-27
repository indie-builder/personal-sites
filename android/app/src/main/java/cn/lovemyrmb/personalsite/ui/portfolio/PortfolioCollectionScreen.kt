package cn.lovemyrmb.personalsite.ui.portfolio

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
import cn.lovemyrmb.personalsite.data.PortfolioMeta
import cn.lovemyrmb.personalsite.data.PortfolioViewModel
import cn.lovemyrmb.personalsite.ui.components.ErrorRetry
import cn.lovemyrmb.personalsite.ui.icons.SiteIcons
import cn.lovemyrmb.personalsite.ui.theme.SiteSpace
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import kotlinx.coroutines.delay

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

    // 搜索逐字输入防抖后切换分页实例；feed 键与 meta 键共用同一筛选组合。
    val filterKey = viewModel.feedKey(collection, query.trim(), category, topic)
    LaunchedEffect(collection, query, category, topic) {
        delay(250)
        val next = viewModel.feed(collection, query.trim(), category, topic)
        feed = next
        next.loadInitial()
    }
    val metaAll by viewModel.meta.collectAsStateWithLifecycle()
    // 防抖窗口内新筛选键尚无 meta，回退到该集合最近一次的 meta，避免筛选菜单闪空。
    val meta = metaAll[filterKey]
        ?: metaAll.entries.lastOrNull { it.key.startsWith("$collection|") }?.value
        ?: PortfolioMeta()
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
            when {
                feed == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = SiteTheme.colors.muted, strokeWidth = 2.dp)
                }
                // 首屏失败（含书架态）必须可重试：PagedFeed 的 started 守卫会让缓存实例
                // 的 loadInitial 静默跳过，错误分支优先于书架，避免永久转圈。
                state.error != null && state.items.isEmpty() -> ErrorRetry(
                    message = state.error ?: "",
                    modifier = Modifier.fillMaxSize(),
                ) { viewModel.feed(collection, query.trim(), category, topic).retry() }
                onShelf -> Shelf(
                    categories = meta.categories,
                    onPick = { category = it; browsingAll = true },
                    onBrowseAll = { browsingAll = true },
                    modifier = Modifier.fillMaxSize(),
                    bottomPadding = bottomPadding,
                )
                else -> ItemGrid(
                    state = state,
                    meta = meta,
                    collection = collection,
                    contentPadding = PaddingValues(
                        start = SiteSpace.paragraph,
                        end = SiteSpace.paragraph,
                        bottom = bottomPadding,
                    ),
                    onOpenItem = { index -> onOpenItem(state.items, index) },
                    onLoadMore = { viewModel.feed(collection, query.trim(), category, topic).loadMore() },
                    onRetry = { viewModel.feed(collection, query.trim(), category, topic).retry() },
                )
            }
        }
    }
}
