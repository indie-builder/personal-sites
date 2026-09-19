package cn.lovemyrmb.personalsite.ui.detail

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import cn.lovemyrmb.personalsite.data.AiNewsItem
import cn.lovemyrmb.personalsite.data.CurationItem
import cn.lovemyrmb.personalsite.data.CurationMedia
import cn.lovemyrmb.personalsite.data.CurationSource
import cn.lovemyrmb.personalsite.data.DetailEntry
import cn.lovemyrmb.personalsite.data.MediaUrls
import cn.lovemyrmb.personalsite.data.OpenSourceListEntry
import cn.lovemyrmb.personalsite.data.Section
import cn.lovemyrmb.personalsite.data.SiteApi
import cn.lovemyrmb.personalsite.data.aiNewsCategoryLabel
import cn.lovemyrmb.personalsite.data.dimensionLabels
import cn.lovemyrmb.personalsite.ui.components.VideoCard
import cn.lovemyrmb.personalsite.ui.components.feedTimeLabel
import cn.lovemyrmb.personalsite.ui.components.openExternally
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import cn.lovemyrmb.personalsite.ui.theme.SiteSpace
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import java.net.URLEncoder

/**
 * 详情页路由：按跳转载体分发。每日动态远程取数；策展三栏直接渲染
 * 跳转载体里的完整条目；开源关注做轻原生详情 + 站点 Custom Tabs。
 */
@Composable
fun DetailRoute(
    entry: DetailEntry?,
    api: SiteApi,
    bottomBarPadding: PaddingValues,
    onBack: () -> Unit,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val onOpenLink: (String) -> Unit = { openExternally(context, it) }
    when (entry) {
        is DetailEntry.AiNews -> AiNewsDetailScreen(entry.id, api, bottomBarPadding, onBack, onOpenLink)
        is DetailEntry.Curation -> CurationDetailScreen(entry.section, entry.item, bottomBarPadding, onBack, onOpenLink)
        is DetailEntry.OpenSource -> OpenSourceDetailScreen(entry, bottomBarPadding, onBack, onOpenLink)
        null -> LaunchedEffect(Unit) { onBack() }
    }
}

@Composable
private fun DetailTopBar(label: String, onBack: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        androidx.compose.material3.IconButton(onClick = onBack) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "返回",
                tint = SiteTheme.colors.ink,
            )
        }
        Text(text = label, style = SiteText.eyebrow, color = SiteTheme.colors.muted)
    }
}

@Composable
private fun AiNewsDetailScreen(
    id: String,
    api: SiteApi,
    bottomBarPadding: PaddingValues,
    onBack: () -> Unit,
    onOpenLink: (String) -> Unit,
) {
    var item by remember { mutableStateOf<AiNewsItem?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var attempt by remember { mutableStateOf(0) }

    LaunchedEffect(id, attempt) {
        runCatching { api.aiNewsDetail(id) }
            .onSuccess { item = it.item }
            .onFailure { error = "暂时无法读取这条每日动态。" }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SiteTheme.colors.background)
            .statusBarsPadding()
            .padding(bottomBarPadding),
    ) {
        DetailTopBar(label = "每日动态", onBack = onBack)
        when {
            item != null -> AiNewsDetailBody(item!!, onOpenLink)
            error != null -> DetailError(error ?: "", Modifier.weight(1f)) {
                error = null
                attempt++
            }
            else -> Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = SiteTheme.colors.muted, strokeWidth = 2.dp)
            }
        }
    }
}

@Composable
private fun AiNewsDetailBody(item: AiNewsItem, onOpenLink: (String) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = SiteSpace.page),
    ) {
        Text(
            text = listOf(aiNewsCategoryLabel(item.category), if (item.selected) "精选" else null)
                .filterNotNull()
                .joinToString(" · "),
            style = SiteText.eyebrow,
            color = SiteTheme.colors.quiet,
        )
        Spacer(Modifier.height(SiteSpace.related))
        Text(text = item.title, style = SiteText.pageTitle, color = SiteTheme.colors.ink)
        Spacer(Modifier.height(SiteSpace.related))
        Text(
            text = listOfNotNull(
                item.sourceName.takeIf { it.isNotBlank() },
                feedTimeLabel(item.publishedAt),
            ).joinToString(" · "),
            style = SiteText.meta,
            color = SiteTheme.colors.quiet,
        )
        Spacer(Modifier.height(SiteSpace.paragraph))
        HorizontalDivider(color = SiteTheme.colors.line, thickness = 1.dp)
        Spacer(Modifier.height(SiteSpace.paragraph))
        if (item.summary.isNotBlank()) {
            DetailSection(eyebrow = "导读", body = item.summary)
            Spacer(Modifier.height(SiteSpace.paragraph))
        }
        if (item.reason.isNotBlank()) {
            DetailSection(eyebrow = "推荐理由", body = item.reason)
            Spacer(Modifier.height(SiteSpace.paragraph))
        }
        SourceCta(label = originalActionLabel(item.url), host = hostOf(item.url)) { onOpenLink(item.url) }
        Spacer(Modifier.height(SiteSpace.section))
    }
}

@Composable
private fun CurationDetailScreen(
    section: Section,
    item: CurationItem,
    bottomBarPadding: PaddingValues,
    onBack: () -> Unit,
    onOpenLink: (String) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SiteTheme.colors.background)
            .statusBarsPadding()
            .padding(bottomBarPadding),
    ) {
        DetailTopBar(label = section.label, onBack = onBack)
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = SiteSpace.page),
        ) {
            Text(
                text = listOfNotNull(
                    when (item.source.platform) {
                        "x" -> "@${item.author.handle}".takeIf { item.author.handle.isNotBlank() }
                        "douyin" -> item.author.name.takeIf { it.isNotBlank() }
                        else -> null
                    } ?: item.source.label.takeIf { it.isNotBlank() },
                    feedTimeLabel(item.displayTime),
                ).joinToString(" · "),
                style = SiteText.meta,
                color = SiteTheme.colors.quiet,
            )
            val headline = item.title?.takeIf { it.isNotBlank() }
            if (headline != null) {
                Spacer(Modifier.height(SiteSpace.related))
                Text(text = headline, style = SiteText.pageTitle, color = SiteTheme.colors.ink)
            }
            item.summary?.takeIf { it.isNotBlank() && it != headline }?.let { summary ->
                Spacer(Modifier.height(SiteSpace.related))
                Text(text = summary, style = SiteText.body, color = SiteTheme.colors.ink)
            }
            item.text?.takeIf { it.isNotBlank() && it != headline && it != item.summary }?.let { text ->
                Spacer(Modifier.height(SiteSpace.paragraph))
                Text(text = text, style = SiteText.body, color = SiteTheme.colors.ink)
            }
            if (item.media.isNotEmpty()) {
                Spacer(Modifier.height(SiteSpace.paragraph))
                CurationMediaSection(item.media, item.source)
            }
            if (item.tags.isNotEmpty()) {
                Spacer(Modifier.height(SiteSpace.paragraph))
                Text(
                    text = item.tags.joinToString(" ") { "#$it" },
                    style = SiteText.meta,
                    color = SiteTheme.colors.quiet,
                )
            }
            if (item.source.url.isNotBlank()) {
                Spacer(Modifier.height(20.dp))
                SourceCta(
                    label = if (item.source.platform == "x") "在 X 查看原帖" else "查看原链接",
                    host = hostOf(item.source.url),
                ) { onOpenLink(item.source.url) }
            }
            Spacer(Modifier.height(SiteSpace.section))
        }
    }
}

@Composable
private fun OpenSourceDetailScreen(
    entry: DetailEntry.OpenSource,
    bottomBarPadding: PaddingValues,
    onBack: () -> Unit,
    onOpenLink: (String) -> Unit,
) {
    val listEntry = entry.entry
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SiteTheme.colors.background)
            .statusBarsPadding()
            .padding(bottomBarPadding),
    ) {
        DetailTopBar(label = "开源关注", onBack = onBack)
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = SiteSpace.page),
        ) {
            Text(
                text = listOfNotNull(
                    listEntry.status.takeIf { it.isNotBlank() },
                    listEntry.type.takeIf { it.isNotBlank() },
                ).joinToString(" · "),
                style = SiteText.eyebrow,
                color = SiteTheme.colors.quiet,
            )
            Spacer(Modifier.height(SiteSpace.related))
            Text(text = listEntry.repository, style = SiteText.pageTitle, color = SiteTheme.colors.ink)
            if (listEntry.dimensions.isNotEmpty()) {
                Spacer(Modifier.height(SiteSpace.related))
                Text(
                    text = listEntry.dimensions.joinToString(" · ") { dimensionLabels[it] ?: it },
                    style = SiteText.meta,
                    color = SiteTheme.colors.quiet,
                )
            }
            Spacer(Modifier.height(SiteSpace.paragraph))
            HorizontalDivider(color = SiteTheme.colors.line, thickness = 1.dp)
            Spacer(Modifier.height(SiteSpace.paragraph))
            DetailSection(eyebrow = "摘要", body = listEntry.sourceSummary)
            Spacer(Modifier.height(20.dp))
            SourceCta(label = "在站点查看判读与仓库", host = "default-coder.lovemyrmb.cn") {
                onOpenLink(MediaUrls.sitePage("/open-source/${URLEncoder.encode(listEntry.slug, "UTF-8")}"))
            }
            Spacer(Modifier.height(SiteSpace.section))
        }
    }
}

@Composable
private fun DetailSection(eyebrow: String, body: String) {
    Text(text = eyebrow, style = SiteText.eyebrow, color = SiteTheme.colors.quiet)
    Spacer(Modifier.height(SiteSpace.compact))
    Text(text = body, style = SiteText.body, color = SiteTheme.colors.ink)
}

@Composable
private fun SourceCta(label: String, host: String, onClick: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(SiteTheme.colors.ink)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = SiteSpace.page, vertical = 14.dp),
            horizontalArrangement = Arrangement.Center,
        ) {
            Text(
                text = label,
                style = SiteText.listTitle,
                color = SiteTheme.colors.background,
            )
            Spacer(Modifier.width(6.dp))
            Icon(
                imageVector = Icons.AutoMirrored.Outlined.OpenInNew,
                contentDescription = null,
                tint = SiteTheme.colors.background,
                modifier = Modifier.size(16.dp),
            )
        }
        Text(
            text = host,
            style = SiteText.meta,
            color = SiteTheme.colors.quiet,
            modifier = Modifier.fillMaxWidth(),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
    }
}

/** 策展媒体的展示：视频逐个播放卡，图片 1 张整宽、多张三列方格。 */
@Composable
private fun CurationMediaSection(media: List<CurationMedia>, source: CurationSource) {
    val videos = media.filter { it.videoUrl != null }
    val photos = media.filter { it.videoUrl == null }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        videos.forEach { video -> VideoCard(media = video, source = source) }
        when (photos.size) {
            0 -> Unit
            1 -> {
                val photo = photos.first()
                val aspect = photo.width?.takeIf { it > 0 && (photo.height ?: 0) > 0 }
                    ?.let { it.toFloat() / photo.height!!.toFloat() } ?: 4f / 3f
                AsyncImage(
                    model = photo.url,
                    contentDescription = "图片",
                    contentScale = ContentScale.FillWidth,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(aspect)
                        .clip(RoundedCornerShape(8.dp))
                        .background(SiteTheme.colors.line),
                )
            }

            else -> photos.chunked(3).forEach { rowPhotos ->
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    rowPhotos.forEach { photo ->
                        AsyncImage(
                            model = photo.url,
                            contentDescription = "图片",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .weight(1f)
                                .aspectRatio(1f)
                                .clip(RoundedCornerShape(6.dp))
                                .background(SiteTheme.colors.line),
                        )
                    }
                    repeat(3 - rowPhotos.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    }
}

@Composable
private fun DetailError(message: String, modifier: Modifier = Modifier, onRetry: () -> Unit) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterVertically),
    ) {
        Text(text = message, style = SiteText.summary, color = SiteTheme.colors.muted)
        Text(
            text = "重试",
            style = SiteText.eyebrow,
            color = SiteTheme.colors.ink,
            modifier = Modifier
                .heightIn(min = SiteSpace.touch)
                .clip(RoundedCornerShape(6.dp))
                .clickable(onClickLabel = "重新加载内容", role = Role.Button) { onRetry() }
                .padding(horizontal = 16.dp, vertical = 8.dp),
        )
    }
}

private fun hostOf(url: String): String = runCatching {
    java.net.URI(url).host?.removePrefix("www.") ?: url
}.getOrDefault(url.take(40))

private fun originalActionLabel(url: String): String = when (hostOf(url)) {
    "x.com", "twitter.com" -> "在 X 查看原推"
    "mp.weixin.qq.com" -> "在微信查看原文"
    "github.com" -> "在 GitHub 查看"
    else -> "查看原文"
}
