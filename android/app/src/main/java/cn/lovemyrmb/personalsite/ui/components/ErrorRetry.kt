package cn.lovemyrmb.personalsite.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import cn.lovemyrmb.personalsite.ui.theme.SiteSpace
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme

/** 加载失败的「消息 + 重试」组合：重试为 48dp 触控、Role.Button 的完整语义。 */
@Composable
fun ErrorRetry(message: String, modifier: Modifier = Modifier, onRetry: () -> Unit) {
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
                .heightIn(min = SiteSpace.touch)
                .clip(RoundedCornerShape(6.dp))
                .clickable(onClickLabel = "重新加载内容", role = Role.Button) { onRetry() }
                .padding(horizontal = 16.dp, vertical = 8.dp),
        )
    }
}
