package cn.lovemyrmb.personalsite.ui.about

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.Image
import androidx.compose.ui.res.painterResource
import cn.lovemyrmb.personalsite.R
import cn.lovemyrmb.personalsite.ui.components.openExternally
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import cn.lovemyrmb.personalsite.ui.theme.SiteSpace
import cn.lovemyrmb.personalsite.ui.theme.SiteText

/*
 * THESIS: Read a person, not a toolbar. Identity and experience form one composition.
 * OWN-WORLD: Existing monochrome, native Material typography, unboxed reading flow.
 * STORY: Recognize Chen Yuan, read his engineering practice, open career or external notes.
 * FIRST VIEWPORT: Quiet external links above the right-aligned portrait; name and handle
 * left, career dates below; biography leads into the technical field without footer actions.
 * FORM: Personal introduction spread; surface seed 3d507984. Native composition.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review,
 * the verdict, DESIGN.md, and every shipping raster carrying its provenance.
 */
@Composable
fun AboutScreen(bottomPadding: Dp) {
    val context = LocalContext.current
    var showCareer by rememberSaveable { mutableStateOf(false) }
    LazyColumn(
        modifier = Modifier.fillMaxSize().statusBarsPadding(),
        contentPadding = PaddingValues(start = SiteSpace.page, end = SiteSpace.page, top = 12.dp, bottom = bottomPadding + 24.dp),
    ) {
        item(key = "identity") {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.End),
                ) {
                    listOf("GitHub" to "https://github.com/indie-builder", "语雀" to "https://www.yuque.com/defulat-coder").forEach { (label, url) ->
                        Row(
                            modifier = Modifier.clickable(role = Role.Button, onClickLabel = "在浏览器打开$label") { openExternally(context, url) }
                                .heightIn(min = 48.dp).padding(horizontal = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Text(label, style = SiteText.meta, color = SiteTheme.colors.muted)
                            Icon(Icons.AutoMirrored.Outlined.OpenInNew, contentDescription = null, modifier = Modifier.size(14.dp), tint = SiteTheme.colors.muted)
                        }
                    }
                }
                Spacer(Modifier.height(SiteSpace.compact))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("陈远", style = SiteText.identity, color = SiteTheme.colors.ink)
                        Text("@indie-builder", style = SiteText.summary, color = SiteTheme.colors.muted)
                    }
                    Image(painter = painterResource(R.drawable.profile_avatar), contentDescription = "陈远的头像插画", modifier = Modifier.size(104.dp))
                }
                Row(
                    modifier = Modifier.fillMaxWidth()
                        .clickable(role = Role.Button, onClickLabel = "查看个人经历") { showCareer = true }
                        .heightIn(min = 56.dp).padding(vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text("2014—至今", style = SiteText.label, color = SiteTheme.colors.ink)
                    Text("个人经历", style = SiteText.meta, color = SiteTheme.colors.muted, modifier = Modifier.weight(1f))
                    Icon(Icons.AutoMirrored.Outlined.ArrowForward, contentDescription = null, modifier = Modifier.size(18.dp), tint = SiteTheme.colors.ink)
                }
                Spacer(Modifier.height(SiteSpace.section))
            }
        }
        item(key = "introduction") {
            ProfileGreeting()
            Spacer(Modifier.height(SiteSpace.paragraph))
            Text("十余年项目开发经验，横跨 Java、Python、TypeScript 与前端；从业务平台、云服务到企业 AI，一直在做需要长期负责的工程系统。", style = SiteText.body, color = SiteTheme.colors.muted)
            Spacer(Modifier.height(SiteSpace.paragraph))
            Text("现在关心 AI 如何进入真实工作，Web 如何成为新的创造界面，以及系统如何经得起长期使用。", style = SiteText.body, color = SiteTheme.colors.muted)
            Spacer(Modifier.height(SiteSpace.paragraph))
            Text("这里记录正在构建的东西，以及那些值得继续拆解的工程问题。", style = SiteText.body, color = SiteTheme.colors.muted)
            Spacer(Modifier.height(SiteSpace.section))
        }
        item(key = "technical-field") {
            TechnicalTerms()
            Spacer(Modifier.height(SiteSpace.section))
        }
    }
    if (showCareer) AboutSheet(onDismiss = { showCareer = false })
}
