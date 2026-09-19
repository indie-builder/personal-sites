package cn.lovemyrmb.personalsite

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.outlined.Code
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Work
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import cn.lovemyrmb.personalsite.data.AskController
import cn.lovemyrmb.personalsite.data.HomeViewModel
import cn.lovemyrmb.personalsite.ui.about.AboutSheet
import cn.lovemyrmb.personalsite.ui.ask.AskSheet
import cn.lovemyrmb.personalsite.ui.components.openExternally
import cn.lovemyrmb.personalsite.ui.detail.DetailRoute
import cn.lovemyrmb.personalsite.ui.home.HomeScreen
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeEffect
import dev.chrisbanes.haze.hazeSource
import dev.chrisbanes.haze.materials.HazeMaterials

private const val BAR_HEIGHT = 62

private data class GlassBarAction(val label: String, val icon: ImageVector, val url: String?)

// 底部身份外链：对应站点身份栏的 GitHub / 语雀 / 作品集 / 关于我。
private val glassBarActions = listOf(
    GlassBarAction("GitHub", Icons.Outlined.Code, "https://github.com/indie-builder"),
    GlassBarAction("语雀", Icons.AutoMirrored.Outlined.MenuBook, "https://www.yuque.com/defulat-coder"),
    GlassBarAction("作品集", Icons.Outlined.Work, "https://portfolio.default-coder.lovemyrmb.cn/"),
    GlassBarAction("关于我", Icons.Outlined.Person, null),
)

@Composable
fun PersonalSiteApp(container: AppContainer) {
    val navController = rememberNavController()
    val hazeState = remember { HazeState() }
    val context = LocalContext.current
    val viewModel: HomeViewModel = viewModel(factory = PersonalSiteViewModelFactory(container))
    val askController = remember { AskController(container.askClient, container.visitorId) }
    var showAbout by rememberSaveable { mutableStateOf(false) }
    var showAsk by rememberSaveable { mutableStateOf(false) }

    val navigationBarInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    val bottomBarTotal = BAR_HEIGHT.dp + navigationBarInset

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(SiteTheme.colors.background),
    ) {
        NavHost(
            navController = navController,
            startDestination = "home",
            modifier = Modifier
                .fillMaxSize()
                .hazeSource(hazeState),
        ) {
            composable("home") {
                HomeScreen(
                    viewModel = viewModel,
                    bottomBarPadding = bottomBarTotal + 96.dp,
                    onOpenDetail = { entry ->
                        container.entryHolder.set(entry)
                        navController.navigate("detail/${entry.section.name}/${Uri.encode(entry.id)}")
                    },
                    onOpenLink = { openExternally(context, it) },
                )
            }
            composable("detail/{section}/{id}") {
                DetailRoute(
                    entry = container.entryHolder.pending,
                    api = container.api,
                    bottomBarPadding = PaddingValues(bottom = bottomBarTotal),
                    onBack = { navController.popBackStack() },
                )
            }
        }

        FloatingActionButton(
            onClick = { showAsk = true },
            shape = CircleShape,
            containerColor = SiteTheme.colors.ink,
            contentColor = SiteTheme.colors.background,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 20.dp, bottom = bottomBarTotal + 16.dp),
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Outlined.Chat,
                contentDescription = "问一问",
            )
        }

        // 磨砂玻璃底栏：实时模糊其后的内容流。
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .hazeEffect(hazeState, style = HazeMaterials.thin(containerColor = SiteTheme.colors.background)),
        ) {
            HorizontalDivider(color = SiteTheme.colors.line, thickness = 1.dp)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .height(BAR_HEIGHT.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                glassBarActions.forEach { action ->
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxSize()
                            .clickable {
                                val url = action.url
                                if (url != null) openExternally(context, url) else showAbout = true
                            },
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Icon(
                            imageVector = action.icon,
                            contentDescription = action.label,
                            tint = SiteTheme.colors.ink,
                            modifier = Modifier.size(22.dp),
                        )
                        Spacer(Modifier.height(3.dp))
                        Text(text = action.label, style = SiteText.meta, color = SiteTheme.colors.muted)
                    }
                }
            }
        }
    }

    if (showAbout) AboutSheet(onDismiss = { showAbout = false })
    if (showAsk) AskSheet(controller = askController, onDismiss = { showAsk = false })
}

private class PersonalSiteViewModelFactory(
    private val container: AppContainer,
) : androidx.lifecycle.ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : androidx.lifecycle.ViewModel> create(modelClass: Class<T>): T =
        when (modelClass) {
            HomeViewModel::class.java -> HomeViewModel(container.api) as T
            else -> throw IllegalArgumentException("Unknown ViewModel: $modelClass")
        }
}
