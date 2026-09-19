package cn.lovemyrmb.personalsite.ui.home

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.TabRowDefaults.SecondaryIndicator
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import cn.lovemyrmb.personalsite.data.AiNewsListItem
import cn.lovemyrmb.personalsite.data.CurationItem
import cn.lovemyrmb.personalsite.data.DetailEntry
import cn.lovemyrmb.personalsite.data.FeedState
import cn.lovemyrmb.personalsite.data.HomeViewModel
import cn.lovemyrmb.personalsite.data.OpenSourceListEntry
import cn.lovemyrmb.personalsite.data.PagedFeed
import cn.lovemyrmb.personalsite.data.Section
import cn.lovemyrmb.personalsite.data.aiNewsCategoryLabel
import cn.lovemyrmb.personalsite.data.dimensionLabels
import cn.lovemyrmb.personalsite.ui.components.feedTimeLabel
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import kotlinx.coroutines.launch

private val sections = Section.entries.toList()

@Composable
fun HomeScreen(
    viewModel: HomeViewModel,
    bottomBarPadding: Dp,
    onOpenDetail: (DetailEntry) -> Unit,
    onOpenLink: (String) -> Unit,
) {
    val pagerState = rememberPagerState(pageCount = { sections.size })
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SiteTheme.colors.background)
            .statusBarsPadding(),
    ) {
        SectionTabs(
            selectedPage = pagerState.currentPage,
            onSelect = { index -> scope.launch { pagerState.animateScrollToPage(index) } },
        )
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize(),
        ) { page ->
            val section = sections[page]
            LaunchedEffect(section) { viewModel.loadInitial(section) }
            val contentPadding = PaddingValues(bottom = bottomBarPadding)
            when (section) {
                Section.AI_NEWS -> FeedPageUi(
                    feed = viewModel.aiNews,
                    section = section,
                    viewModel = viewModel,
                    contentPadding = contentPadding,
                    keyOf = AiNewsListItem::id,
                ) { item ->
                    AiNewsRow(item) { onOpenDetail(DetailEntry.AiNews(item.id)) }
                }

                Section.CURATION -> FeedPageUi(
                    feed = viewModel.curation,
                    section = section,
                    viewModel = viewModel,
                    contentPadding = contentPadding,
                    keyOf = CurationItem::id,
                ) { item ->
                    CurationRow(item, section) { onOpenDetail(DetailEntry.Curation(section, item)) }
                }

                Section.DESIGN -> FeedPageUi(
                    feed = viewModel.design,
                    section = section,
                    viewModel = viewModel,
                    contentPadding = contentPadding,
                    keyOf = CurationItem::id,
                ) { item ->
                    CurationRow(item, section) { onOpenDetail(DetailEntry.Curation(section, item)) }
                }

                Section.DOUYIN -> FeedPageUi(
                    feed = viewModel.douyin,
                    section = section,
                    viewModel = viewModel,
                    contentPadding = contentPadding,
                    keyOf = CurationItem::id,
                ) { item ->
                    CurationRow(item, section) { onOpenDetail(DetailEntry.Curation(section, item)) }
                }

                Section.OPEN_SOURCE -> FeedPageUi(
                    feed = viewModel.openSource,
                    section = section,
                    viewModel = viewModel,
                    contentPadding = contentPadding,
                    keyOf = OpenSourceListEntry::slug,
                ) { item ->
                    OpenSourceRow(item) { onOpenDetail(DetailEntry.OpenSource(item)) }
                }
            }
        }
    }
}

/** 顶部栏目导航：横向滚动、单色文字 + 短下划线，对应截图里的顶栏。 */
@Composable
private fun SectionTabs(selectedPage: Int, onSelect: (Int) -> Unit) {
    ScrollableTabRow(
        selectedTabIndex = selectedPage,
        containerColor = SiteTheme.colors.background,
        contentColor = SiteTheme.colors.ink,
        edgePadding = 20.dp,
        divider = {},
        indicator = { tabPositions ->
            if (selectedPage < tabPositions.size) {
                SecondaryIndicator(
                    modifier = Modifier.tabIndicatorOffset(tabPositions[selectedPage]),
                    height = 2.dp,
                    color = SiteTheme.colors.ink,
                )
            }
        },
    ) {
        sections.forEachIndexed { index, section ->
            val selected = index == selectedPage
            Box(
                modifier = Modifier
                    .clickable { onSelect(index) }
                    .padding(horizontal = 14.dp, vertical = 13.dp),
            ) {
                Text(
                    text = section.label,
                    style = SiteText.listTitle.copy(
                        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                    ),
                    color = if (selected) SiteTheme.colors.ink else SiteTheme.colors.muted,
                )
            }
        }
    }
}

/** 单个栏目的信息流：首屏加载、下拉刷新、触底追加、失败重试。 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun <T> FeedPageUi(
    feed: PagedFeed<T>,
    section: Section,
    viewModel: HomeViewModel,
    contentPadding: PaddingValues,
    keyOf: (T) -> String,
    row: @Composable (T) -> Unit,
) {
    val state by feed.state.collectAsStateWithLifecycle()
    PullToRefreshBox(
        isRefreshing = state.refreshing,
        onRefresh = { viewModel.refresh(section) },
        modifier = Modifier.fillMaxSize(),
    ) {
        when {
            state.initial -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = SiteTheme.colors.muted, strokeWidth = 2.dp)
            }

            state.error != null && state.items.isEmpty() -> FeedError(
                message = state.error ?: "",
                modifier = Modifier.fillMaxSize(),
            ) { viewModel.retry(section) }

            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = contentPadding,
            ) {
                itemsIndexed(state.items, key = { _, item -> keyOf(item) }) { _, item ->
                    Box { row(item) }
                    HorizontalRule()
                }
                item(key = "footer") {
                    LaunchedEffect(state.items.size, state.hasMore) {
                        if (state.hasMore) viewModel.loadMore(section)
                    }
                    FeedFooter(state) { viewModel.retry(section) }
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
            .height(Dp.Hairline)
            .background(SiteTheme.colors.line),
    )
}

/** 条目之间的细分隔线已由 HorizontalRule 提供；页脚负责追加/到底/失败三态。 */
@Composable
private fun FeedFooter(state: FeedState<*>, onRetry: () -> Unit) {
    when {
        state.loadingMore -> Row(
            Modifier
                .fillMaxWidth()
                .padding(vertical = 18.dp),
            horizontalArrangement = Arrangement.Center,
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(18.dp),
                color = SiteTheme.colors.muted,
                strokeWidth = 2.dp,
            )
        }

        state.error != null -> FeedError(message = state.error ?: "", modifier = Modifier.fillMaxWidth(), onRetry = onRetry)

        !state.hasMore && state.items.isNotEmpty() -> Text(
            text = "已经到底了",
            style = SiteText.meta,
            color = SiteTheme.colors.quiet,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 18.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
    }
}

@Composable
private fun FeedError(message: String, modifier: Modifier = Modifier, onRetry: () -> Unit) {
    Column(
        modifier = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(text = message, style = SiteText.summary, color = SiteTheme.colors.muted)
        Text(
            text = "重试",
            style = SiteText.eyebrow,
            color = SiteTheme.colors.ink,
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .clickable { onRetry() }
                .padding(horizontal = 16.dp, vertical = 8.dp),
        )
    }
}

/** 每日动态行：无图纯文字（与站点列表一致）：标题、导读、时间与来源。 */
@Composable
private fun AiNewsRow(item: AiNewsListItem, onOpen: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(SiteTheme.colors.background)
            .clickable(onClick = onOpen)
            .padding(horizontal = 20.dp, vertical = 14.dp),
    ) {
        Text(
            text = item.title,
            style = SiteText.title,
            color = SiteTheme.colors.ink,
            maxLines = 3,
            overflow = TextOverflow.Ellipsis,
        )
        if (item.summary.isNotBlank()) {
            Spacer(Modifier.height(6.dp))
            Text(
                text = item.summary,
                style = SiteText.summary,
                color = SiteTheme.colors.muted,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = listOfNotNull(
                    feedTimeLabel(item.publishedAt),
                    item.sourceName.takeIf { it.isNotBlank() },
                ).joinToString(" · "),
                style = SiteText.meta,
                color = SiteTheme.colors.quiet,
                modifier = Modifier.weight(1f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = aiNewsCategoryLabel(item.category),
                style = SiteText.meta,
                color = SiteTheme.colors.quiet,
            )
        }
    }
}

/** 策展三栏（每日关注 / 设计收藏 / 抖音收藏）共用行：文字 + 右侧缩略图。 */
@Composable
private fun CurationRow(item: CurationItem, section: Section, onOpen: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(SiteTheme.colors.background)
            .clickable(onClick = onOpen)
            .padding(horizontal = 20.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.headline(),
                style = SiteText.listTitle,
                color = SiteTheme.colors.ink,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = curationMeta(item),
                style = SiteText.meta,
                color = SiteTheme.colors.quiet,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        item.media.firstOrNull()?.let { media ->
            AsyncImage(
                model = media.posterUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .width(104.dp)
                    .aspectRatio(4f / 3f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(SiteTheme.colors.line),
            )
        }
    }
}

@Composable
private fun OpenSourceRow(entry: OpenSourceListEntry, onOpen: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(SiteTheme.colors.background)
            .clickable(onClick = onOpen)
            .padding(horizontal = 20.dp, vertical = 14.dp),
    ) {
        Text(
            text = entry.repository,
            style = SiteText.listTitle,
            color = SiteTheme.colors.ink,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.height(6.dp))
        Text(
            text = entry.sourceSummary,
            style = SiteText.summary,
            color = SiteTheme.colors.muted,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = listOfNotNull(
                entry.status.takeIf { it.isNotBlank() },
                entry.dimensions.firstOrNull()?.let { dimensionLabels[it] ?: it },
                feedTimeLabel(entry.checkedAt),
            ).joinToString(" · "),
            style = SiteText.meta,
            color = SiteTheme.colors.quiet,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** 行标题：优先 title，回退正文首行（策展条目常无独立标题）。 */
private fun CurationItem.headline(): String = title?.takeIf { it.isNotBlank() }
    ?: text?.lineSequence()?.firstOrNull { it.isNotBlank() }
    ?: summary?.takeIf { it.isNotBlank() }
    ?: "（无文字内容）"

private fun curationMeta(item: CurationItem): String = listOfNotNull(
    feedTimeLabel(item.displayTime),
    item.attachments.take(2).joinToString("·").takeIf { it.isNotEmpty() },
    when (item.source.platform) {
        "x" -> "@${item.author.handle}".takeIf { item.author.handle.isNotBlank() }
        "douyin" -> item.author.name.takeIf { it.isNotBlank() }
        else -> null
    },
).joinToString(" · ")
