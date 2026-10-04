package cn.lovemyrmb.personalsite.ui.portfolio

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import cn.lovemyrmb.personalsite.data.CurationMedia
import cn.lovemyrmb.personalsite.data.CurationSource
import cn.lovemyrmb.personalsite.data.PORTFOLIO_BASE_URL
import cn.lovemyrmb.personalsite.data.PortfolioApi
import cn.lovemyrmb.personalsite.data.PortfolioMedia
import cn.lovemyrmb.personalsite.data.PortfolioProduct
import cn.lovemyrmb.personalsite.data.ReaderPayload
import cn.lovemyrmb.personalsite.data.PortfolioViewModel
import cn.lovemyrmb.personalsite.ui.components.CurationMediaSection
import cn.lovemyrmb.personalsite.ui.components.SiteAsyncImage
import cn.lovemyrmb.personalsite.ui.components.ErrorRetry
import cn.lovemyrmb.personalsite.ui.components.SourceCta
import cn.lovemyrmb.personalsite.ui.components.hostOf
import cn.lovemyrmb.personalsite.ui.icons.SiteIcons
import cn.lovemyrmb.personalsite.ui.theme.SiteSpace
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme

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
    viewModel: PortfolioViewModel,
    bottomPadding: Dp,
    onOpenCollection: (String) -> Unit,
    onOpenLink: (String) -> Unit,
) {
    val state by viewModel.products.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.loadProducts() }

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
            // 首拉用居中转圈，仅已有内容时才显示顶部刷新指示器，避免双圈。
            isRefreshing = state.refreshing && state.items != null,
            onRefresh = { viewModel.refreshProducts() },
            modifier = Modifier.fillMaxSize(),
        ) {
            val products = state.items
            when {
                products == null && state.refreshError -> ErrorRetry(
                    message = "暂时无法读取作品集。",
                    modifier = Modifier.fillMaxSize(),
                ) { viewModel.refreshProducts() }
                products == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = SiteTheme.colors.muted, strokeWidth = 2.dp)
                }
                else -> LazyColumn {
                    if (state.refreshError) {
                        item(key = "refresh-error") {
                            Text(
                                text = "刷新失败，仍显示上次内容，可下拉重试。",
                                style = SiteText.meta,
                                color = SiteTheme.colors.quiet,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = SiteSpace.page, vertical = SiteSpace.compact),
                            )
                        }
                    }
                    itemsIndexed(products, key = { _, product -> product.id }) { _, product ->
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
                            SiteAsyncImage(
                                model = product.cover.takeIf { it.isNotBlank() },
                                contentDescription = null,
                                modifier = Modifier
                                    .width(100.dp)
                                    .height(112.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(SiteTheme.colors.line),
                            )
                        }
                        HorizontalDivider(modifier = Modifier.padding(horizontal = SiteSpace.page), thickness = Dp.Hairline, color = SiteTheme.colors.line)
                    }
                    item(key = "bottom") { Spacer(Modifier.height(SiteSpace.section)) }
                }
            }
        }
    }
}

/** 全屏阅读器：同屏条目前后翻页，媒体在应用内播放，来源跳外部。 */
@Composable
fun PortfolioItemReader(
    payload: ReaderPayload?,
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
    url = poster.ifBlank { url },
    videoUrl = url.takeIf { isVideo },
    width = width.takeIf { it > 0 },
    height = height.takeIf { it > 0 },
)
