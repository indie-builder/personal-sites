package cn.lovemyrmb.personalsite.ui.ask

import android.content.res.Configuration
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import cn.lovemyrmb.personalsite.data.AskScope
import cn.lovemyrmb.personalsite.ui.theme.SiteSpace
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme

/** 推荐问题与其检索范围成对声明，避免按文案字符串反推范围（docs/ask-experience.md：推荐问题会选对应范围）。 */
private val recommendedQuestions = listOf(
    "介绍一下陈远" to AskScope.PROFILE,
    "最近关注哪些 AI 技术？" to AskScope.AI_NEWS,
    "有哪些值得了解的开源项目？" to AskScope.OPEN_SOURCE,
)

@Composable
internal fun AskSuggestions(enabled: Boolean, onSelect: (String, AskScope) -> Unit) {
    // 横屏高度有限：推荐问题横向滚动排布并压缩顶部留白，避免被输入区裁切。
    val landscape = LocalConfiguration.current.orientation == Configuration.ORIENTATION_LANDSCAPE
    Column(Modifier.padding(top = if (landscape) SiteSpace.compact else 40.dp), verticalArrangement = Arrangement.spacedBy(SiteSpace.paragraph)) {
        Text("有什么想了解的？", style = SiteText.pageTitle, color = SiteTheme.colors.ink)
        Text("关于陈远、每日关注或开源内容，都可以从这里开始。", style = SiteText.body, color = SiteTheme.colors.muted)
        // 横竖屏只换容器(横向滚动 vs 纵向堆叠),推荐问题芯片共用一份渲染。
        val questionChips: @Composable () -> Unit = {
            recommendedQuestions.forEach { (question, questionScope) ->
                RecommendedChip(question, enabled) { onSelect(question, questionScope) }
            }
        }
        if (landscape) {
            Row(
                Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(SiteSpace.compact),
            ) { questionChips() }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(SiteSpace.paragraph)) { questionChips() }
        }
    }
}

/** 推荐问题芯片：点击填入草稿并选对应范围（行为契约见 docs/ask-experience.md）。 */
@Composable
private fun RecommendedChip(question: String, enabled: Boolean, onSelect: () -> Unit) {
    OutlinedButton(onClick = onSelect, enabled = enabled) { Text(question) }
}
