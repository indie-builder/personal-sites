package cn.lovemyrmb.personalsite.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.SecondaryScrollableTabRow
import androidx.compose.material3.TabRowDefaults.SecondaryIndicator
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import cn.lovemyrmb.personalsite.data.AiNewsListItem
import cn.lovemyrmb.personalsite.data.CurationItem
import cn.lovemyrmb.personalsite.data.DetailEntry
import cn.lovemyrmb.personalsite.data.HomeViewModel
import cn.lovemyrmb.personalsite.data.OpenSourceListEntry
import cn.lovemyrmb.personalsite.data.PagedFeed
import cn.lovemyrmb.personalsite.data.Section
import cn.lovemyrmb.personalsite.ui.components.ErrorRetry
import cn.lovemyrmb.personalsite.ui.components.FeedFooter
import cn.lovemyrmb.personalsite.ui.components.SiteSpinner
import cn.lovemyrmb.personalsite.ui.theme.SiteSpace
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch

private val sections = Section.entries

@Composable
fun HomeScreen(
    viewModel: HomeViewModel,
    pagerState: PagerState,
    bottomBarPadding: Dp,
    onOpenDetail: (DetailEntry) -> Unit,
) {
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
            val contentPadding = PaddingValues(bottom = bottomBarPadding)
            when (section) {
                Section.AI_NEWS -> FeedPageUi(
                    feed = viewModel.aiNews,
                    contentPadding = contentPadding,
                    keyOf = AiNewsListItem::id,
                ) { item ->
                    AiNewsRow(item) { onOpenDetail(DetailEntry.AiNews(item.id)) }
                }

                Section.CURATION, Section.DESIGN, Section.DOUYIN -> FeedPageUi(
                    feed = viewModel.curationFeed(section),
                    contentPadding = contentPadding,
                    keyOf = CurationItem::id,
                ) { item ->
                    CurationRow(item) { onOpenDetail(DetailEntry.Curation(section, item)) }
                }

                Section.OPEN_SOURCE -> FeedPageUi(
                    feed = viewModel.openSource,
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
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        AsyncImage(
            model = cn.lovemyrmb.personalsite.R.drawable.profile_avatar,
            contentDescription = "陈远的头像",
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .padding(start = 16.dp, end = 4.dp)
                .size(32.dp)
                .clip(androidx.compose.foundation.shape.CircleShape),
        )
    SecondaryScrollableTabRow(
        modifier = Modifier.weight(1f),
        selectedTabIndex = selectedPage,
        containerColor = SiteTheme.colors.background,
        contentColor = SiteTheme.colors.ink,
        edgePadding = 4.dp,
        divider = {},
        indicator = {
            SecondaryIndicator(
                modifier = Modifier.tabIndicatorOffset(selectedPage).padding(horizontal = SiteSpace.page),
                height = 2.dp,
                color = SiteTheme.colors.ink,
            )
        },
    ) {
        sections.forEachIndexed { index, section ->
            val selected = index == selectedPage
            Box(
                modifier = Modifier
                    .heightIn(min = SiteSpace.touch)
                    .selectable(selected = selected, role = Role.Tab) { onSelect(index) }
                    .padding(horizontal = 14.dp, vertical = 13.dp),
            ) {
                Text(
                    text = section.label,
                    style = if (selected) SiteText.tabSelected else SiteText.tab,
                    color = if (selected) SiteTheme.colors.ink else SiteTheme.colors.muted,
                )
            }
        }
    }
    }
}

/** 单个栏目的信息流：首屏加载、下拉刷新、触底追加、失败重试。 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun <T> FeedPageUi(
    feed: PagedFeed<T>,
    contentPadding: PaddingValues,
    keyOf: (T) -> String,
    row: @Composable (T) -> Unit,
) {
    LaunchedEffect(feed) { feed.loadInitial() }
    val state by feed.state.collectAsStateWithLifecycle()
    PullToRefreshBox(
        isRefreshing = state.refreshing,
        onRefresh = { feed.refresh() },
        modifier = Modifier.fillMaxSize(),
    ) {
        when {
            state.initial -> SiteSpinner()

            state.error != null && state.items.isEmpty() -> ErrorRetry(
                message = state.error ?: "",
                modifier = Modifier.fillMaxSize(),
            ) { feed.retry() }

            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = contentPadding,
            ) {
                itemsIndexed(state.items, key = { _, item -> keyOf(item) }) { _, item ->
                    Box { row(item) }
                    HorizontalDivider(modifier = Modifier.padding(horizontal = SiteSpace.page), thickness = Dp.Hairline, color = SiteTheme.colors.line)
                }
                item(key = "footer") {
                    LaunchedEffect(state.items.size, state.hasMore) {
                        if (state.hasMore) feed.loadMore()
                    }
                    FeedFooter(state) { feed.retry() }
                }
            }
        }
    }
}

/** 页脚三态见 components/FeedFooter。 */
