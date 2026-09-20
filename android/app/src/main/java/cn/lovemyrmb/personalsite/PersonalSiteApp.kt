package cn.lovemyrmb.personalsite

import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.border
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.background
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
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import cn.lovemyrmb.personalsite.data.HomeViewModel
import cn.lovemyrmb.personalsite.data.Section
import kotlinx.coroutines.launch
import cn.lovemyrmb.personalsite.ui.ask.AskScreen
import cn.lovemyrmb.personalsite.ui.about.AboutScreen
import cn.lovemyrmb.personalsite.ui.components.openExternally
import cn.lovemyrmb.personalsite.ui.components.NavigationIcons
import cn.lovemyrmb.personalsite.ui.detail.DetailRoute
import cn.lovemyrmb.personalsite.ui.home.HomeScreen
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeEffect
import dev.chrisbanes.haze.hazeSource
import dev.chrisbanes.haze.materials.ExperimentalHazeMaterialsApi
import dev.chrisbanes.haze.materials.HazeMaterials

private const val BAR_HEIGHT = 72

private data class GlassBarAction(val label: String, val icon: ImageVector, val url: String?)

// 首页入口与身份外链共用悬浮玻璃底栏。
private val glassBarActions = listOf(
    GlassBarAction("动态", NavigationIcons.Activity, null),
    GlassBarAction("问一问", NavigationIcons.Ask, null),
    GlassBarAction("作品集", NavigationIcons.Portfolio, "https://portfolio.default-coder.lovemyrmb.cn/"),
    GlassBarAction("关于我", NavigationIcons.About, null),
)

@OptIn(ExperimentalHazeMaterialsApi::class)
@Composable
fun PersonalSiteApp(container: AppContainer) {
    val navController = rememberNavController()
    val hazeState = remember { HazeState() }
    val context = LocalContext.current
    val viewModel: HomeViewModel = viewModel(factory = PersonalSiteViewModelFactory(container))
    val askController = container.askController
    val pagerState = rememberPagerState(pageCount = { Section.entries.size })
    val scope = rememberCoroutineScope()
    val backStackEntry by navController.currentBackStackEntryAsState()
    fun openTab(route: String) {
        navController.navigate(route) {
            popUpTo("home") { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }
    var barVisible by remember { mutableStateOf(true) }
    val threshold = with(LocalDensity.current) { 16.dp.toPx() }
    val scrollConnection = remember(threshold, backStackEntry, pagerState.currentPage) {
        object : NestedScrollConnection {
            var travel = 0f
            override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
                if (source == NestedScrollSource.UserInput && consumed.y != 0f) {
                    if (travel * consumed.y < 0f) travel = 0f
                    travel += consumed.y
                    if (kotlin.math.abs(travel) >= threshold) {
                        barVisible = travel > 0f
                        travel = 0f
                    }
                }
                return Offset.Zero
            }
        }
    }
    LaunchedEffect(backStackEntry, pagerState.currentPage) { barVisible = true }

    val navigationBarInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    val bottomBarTotal = BAR_HEIGHT.dp + navigationBarInset + 12.dp

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
                .nestedScroll(scrollConnection)
                .hazeSource(hazeState),
        ) {
            composable("home") {
                HomeScreen(
                    viewModel = viewModel,
                    pagerState = pagerState,
                    bottomBarPadding = bottomBarTotal + 24.dp,
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
            composable("about") {
                AboutScreen(
                    bottomPadding = bottomBarTotal,
                )
            }
            composable("ask") {
                AskScreen(controller = askController, onDismiss = { navController.popBackStack() })
            }
        }


        // 悬浮胶囊：实时背景模糊、透光边缘与独立选中态。
        AnimatedVisibility(
            visible = barVisible && backStackEntry?.destination?.route != "ask",
            enter = slideInVertically(tween(220, easing = FastOutSlowInEasing)) { it } + fadeIn(tween(160)),
            exit = slideOutVertically(tween(180, easing = FastOutSlowInEasing)) { it } + fadeOut(tween(120)),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 12.dp, vertical = 6.dp),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(BAR_HEIGHT.dp)
                    .clip(CircleShape)
                    .hazeEffect(hazeState, style = HazeMaterials.thin(containerColor = SiteTheme.colors.background))
                    .border(1.dp, Brush.verticalGradient(listOf(
                        Color.White.copy(alpha = 0.65f),
                        SiteTheme.colors.ink.copy(alpha = 0.12f),
                        Color.White.copy(alpha = 0.3f),
                    )), CircleShape)
                    .padding(5.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                glassBarActions.forEach { action ->
                    val isHome = action.label == "动态"
                    val isAbout = action.label == "关于我"
                    val selected = (isHome && backStackEntry?.destination?.route == "home") ||
                        (isAbout && backStackEntry?.destination?.route == "about")
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxSize()
                            .clip(CircleShape)
                            .background(if (selected) SiteTheme.colors.ink.copy(alpha = 0.09f) else Color.Transparent)
                            .selectable(selected = selected, role = Role.Tab) {
                                val url = action.url
                                when {
                                    isHome -> {
                                        openTab("home")
                                        scope.launch { pagerState.scrollToPage(0) }
                                        barVisible = true
                                    }
                                    isAbout -> openTab("about")
                                    action.label == "问一问" -> navController.navigate("ask") { launchSingleTop = true }
                                    url != null -> openExternally(context, url)
                                }
                            },
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Icon(
                            imageVector = action.icon,
                            contentDescription = null,
                            tint = SiteTheme.colors.ink,
                            modifier = Modifier.size(26.dp),
                        )
                        Spacer(Modifier.height(3.dp))
                        Text(text = action.label, style = SiteText.meta, color = if (selected) SiteTheme.colors.ink else SiteTheme.colors.muted, maxLines = 1)
                    }
                }
            }
        }
    }

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
