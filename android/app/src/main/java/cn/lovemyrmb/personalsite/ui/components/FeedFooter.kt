package cn.lovemyrmb.personalsite.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import cn.lovemyrmb.personalsite.data.FeedState
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme

/** 信息流页脚：追加转圈 / 失败重试 / 到底三态，首页栏目与作品集集合页共用。 */
@Composable
fun FeedFooter(state: FeedState<*>, onRetry: () -> Unit) {
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

        state.error != null -> ErrorRetry(message = state.error, modifier = Modifier.fillMaxWidth(), onRetry = onRetry)

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
