package cn.lovemyrmb.personalsite.ui.about

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import cn.lovemyrmb.personalsite.ui.theme.SiteText

private data class ReceiptItem(val company: String, val meta: String, val years: String)

// 与站点履历打印稿一致的四段经历（components/about-print.tsx）。
private val receiptItems = listOf(
    ReceiptItem("PLUS数字科技", "2014—2019 · Java · 服务运维", "5 年"),
    ReceiptItem("红星美凯龙", "2019—2023 · 业务 · 集团架构", "4 年"),
    ReceiptItem("喜马拉雅", "2023—2026 · 企业 AI 应用", "3 年"),
    ReceiptItem("PayerMax", "2026— · OPT · 端到端交付", "至今"),
)

/** 「关于我」：复刻站内履历小票（等宽字、细线、条码收尾）。 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AboutSheet(onDismiss: () -> Unit) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = SiteTheme.colors.background,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 28.dp)
                .padding(bottom = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = "陈远 / CHEN YUAN",
                style = SiteText.title.copy(fontFamily = FontFamily.Monospace),
                color = SiteTheme.colors.ink,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "个人经历 · CAREER RECEIPT",
                style = SiteText.meta.copy(fontFamily = FontFamily.Monospace),
                color = SiteTheme.colors.quiet,
            )
            Spacer(Modifier.height(16.dp))
            HorizontalDivider(color = SiteTheme.colors.ink, thickness = 1.dp)
            Spacer(Modifier.height(16.dp))
            receiptItems.forEach { item ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = item.company,
                        style = SiteText.summary.copy(fontFamily = FontFamily.Monospace, fontWeight = FontWeight.SemiBold),
                        color = SiteTheme.colors.ink,
                    )
                    Text(
                        text = item.years,
                        style = SiteText.summary.copy(fontFamily = FontFamily.Monospace),
                        color = SiteTheme.colors.ink,
                    )
                }
                Text(
                    text = item.meta,
                    style = SiteText.meta.copy(fontFamily = FontFamily.Monospace),
                    color = SiteTheme.colors.muted,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 2.dp, bottom = 12.dp),
                )
            }
            HorizontalDivider(color = SiteTheme.colors.ink, thickness = 1.dp)
            Spacer(Modifier.height(14.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = "合计 TOTAL",
                    style = SiteText.summary.copy(fontFamily = FontFamily.Monospace),
                    color = SiteTheme.colors.ink,
                )
                Text(
                    text = "12 年",
                    style = SiteText.title.copy(fontFamily = FontFamily.Monospace, fontWeight = FontWeight.SemiBold),
                    color = SiteTheme.colors.ink,
                )
            }
            Spacer(Modifier.height(6.dp))
            Text(
                text = "十二年 · 四段路 · 仍在增长",
                style = SiteText.meta.copy(fontFamily = FontFamily.Monospace),
                color = SiteTheme.colors.quiet,
            )
            Spacer(Modifier.height(14.dp))
            ReceiptBarcode(modifier = Modifier.fillMaxWidth().height(36.dp))
        }
    }
}

/** 装饰条码：确定性伪随机宽度的竖条，纯观感。 */
@Composable
private fun ReceiptBarcode(modifier: Modifier = Modifier) {
    val ink = SiteTheme.colors.ink
    Canvas(modifier = modifier) {
        var x = 0f
        var seed = 7L
        while (x < size.width) {
            seed = seed * 6364136223846793005L + 1442695040888963407L
            val wide = ((seed shr 33) and 3L) > 1L
            val barWidth = if (wide) size.width / 90f else size.width / 220f
            drawRect(color = ink, topLeft = androidx.compose.ui.geometry.Offset(x, 0f), size = androidx.compose.ui.geometry.Size(barWidth, size.height))
            x += barWidth + size.width / 160f
        }
    }
}
