package cn.lovemyrmb.personalsite.ui.detail

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import cn.lovemyrmb.personalsite.data.AiNewsItem
import cn.lovemyrmb.personalsite.data.SiteApi
import cn.lovemyrmb.personalsite.data.aiNewsCategoryLabel
import cn.lovemyrmb.personalsite.ui.components.ErrorRetry
import cn.lovemyrmb.personalsite.ui.components.SourceCta
import cn.lovemyrmb.personalsite.ui.components.feedTimeLabel
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import cn.lovemyrmb.personalsite.ui.theme.SiteSpace
import cn.lovemyrmb.personalsite.ui.theme.SiteText

@Composable
internal fun AiNewsDetailScreen(
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

    DetailFrame("每日动态", bottomBarPadding, onBack) {
        when {
            item != null -> AiNewsDetailBody(item!!, onOpenLink)
            error != null -> Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                ErrorRetry(message = error ?: "") {
                    error = null
                    attempt++
                }
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

private fun originalActionLabel(url: String): String = when (hostOf(url)) {
    "x.com", "twitter.com" -> "在 X 查看原推"
    "mp.weixin.qq.com" -> "在微信查看原文"
    "github.com" -> "在 GitHub 查看"
    else -> "查看原文"
}
