package cn.lovemyrmb.personalsite.ui.ask

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import cn.lovemyrmb.personalsite.data.AskSource
import cn.lovemyrmb.personalsite.ui.icons.SiteIcons
import cn.lovemyrmb.personalsite.ui.theme.SiteSpace
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme

@Composable
internal fun SourceReader(source: AskSource, number: Int, onBack: () -> Unit) {
    Column(Modifier.fillMaxSize().background(SiteTheme.colors.background).statusBarsPadding().navigationBarsPadding()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(SiteIcons.ArrowBack, "返回对话") }
            Text("引用 $number", style = SiteText.title, color = SiteTheme.colors.ink)
        }
        SelectionContainer(modifier = Modifier.weight(1f)) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(SiteSpace.page), verticalArrangement = Arrangement.spacedBy(SiteSpace.paragraph)) {
                Text(source.title.ifBlank { "引用资料" }, style = SiteText.pageTitle, color = SiteTheme.colors.ink)
                Text(listOfNotNull(source.section, source.publishedAt).filter { it.isNotBlank() }.joinToString(" · "), style = SiteText.meta, color = SiteTheme.colors.muted)
                Text("本次检索返回的资料片段", style = SiteText.label, color = SiteTheme.colors.muted)
                Text(source.content.ifBlank { "该引用没有返回可阅读的正文。" }, style = SiteText.body, color = SiteTheme.colors.ink)
            }
        }
    }
}
