package cn.lovemyrmb.personalsite.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import cn.lovemyrmb.personalsite.data.AiNewsListItem
import cn.lovemyrmb.personalsite.data.CurationItem
import cn.lovemyrmb.personalsite.data.OpenSourceListEntry
import cn.lovemyrmb.personalsite.data.dimensionLabels
import cn.lovemyrmb.personalsite.ui.components.SiteAsyncImage
import cn.lovemyrmb.personalsite.ui.components.feedTimeLabel
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import cn.lovemyrmb.personalsite.ui.theme.SiteSpace
import cn.lovemyrmb.personalsite.ui.theme.SiteText

/** 每日动态行：无图纯文字（与站点列表一致）：标题、导读、时间与来源。 */
@Composable
internal fun AiNewsRow(item: AiNewsListItem, onOpen: () -> Unit) {
    val summary = item.summary.trim().removePrefix(item.title.trim()).trimStart(' ', '，', '。', '：', ':', '—', '-', '\n')
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(SiteTheme.colors.background)
            .clickable(onClick = onOpen)
            .padding(horizontal = SiteSpace.page, vertical = SiteSpace.item),
    ) {
        Text(
            text = item.title,
            style = SiteText.title,
            color = SiteTheme.colors.ink,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        if (summary.isNotBlank()) {
            Spacer(Modifier.height(SiteSpace.compact))
            Text(
                text = summary,
                style = SiteText.summary,
                color = SiteTheme.colors.muted,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.height(SiteSpace.related))
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
        }
    }
}

/** 策展三栏（每日关注 / 设计收藏 / 抖音收藏）共用行：文字 + 右侧缩略图。 */
@Composable
internal fun CurationRow(item: CurationItem, onOpen: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(SiteTheme.colors.background)
            .clickable(onClick = onOpen)
            .padding(horizontal = SiteSpace.page, vertical = SiteSpace.paragraph),
        horizontalArrangement = Arrangement.spacedBy(SiteSpace.paragraph),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.headline(),
                style = SiteText.listTitle,
                color = SiteTheme.colors.ink,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(SiteSpace.compact))
            Text(
                text = curationMeta(item),
                style = SiteText.meta,
                color = SiteTheme.colors.quiet,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        item.media.firstOrNull()?.let { media ->
            SiteAsyncImage(
                model = media.posterUrl,
                contentDescription = null,
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
internal fun OpenSourceRow(entry: OpenSourceListEntry, onOpen: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(SiteTheme.colors.background)
            .clickable(onClick = onOpen)
            .padding(horizontal = SiteSpace.page, vertical = SiteSpace.paragraph),
    ) {
        Text(
            text = entry.repository,
            style = SiteText.listTitle,
            color = SiteTheme.colors.ink,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.height(SiteSpace.compact))
        Text(
            text = entry.sourceSummary,
            style = SiteText.summary,
            color = SiteTheme.colors.muted,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.height(SiteSpace.compact))
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
