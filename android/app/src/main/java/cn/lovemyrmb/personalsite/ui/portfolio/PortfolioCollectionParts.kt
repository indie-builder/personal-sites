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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed as gridItemsIndexed
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import cn.lovemyrmb.personalsite.data.PortfolioCategory
import cn.lovemyrmb.personalsite.data.PortfolioItem
import cn.lovemyrmb.personalsite.data.PortfolioMeta
import cn.lovemyrmb.personalsite.ui.components.SiteAsyncImage
import cn.lovemyrmb.personalsite.ui.components.FeedFooter
import cn.lovemyrmb.personalsite.ui.icons.SiteIcons
import cn.lovemyrmb.personalsite.ui.theme.SiteSpace
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme

/** 分类/主题筛选：文本 + 下拉箭头的 48dp 触控入口。 */
@Composable
internal fun FilterMenu(
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
internal fun Shelf(
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
            HorizontalDivider(modifier = Modifier.padding(horizontal = SiteSpace.page), thickness = Dp.Hairline, color = SiteTheme.colors.line)
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
internal fun ItemGrid(
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
            SiteAsyncImage(
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
