package cn.lovemyrmb.personalsite.ui.portfolio

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed as gridItemsIndexed
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import cn.lovemyrmb.personalsite.data.CurationMedia
import cn.lovemyrmb.personalsite.data.CurationSource
import cn.lovemyrmb.personalsite.data.PORTFOLIO_BASE_URL
import cn.lovemyrmb.personalsite.data.PortfolioApi
import cn.lovemyrmb.personalsite.data.PortfolioCategory
import cn.lovemyrmb.personalsite.data.PortfolioItem
import cn.lovemyrmb.personalsite.data.PortfolioMedia
import cn.lovemyrmb.personalsite.data.PortfolioMeta
import cn.lovemyrmb.personalsite.data.PortfolioProduct
import cn.lovemyrmb.personalsite.data.PortfolioReaderHolder
import cn.lovemyrmb.personalsite.data.PortfolioViewModel
import cn.lovemyrmb.personalsite.ui.components.CurationMediaSection
import cn.lovemyrmb.personalsite.ui.components.ErrorRetry
import cn.lovemyrmb.personalsite.ui.components.FeedFooter
import cn.lovemyrmb.personalsite.ui.components.SourceCta
import cn.lovemyrmb.personalsite.ui.icons.SiteIcons
import cn.lovemyrmb.personalsite.ui.theme.SiteSpace
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import kotlinx.coroutines.delay

/** 产品入口的原生集合；其余产品（工具 / 个人网站）保持跳站点网页。 */
private fun PortfolioProduct.nativeCollection(): String? = when (id) {
    "layout-compositions" -> "layouts"
    "muse" -> "muse"
    else -> null
}

/** 作品集落地页：产品列表（名称、简介、日期、封面），下拉刷新、失败重试。 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PortfolioScreen(
    api: PortfolioApi,
    bottomPadding: Dp,
    onOpenCollection: (String) -> Unit,
    onOpenLink: (String) -> Unit,
) {
    var products by remember { mutableStateOf<List<PortfolioProduct>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var refreshing by remember { mutableStateOf(false) }
    var attempt by remember { mutableIntStateOf(0) }

    LaunchedEffect(attempt) {
        error = null
        runCatching { api.products().items }
            .onSuccess { products = it }
            .onFailure { error = "暂时无法读取作品集。" }
        refreshing = false
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SiteTheme.colors.background)
            .statusBarsPadding()
            .padding(bottom = bottomPadding),
    ) {
        Column(Modifier.padding(horizontal = SiteSpace.page)) {
            Spacer(Modifier.height(SiteSpace.compact))
            Text("作品集", style = SiteText.pageTitle, color = SiteTheme.colors.ink)
            Text("设计参考与工程实践", style = SiteText.summary, color = SiteTheme.colors.muted)
            Spacer(Modifier.height(SiteSpace.paragraph))
        }
        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = { refreshing = true; attempt++ },
            modifier = Modifier.fillMaxSize(),
        ) {
            when {
                error != null && products == null -> ErrorRetry(message = error ?: "", modifier = Modifier.fillMaxSize()) { attempt++ }
                products == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = SiteTheme.colors.muted, strokeWidth = 2.dp)
                }
                else -> LazyColumn {
                    itemsIndexed(products.orEmpty(), key = { _, product -> product.id }) { _, product ->
                        val collection = product.nativeCollection()
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable(
                                    role = Role.Button,
                                    onClickLabel = if (collection != null) "打开${product.name}" else "在浏览器打开${product.name}",
                                ) {
                                    if (collection != null) onOpenCollection(collection) else onOpenLink(PORTFOLIO_BASE_URL)
                                }
                                .padding(horizontal = SiteSpace.page, vertical = SiteSpace.item),
                            horizontalArrangement = Arrangement.spacedBy(SiteSpace.paragraph),
                        ) {
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SiteSpace.micro)) {
                                Text(product.name, style = SiteText.title, color = SiteTheme.colors.ink)
                                Text(product.summary, style = SiteText.summary, color = SiteTheme.colors.muted)
                                Text(
                                    product.date + " · " + product.dateLabel,
                                    style = SiteText.meta,
                                    color = SiteTheme.colors.quiet,
                                )
                            }
                            AsyncImage(
                                model = product.cover.takeIf { it.isNotBlank() },
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .width(100.dp)
                                    .height(112.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(SiteTheme.colors.line),
                            )
                        }
                        HorizontalRule()
                    }
                    item(key = "bottom") { Spacer(Modifier.height(SiteSpace.section)) }
                }
            }
        }
    }
}

@Composable
private fun HorizontalRule() {
    Box(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = SiteSpace.page)
            .height(Dp.Hairline)
            .background(SiteTheme.colors.line),
    )
}

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
                modifier = Modifier.weight(1f),
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

/** 分类/主题筛选：文本 + 下拉箭头的 48dp 触控入口。 */
@Composable
private fun FilterMenu(
    label: String,
    entries: List<PortfolioCategory>,
    allLabel: String,
    onPick: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        TextButton(onClick = { expanded = true }, modifier = Modifier.heightIn(min = SiteSpace.touch)) {
            Text(label, style = SiteText.label, color = SiteTheme.colors.ink)
            Icon(SiteIcons.ArrowDropDown, "选择$label", modifier = Modifier.size(18.dp))
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(text = { Text(allLabel) }, onClick = { onPick(""); expanded = false })
            entries.forEach { entry ->
                DropdownMenuItem(
                    text = { Text(entry.name) },
                    onClick = { onPick(entry.id); expanded = false },
                )
            }
        }
    }
}

/** layouts 书架：分类按行浏览 + 全部图鉴入口，进入任一分类即离开书架。 */
@Composable
private fun Shelf(
    categories: List<PortfolioCategory>,
    onPick: (String) -> Unit,
    onBrowseAll: () -> Unit,
    modifier: Modifier = Modifier,
    bottomPadding: Dp = 0.dp,
) {
    if (categories.isEmpty()) {
        Box(modifier, contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = SiteTheme.colors.muted, strokeWidth = 2.dp)
        }
        return
    }
    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(bottom = bottomPadding + SiteSpace.section),
    ) {
        item(key = "shelf-head") {
            Column(Modifier.padding(horizontal = SiteSpace.page, vertical = SiteSpace.paragraph)) {
                Text("从一本书开始", style = SiteText.pageTitle, color = SiteTheme.colors.ink)
                Text(
                    "${categories.size} 个分类，按主题翻阅排版图鉴。",
                    style = SiteText.summary,
                    color = SiteTheme.colors.muted,
                )
            }
        }
        itemsIndexed(categories, key = { _, entry -> entry.id }) { index, entry ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(role = Role.Button, onClickLabel = "查看${entry.name}") { onPick(entry.id) }
                    .padding(horizontal = SiteSpace.page, vertical = SiteSpace.item),
            ) {
                Text("%02d".format(index + 1), style = SiteText.meta, color = SiteTheme.colors.quiet)
                Spacer(Modifier.width(SiteSpace.paragraph))
                Text(entry.name, style = SiteText.listTitle, color = SiteTheme.colors.ink, modifier = Modifier.weight(1f))
                Text("${entry.count} 张", style = SiteText.meta, color = SiteTheme.colors.quiet)
            }
            HorizontalRule()
        }
        item(key = "browse-all") {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(role = Role.Button, onClickLabel = "浏览全部图鉴") { onBrowseAll() }
                    .heightIn(min = SiteSpace.touch)
                    .padding(horizontal = SiteSpace.page),
            ) {
                Text("浏览全部图鉴", style = SiteText.label, color = SiteTheme.colors.ink)
                Spacer(Modifier.weight(1f))
                Text(
                    "${categories.sumOf { it.count }} 张",
                    style = SiteText.meta,
                    color = SiteTheme.colors.muted,
                )
            }
        }
    }
}

/** 条目网格：缩略图 + 标题 + 作者/分类，视频条目带播放角标；页脚触底分页。 */
@Composable
private fun ItemGrid(
    state: cn.lovemyrmb.personalsite.data.FeedState<PortfolioItem>,
    meta: PortfolioMeta,
    collection: String,
    contentPadding: PaddingValues,
    onOpenItem: (index: Int) -> Unit,
    onLoadMore: () -> Unit,
    onRetry: () -> Unit,
) {
    when {
        state.initial -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = SiteTheme.colors.muted, strokeWidth = 2.dp)
        }
        state.items.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("没有找到内容", style = SiteText.body, color = SiteTheme.colors.muted, textAlign = TextAlign.Center)
        }
        else -> LazyVerticalGrid(
            columns = GridCells.Adaptive(145.dp),
            state = rememberLazyGridState(),
            contentPadding = contentPadding,
            verticalArrangement = Arrangement.spacedBy(SiteSpace.paragraph),
            horizontalArrangement = Arrangement.spacedBy(SiteSpace.related),
            modifier = Modifier.fillMaxSize(),
        ) {
            gridItemsIndexed(state.items, key = { _, item -> item.id }) { index, item ->
                GridItem(item, collection) { onOpenItem(index) }
            }
            item(key = "footer", span = { GridItemSpan(maxLineSpan) }) {
                LaunchedEffect(state.items.size, state.hasMore) {
                    if (state.hasMore) onLoadMore()
                }
                FeedFooter(state) { onRetry() }
            }
            if (meta.attribution.isNotBlank()) {
                item(key = "attribution", span = { GridItemSpan(maxLineSpan) }) {
                    Text(
                        text = meta.attribution,
                        style = SiteText.meta,
                        color = SiteTheme.colors.quiet,
                        modifier = Modifier.padding(vertical = SiteSpace.compact),
                    )
                }
            }
        }
    }
}

@Composable
private fun GridItem(item: PortfolioItem, collection: String, onOpen: () -> Unit) {
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .clickable(role = Role.Button, onClickLabel = "查看${item.title}") { onOpen() },
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(if (collection == "layouts") 0.72f else 1.25f)
                .clip(RoundedCornerShape(8.dp))
                .background(SiteTheme.colors.line),
        ) {
            AsyncImage(
                model = item.thumbnail.takeIf { it.isNotBlank() },
                contentDescription = null,
                contentScale = if (collection == "layouts") ContentScale.Fit else ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
            if (item.media.firstOrNull()?.isVideo == true) {
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(SiteSpace.compact)
                        .size(26.dp)
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.65f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = SiteIcons.PlayArrow,
                        contentDescription = "视频",
                        tint = Color.White,
                        modifier = Modifier.size(14.dp),
                    )
                }
            }
        }
        Spacer(Modifier.height(SiteSpace.compact))
        Text(
            text = item.title,
            style = SiteText.listTitle,
            color = SiteTheme.colors.ink,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = item.author.ifBlank { item.category },
            style = SiteText.meta,
            color = SiteTheme.colors.quiet,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** 全屏阅读器：同屏条目前后翻页，媒体在应用内播放，来源跳外部。 */
@Composable
fun PortfolioItemReader(
    payload: PortfolioReaderHolder.ReaderPayload?,
    api: PortfolioApi,
    bottomPadding: Dp,
    onBack: () -> Unit,
    onOpenLink: (String) -> Unit,
) {
    if (payload == null) {
        LaunchedEffect(Unit) { onBack() }
        return
    }
    var index by rememberSaveable(payload) { mutableIntStateOf(payload.index.coerceIn(0, (payload.items.size - 1).coerceAtLeast(0))) }
    val item = payload.items.getOrNull(index) ?: run {
        LaunchedEffect(Unit) { onBack() }
        return
    }
    // 列表条目通常已含全文与媒体；详情接口失败时静默沿用列表数据。
    var detailed by remember(item.id) { mutableStateOf(item) }
    LaunchedEffect(item.id) {
        runCatching { api.detail(payload.collection, item.id).item }.onSuccess { detailed = it }
    }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SiteTheme.colors.background)
            .statusBarsPadding()
            .padding(bottom = bottomPadding),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = SiteSpace.compact, vertical = 4.dp),
        ) {
            IconButton(onClick = onBack) { Icon(SiteIcons.ArrowBack, "返回${if (payload.collection == "layouts") "布局参考" else "灵感集"}", tint = SiteTheme.colors.ink) }
            Spacer(Modifier.weight(1f))
            Text(
                "${index + 1} / ${payload.items.size}",
                style = SiteText.meta,
                color = SiteTheme.colors.quiet,
            )
            IconButton(onClick = { if (index > 0) index-- }, enabled = index > 0) {
                Icon(SiteIcons.ArrowBack, "上一件", tint = SiteTheme.colors.ink)
            }
            IconButton(onClick = { if (index < payload.items.lastIndex) index++ }, enabled = index < payload.items.lastIndex) {
                Icon(SiteIcons.ArrowForward, "下一件", tint = SiteTheme.colors.ink)
            }
        }
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = SiteSpace.page),
        ) {
            Text(detailed.title, style = SiteText.pageTitle, color = SiteTheme.colors.ink)
            Spacer(Modifier.height(SiteSpace.compact))
            Text(
                text = listOf(detailed.category, detailed.topic, detailed.author)
                    .filter { it.isNotBlank() }
                    .joinToString(" · "),
                style = SiteText.meta,
                color = SiteTheme.colors.quiet,
            )
            if (detailed.text.isNotBlank()) {
                Spacer(Modifier.height(SiteSpace.paragraph))
                Text(detailed.text, style = SiteText.body, color = SiteTheme.colors.ink)
            }
            if (detailed.media.isNotEmpty()) {
                Spacer(Modifier.height(SiteSpace.paragraph))
                CurationMediaSection(
                    media = detailed.media.map { it.toCurationMedia() },
                    source = CurationSource(platform = "portfolio"),
                )
            }
            if (detailed.sourceUrl.isNotBlank()) {
                Spacer(Modifier.height(SiteSpace.item))
                SourceCta(label = "查看来源", host = hostOf(detailed.sourceUrl)) { onOpenLink(detailed.sourceUrl) }
            }
            Spacer(Modifier.height(SiteSpace.section))
        }
    }
}

/** 复用策展媒体组件：作品集视频直连 mp4（platform 非 x 不走代理），图片用 poster。 */
private fun PortfolioMedia.toCurationMedia() = CurationMedia(
    type = kind,
    url = poster.ifBlank { url },
    videoUrl = url.takeIf { isVideo },
    width = width.takeIf { it > 0 },
    height = height.takeIf { it > 0 },
)

private fun hostOf(url: String): String = runCatching {
    java.net.URI(url).host?.removePrefix("www.") ?: url
}.getOrDefault(url.take(40))
