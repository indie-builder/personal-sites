package cn.lovemyrmb.personalsite

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
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
import androidx.navigation.NavOptionsBuilder
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import cn.lovemyrmb.personalsite.data.HomeViewModel
import cn.lovemyrmb.personalsite.data.PortfolioViewModel
import cn.lovemyrmb.personalsite.data.ReaderPayload
import cn.lovemyrmb.personalsite.data.Section
import kotlinx.coroutines.launch
import cn.lovemyrmb.personalsite.ui.ask.AskScreen
import cn.lovemyrmb.personalsite.ui.about.AboutScreen
import cn.lovemyrmb.personalsite.ui.components.openExternally
import cn.lovemyrmb.personalsite.ui.components.NavigationIcons
import cn.lovemyrmb.personalsite.ui.detail.DetailRoute
import cn.lovemyrmb.personalsite.ui.home.HomeScreen
import cn.lovemyrmb.personalsite.ui.portfolio.PortfolioCollectionScreen
import cn.lovemyrmb.personalsite.ui.portfolio.PortfolioItemReader
import cn.lovemyrmb.personalsite.ui.portfolio.PortfolioScreen
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.HazeInput
import dev.chrisbanes.haze.blur.hazeBlur
import dev.chrisbanes.haze.hazeSource
import dev.chrisbanes.haze.blur.materials.HazeMaterials

private const val BAR_HEIGHT = 72

private data class GlassBarAction(val label: String, val icon: ImageVector, val route: String)

// 首页入口与身份外链共用悬浮玻璃底栏。
private val glassBarActions = listOf(
    GlassBarAction("动态", NavigationIcons.Activity, "home"),
    GlassBarAction("问一问", NavigationIcons.Ask, "ask"),
    GlassBarAction("作品集", NavigationIcons.Portfolio, "portfolio"),
    GlassBarAction("关于我", NavigationIcons.About, "about"),
)

// 详情级路由：下钻进入时自右滑入 1/4 屏宽，返回时镜像滑出。页签切换（含恢复的
// 保存栈）不产生内容位移，只允许淡切，路由形态不足以区分两者，见 NAV_MOTION_KEY。
private val detailRoutes = setOf("detail", "portfolio/{collection}", "portfolio-reader")

// 过渡意图随导航写进目标栈条目的 SavedStateHandle：条目按自己进入时持久化的意图
// 退出（淡入的淡出、滑入的滑出），进程重建后意图仍在。
private const val NAV_MOTION_KEY = "nav:motion"

private enum class NavMotion { Tab, Detail }

@Composable
fun PersonalSiteApp(container: AppContainer) {
    val navController = rememberNavController()
    val hazeState = remember { HazeState() }
    val context = LocalContext.current
    val viewModel: HomeViewModel = viewModel(factory = PersonalSiteViewModelFactory(container))
    val portfolioViewModel: PortfolioViewModel = viewModel(factory = PersonalSiteViewModelFactory(container))
    val askController = container.askController
    val pagerState = rememberPagerState(pageCount = { Section.entries.size })
    val scope = rememberCoroutineScope()
    val backStackEntry by navController.currentBackStackEntryAsState()
    // 进入过渡读内存信号：页签操作（含恢复栈顶是详情路由）一律淡入。信号与导航
    // 同回合设置，重组读取时不早于本次导航；退出过渡不读它，改读离场条目持久化
    // 的意图，避免被后续导航覆盖（恢复的集合被下钻覆盖后会错误横滑退出）。
    var navMotion by remember { mutableStateOf(NavMotion.Tab) }
    // 页签操作产生的弹出（Navigation 2.10.2 对 popUpTo 恢复页签记 isPop）与真实
    // Back 无法从路由形态区分：记录该操作实际完成的（离场条目, 目标条目）对，
    // popExit 命中即强制淡出。记录在每次 navigate 开头清空；真实 Back 不经
    // navigate，要再次成为离场方必须先经一次 navigate 回到栈顶，因此真实 Back
    // 命不中残留记录，仍走离场条目持久化的意图。
    var tabPop by remember { mutableStateOf<Pair<String, String>?>(null) }
    fun navigate(route: String, motion: NavMotion, options: NavOptionsBuilder.() -> Unit = {}) {
        tabPop = null
        navMotion = motion
        navController.navigate(route, options)
        // 同一主线程回合写入目标条目（页签恢复时目标是恢复栈顶条目，其意图刷新为
        // Tab，Back 便按淡入镜像淡出），重组里的过渡读取不早于本次导航。
        navController.currentBackStackEntry?.savedStateHandle?.set(NAV_MOTION_KEY, motion)
    }
    fun openTab(route: String) {
        val fromId = navController.currentBackStackEntry?.id
        navigate(route, NavMotion.Tab) {
            popUpTo("home") { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
        val toId = navController.currentBackStackEntry?.id
        if (fromId != null && toId != null && fromId != toId) tabPop = fromId to toId
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
            // Compose tween 经 MotionDurationScale 读取系统动画时长缩放，减动效路径自动生效。
            enterTransition = {
                if (navMotion == NavMotion.Tab || targetState.destination.route !in detailRoutes) {
                    fadeIn(tween(200))
                } else {
                    slideInHorizontally(tween(300, easing = FastOutSlowInEasing)) { it / 4 } + fadeIn(tween(200))
                }
            },
            exitTransition = { fadeOut(tween(150)) },
            popEnterTransition = { fadeIn(tween(200)) },
            popExitTransition = {
                // 页签弹出按记录的（离场, 目标）条目对识别，其余弹出（真实 Back）读离场条目持久化的意图。
                val tabPopFade = tabPop?.let { (fromId, toId) ->
                    initialState.id == fromId && targetState.id == toId
                } == true
                val outgoing = initialState.savedStateHandle.get<NavMotion>(NAV_MOTION_KEY)
                if (tabPopFade || outgoing != NavMotion.Detail || initialState.destination.route !in detailRoutes) {
                    fadeOut(tween(150))
                } else {
                    slideOutHorizontally(tween(250, easing = FastOutSlowInEasing)) { it / 4 } + fadeOut(tween(200))
                }
            },
        ) {
            composable("home") {
                HomeScreen(
                    viewModel = viewModel,
                    pagerState = pagerState,
                    bottomBarPadding = bottomBarTotal + 24.dp,
                    onOpenDetail = { entry ->
                        container.pendingDetail = entry
                        navigate("detail", NavMotion.Detail)
                    },
                )
            }
            composable("detail") {
                DetailRoute(
                    entry = container.pendingDetail,
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
            composable("portfolio") {
                PortfolioScreen(
                    viewModel = portfolioViewModel,
                    bottomPadding = bottomBarTotal,
                    onOpenCollection = {
                        navigate("portfolio/$it", NavMotion.Detail)
                    },
                    onOpenLink = { openExternally(context, it) },
                )
            }
            composable("portfolio/{collection}") { entry ->
                val collection = entry.arguments?.getString("collection").orEmpty()
                PortfolioCollectionScreen(
                    collection = collection,
                    viewModel = portfolioViewModel,
                    bottomPadding = bottomBarTotal,
                    onBack = { navController.popBackStack() },
                    onOpenItem = { items, index ->
                        container.pendingPortfolioReader = ReaderPayload(collection, items, index)
                        navigate("portfolio-reader", NavMotion.Detail)
                    },
                )
            }
            composable("portfolio-reader") {
                PortfolioItemReader(
                    payload = container.pendingPortfolioReader,
                    api = container.portfolioApi,
                    bottomPadding = bottomBarTotal,
                    onBack = { navController.popBackStack() },
                    onOpenLink = { openExternally(context, it) },
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
                    .hazeBlur(input = HazeInput.Sources(hazeState), style = HazeMaterials.thin(containerColor = SiteTheme.colors.background))
                    .border(1.dp, Brush.verticalGradient(listOf(
                        Color.White.copy(alpha = 0.65f),
                        SiteTheme.colors.ink.copy(alpha = 0.12f),
                        Color.White.copy(alpha = 0.3f),
                    )), CircleShape)
                    .padding(5.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                glassBarActions.forEach { action ->
                    val route = backStackEntry?.destination?.route.orEmpty()
                    val selected = route == action.route ||
                        (action.route == "portfolio" && route.startsWith("portfolio"))
                    // 选中态胶囊与文字按 Web 同位 160ms 颜色规则过渡。
                    val pillColor by animateColorAsState(
                        targetValue = if (selected) SiteTheme.colors.ink.copy(alpha = 0.09f) else Color.Transparent,
                        animationSpec = tween(160, easing = FastOutSlowInEasing),
                        label = "bar-pill",
                    )
                    val labelColor by animateColorAsState(
                        targetValue = if (selected) SiteTheme.colors.ink else SiteTheme.colors.muted,
                        animationSpec = tween(160, easing = FastOutSlowInEasing),
                        label = "bar-label",
                    )
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxSize()
                            .clip(CircleShape)
                            .background(pillColor)
                            .selectable(selected = selected, role = Role.Tab) {
                                when (action.route) {
                                    "home" -> {
                                        openTab("home")
                                        scope.launch { pagerState.scrollToPage(0) }
                                        barVisible = true
                                    }
                                    "ask" -> navigate("ask", NavMotion.Detail) { launchSingleTop = true }
                                    else -> openTab(action.route)
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
                        Text(text = action.label, style = SiteText.meta, color = labelColor, maxLines = 1)
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
            PortfolioViewModel::class.java -> PortfolioViewModel(container.portfolioApi) as T
            else -> throw IllegalArgumentException("Unknown ViewModel: $modelClass")
        }
}
