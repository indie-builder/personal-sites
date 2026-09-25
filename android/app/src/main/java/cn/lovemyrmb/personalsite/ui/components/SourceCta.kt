package cn.lovemyrmb.personalsite.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import cn.lovemyrmb.personalsite.ui.icons.SiteIcons
import cn.lovemyrmb.personalsite.ui.theme.SiteSpace
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme

/** 「打开外部来源」整行 CTA：主操作 + 底部域名提示，详情页与作品集阅读器共用。 */
@Composable
fun SourceCta(label: String, host: String, onClick: () -> Unit) {
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
                imageVector = SiteIcons.OpenInNew,
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
