package cn.lovemyrmb.personalsite.ui.ask

import android.animation.ValueAnimator
import android.content.ClipData
import android.content.res.Configuration
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.updateTransition
import androidx.compose.foundation.background
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import kotlinx.coroutines.delay
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import cn.lovemyrmb.personalsite.ui.icons.SiteIcons
import cn.lovemyrmb.personalsite.data.*
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import cn.lovemyrmb.personalsite.ui.theme.SiteSpace
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import kotlinx.coroutines.launch

/** 推荐问题与其检索范围成对声明，避免按文案字符串反推范围（docs/ask-experience.md：推荐问题会选对应范围）。 */
private val recommendedQuestions = listOf(
    "介绍一下陈远" to AskScope.PROFILE,
    "最近关注哪些 AI 技术？" to AskScope.AI_NEWS,
    "有哪些值得了解的开源项目？" to AskScope.OPEN_SOURCE,
)

/** 推荐问题芯片：点击填入草稿并选对应范围（行为契约见 docs/ask-experience.md）。 */
@Composable
private fun RecommendedChip(question: String, enabled: Boolean, onSelect: () -> Unit) {
    OutlinedButton(onClick = onSelect, enabled = enabled) { Text(question) }
}

/** Full-screen native conversation. References open the returned source content in-app. */
@Composable
fun AskScreen(controller: AskController, onDismiss: () -> Unit) {
    val state by controller.state.collectAsStateWithLifecycle()
    val list = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val keyboard = LocalSoftwareKeyboardController.current
    val clipboard = LocalClipboard.current
    val focus = remember { FocusRequester() }
    var input by rememberSaveable { mutableStateOf("") }
    var searchScope by rememberSaveable { mutableStateOf(AskScope.ALL) }
    var scopeMenu by remember { mutableStateOf(false) }
    var followLatest by remember { mutableStateOf(true) }
    var sourceMessageId by rememberSaveable { mutableStateOf<Long?>(null) }
    var sourceIndex by rememberSaveable { mutableIntStateOf(0) }
    var confirmReset by remember { mutableStateOf(false) }
    val selectedSource = state.messages.firstOrNull { it.id == sourceMessageId }?.sources?.getOrNull(sourceIndex)
    val validInput = input.trim().length in 2..1000
    fun send() {
        if (!validInput || state.streaming) return
        followLatest = true
        controller.send(input, searchScope)
        input = ""
        keyboard?.hide()
    }
    fun openSource(message: AskMessage, index: Int) {
        keyboard?.hide()
        sourceMessageId = message.id
        sourceIndex = index
    }
    DisposableEffect(controller) { onDispose { controller.cancel() } }
    LaunchedEffect(list) {
        snapshotFlow { list.isScrollInProgress to list.canScrollForward }.collect { (scrolling, canForward) ->
            if (scrolling) followLatest = !canForward
        }
    }
    LaunchedEffect(state.messages.size, state.messages.lastOrNull(), selectedSource) {
        if (selectedSource == null && followLatest && !list.isScrollInProgress && state.messages.isNotEmpty()) {
            list.scrollToItem(state.messages.size)
        }
    }
    // 引用阅读器以垂直滑动开合（iOS 同位为 sheet）；关闭系统动画时直接换层。
    val animatorsEnabled = remember { ValueAnimator.areAnimatorsEnabled() }
    // 返回键提升到阅读器层外：阅读器关闭动画期间再次返回应退出问答，
    // 而不是被离场内容里仍启用的 BackHandler 再次置空来源。
    BackHandler(enabled = selectedSource != null) { sourceMessageId = null }
    // 会话层与阅读器层同 Box 叠放，保留由显式过渡状态驱动：阅读器升起期间会话
    // 组合不拆除（compose-animation 1.12.1 无公开的离场保留出口，
    // KeepUntilTransitionsFinished 是模块内部 API，退出动画时长作保留计时会因
    // 零位移动画立即完成而提前拆层）；关闭时阅读器在上方下滑，会话原地显现。
    val readerOpen = selectedSource != null
    val readerTransition = updateTransition(targetState = readerOpen, label = "source-reader")
    val readerSlide by readerTransition.animateFloat(
        transitionSpec = {
            if (!animatorsEnabled) snap() else if (targetState) tween(300, easing = FastOutSlowInEasing) else tween(220)
        },
        label = "reader-slide",
    ) { open -> if (open) 1f else 0f }
    val readerAlpha by readerTransition.animateFloat(
        transitionSpec = { if (!animatorsEnabled) snap() else if (targetState) tween(200) else tween(140) },
        label = "reader-fade",
    ) { open -> if (open) 1f else 0f }
    // 关闭时 selectedSource 已空，保留最后打开的来源供滑出中的阅读器渲染。
    var closingSource by remember { mutableStateOf<AskSource?>(null) }
    LaunchedEffect(selectedSource) { if (selectedSource != null) closingSource = selectedSource }
    val readerSource = selectedSource ?: closingSource
    // 阅读器在场（升起或滑出中）时下层会话必须惰性：整层消费指针、隐藏会话语义、
    // 以焦点组 + onEnter 拒入封锁会话子树焦点（canFocus 级联止步于 LazyColumn 的
    // 中间焦点目标，其内条目——来源行、复制、重新生成——仍可被 Tab/Shift+Tab
    // 遍历到，组级 cancelFocusChange 拦下包括该路径在内的全部进入）、清除编辑器
    // 焦点并停用其快捷发送，会话内可交互控件（返回、新对话、推荐问题、范围与
    // 发送）同步停用。readerVisible 在滑出动画归零后才为 false，恢复即以它为
    // 准；关闭后上述全部自然恢复（不自动回焦）。
    val readerInFlight = readerOpen || readerSlide > 0f || readerAlpha > 0f
    val readerVisible = readerSource != null && readerInFlight
    val focusManager = LocalFocusManager.current
    LaunchedEffect(readerOpen) { if (readerOpen) focusManager.clearFocus() }
    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier.fillMaxSize().background(SiteTheme.colors.background).statusBarsPadding().imePadding().navigationBarsPadding()
                .focusProperties {
                    onEnter = { if (readerVisible) cancelFocusChange() }
                }
                .focusGroup()
                .then(if (readerVisible) Modifier.clearAndSetSemantics { } else Modifier)
        ) {
            Row(Modifier.fillMaxWidth().padding(horizontal = SiteSpace.compact), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onDismiss, enabled = !readerVisible) { Icon(SiteIcons.ArrowBack, "返回") }
                Column(Modifier.weight(1f)) {
                    Text("问一问", style = SiteText.title, color = SiteTheme.colors.ink)
                    Text("基于站内资料 · 引用可在应用内阅读", style = SiteText.meta, color = SiteTheme.colors.muted)
                }
                TextButton(onClick = { if (state.messages.isNotEmpty() || input.isNotBlank()) confirmReset = true }, enabled = !readerVisible) { Text("新对话") }
            }
            Box(Modifier.weight(1f).fillMaxWidth()) {
                LazyColumn(state = list, modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(horizontal = SiteSpace.page, vertical = SiteSpace.paragraph), verticalArrangement = Arrangement.spacedBy(SiteSpace.section)) {
                    if (state.messages.isEmpty()) item {
                        // 横屏高度有限：推荐问题横向滚动排布并压缩顶部留白，避免被输入区裁切。
                        val landscape = LocalConfiguration.current.orientation == Configuration.ORIENTATION_LANDSCAPE
                        Column(Modifier.padding(top = if (landscape) SiteSpace.compact else 40.dp), verticalArrangement = Arrangement.spacedBy(SiteSpace.paragraph)) {
                            Text("有什么想了解的？", style = SiteText.pageTitle, color = SiteTheme.colors.ink)
                            Text("关于陈远、每日关注或开源内容，都可以从这里开始。", style = SiteText.body, color = SiteTheme.colors.muted)
                            // 横竖屏只换容器(横向滚动 vs 纵向堆叠),推荐问题芯片共用一份渲染。
                            val questionChips: @Composable () -> Unit = {
                                recommendedQuestions.forEach { (question, questionScope) ->
                                    RecommendedChip(question, !readerVisible) {
                                        input = question
                                        searchScope = questionScope
                                        focus.requestFocus(); keyboard?.show()
                                    }
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
                    itemsIndexed(state.messages, key = { _, message -> message.id }) { index, message ->
                        if (message.role == AskMessage.Role.QUESTION) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                                SelectionContainer {
                                    Text(message.text, style = SiteText.body, color = SiteTheme.colors.ink,
                                        modifier = Modifier.widthIn(max = 300.dp).clip(RoundedCornerShape(20.dp)).background(SiteTheme.colors.line).padding(horizontal = SiteSpace.paragraph, vertical = SiteSpace.related))
                                }
                            }
                        } else Column(verticalArrangement = Arrangement.spacedBy(SiteSpace.related)) {
                            if (message.text.isNotBlank()) {
                                AnswerMarkdown(message.text, message.sources.size) { openSource(message, it) }
                            } else Text(when (message.status) {
                                AskMessage.Status.STREAMING -> "正在查阅资料…"
                                AskMessage.Status.ERROR -> "这次未能完成回答"
                                AskMessage.Status.STOPPED -> "已停止生成"
                                AskMessage.Status.COMPLETE -> "暂无可显示的回答"
                            }, style = SiteText.body, color = SiteTheme.colors.muted)
                            if (message.status == AskMessage.Status.STOPPED && message.text.isNotBlank()) Text("已停止生成", style = SiteText.meta, color = SiteTheme.colors.muted)
                            if (message.sources.isNotEmpty()) {
                                Text(if (message.text.isBlank()) "检索到的资料" else "参考资料 · 点击查看依据", style = SiteText.meta, color = SiteTheme.colors.muted)
                                message.sources.forEachIndexed { number, source ->
                                    Row(Modifier.fillMaxWidth().clickable(role = Role.Button) { openSource(message, number) }.heightIn(min = SiteSpace.touch).padding(vertical = SiteSpace.compact), horizontalArrangement = Arrangement.spacedBy(SiteSpace.related)) {
                                        Text("${number + 1}", style = SiteText.label, color = SiteTheme.colors.ink)
                                        Column(Modifier.weight(1f)) {
                                            Text(source.title.ifBlank { "引用资料 ${number + 1}" }, style = SiteText.summary, color = SiteTheme.colors.ink)
                                            if (!source.section.isNullOrBlank()) Text(source.section, style = SiteText.meta, color = SiteTheme.colors.muted)
                                        }
                                    }
                                }
                            }
                            if (index == state.messages.lastIndex && state.error != null) Text(state.error.orEmpty(), style = SiteText.summary, color = MaterialTheme.colorScheme.error)
                            var copied by remember(message.id) { mutableStateOf(false) }
                            LaunchedEffect(copied) { if (copied) { delay(1600); copied = false } }
                            Row(horizontalArrangement = Arrangement.spacedBy(SiteSpace.compact)) {
                                if (message.text.isNotBlank()) IconButton(onClick = {
                                    copied = true
                                    scope.launch { clipboard.setClipEntry(ClipEntry(ClipData.newPlainText("answer", message.text))) }
                                }, modifier = Modifier.size(SiteSpace.touch)) {
                                    Icon(if (copied) SiteIcons.Check else SiteIcons.ContentCopy, if (copied) "已复制" else "复制回答", tint = SiteTheme.colors.muted, modifier = Modifier.size(18.dp))
                                }
                                if (index == state.messages.lastIndex && !state.streaming) IconButton(onClick = { followLatest = true; controller.retryLast() }, modifier = Modifier.size(SiteSpace.touch)) {
                                    Icon(SiteIcons.Refresh, if (message.status == AskMessage.Status.ERROR) "重试回答" else "重新生成回答", tint = SiteTheme.colors.muted, modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }
                    item(key = "conversation-end") { Spacer(Modifier.height(SiteSpace.touch)) }
                }
                if (!followLatest && list.canScrollForward) FilledTonalIconButton(
                    onClick = { followLatest = true; scope.launch { list.animateScrollToItem(state.messages.size) } },
                    modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = SiteSpace.compact),
                ) { Icon(SiteIcons.ArrowDownward, "回到最新回复") }
            }
            Surface(modifier = Modifier.fillMaxWidth().padding(horizontal = SiteSpace.paragraph, vertical = SiteSpace.compact), shape = RoundedCornerShape(24.dp), color = SiteTheme.colors.line) {
                Column(Modifier.padding(SiteSpace.compact)) {
                    TextField(
                        value = input, onValueChange = { input = it },
                        placeholder = { Text("输入你的问题…", style = SiteText.body) }, textStyle = SiteText.body,
                        minLines = 1, maxLines = 6,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Default),
                        colors = TextFieldDefaults.colors(focusedContainerColor = androidx.compose.ui.graphics.Color.Transparent, unfocusedContainerColor = androidx.compose.ui.graphics.Color.Transparent,
                            focusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent, unfocusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent),
                        modifier = Modifier.fillMaxWidth().testTag("ask-input").focusRequester(focus).onPreviewKeyEvent {
                            if (readerVisible) false
                            else if (it.key == Key.Enter && (it.isCtrlPressed || it.isMetaPressed)) { if (it.type == KeyEventType.KeyUp) send(); true } else false
                        },
                    )
                    Row(Modifier.fillMaxWidth().padding(start = SiteSpace.compact), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.weight(1f)) {
                            TextButton(onClick = { scopeMenu = true }, enabled = !state.streaming && !readerVisible) {
                                Text(searchScope.label, style = SiteText.meta)
                                Icon(SiteIcons.ArrowDropDown, "选择资料范围", modifier = Modifier.size(18.dp))
                            }
                            DropdownMenu(expanded = scopeMenu, onDismissRequest = { scopeMenu = false }) {
                                AskScope.entries.forEach { entry -> DropdownMenuItem(text = { Text(entry.label) }, onClick = { searchScope = entry; scopeMenu = false }) }
                            }
                        }
                        if (input.trim().length > 1000 || (input.isNotEmpty() && input.trim().length < 2)) Text(
                            if (input.trim().length > 1000) "最多 1000 字" else "至少 2 个字", style = SiteText.meta, color = MaterialTheme.colorScheme.error,
                        )
                        FilledIconButton(onClick = { if (state.streaming) controller.cancel() else send() }, enabled = !readerVisible && (state.streaming || validInput), shape = CircleShape, modifier = Modifier.size(SiteSpace.touch)) {
                            Icon(if (state.streaming) SiteIcons.Stop else SiteIcons.ArrowUpward, if (state.streaming) "停止生成" else "发送")
                        }
                    }
                }
            }
        }
        // 打开或滑出进行中才组合阅读器层；滑出结束（进度与透明度归零）即拆除。
        // Box 整层消费指针：阅读器自有子项（返回、选择正文）先命中，空窗位（如页
        // 首空白页眉）不再穿透到下层会话的按钮与输入区。
        if (readerSource != null && readerInFlight) {
            Box(Modifier.fillMaxSize().pointerInput(Unit) { detectTapGestures { } }.graphicsLayer {
                alpha = readerAlpha
                translationY = size.height * (1f - readerSlide)
            }) {
                SourceReader(readerSource, sourceIndex + 1) { sourceMessageId = null }
            }
        }
    }
    if (confirmReset) AlertDialog(onDismissRequest = { confirmReset = false }, title = { Text("开始新对话？") }, text = { Text("当前对话和输入草稿将清空。") },
        confirmButton = { TextButton(onClick = { controller.newConversation(); input = ""; followLatest = true; confirmReset = false }) { Text("新对话") } },
        dismissButton = { TextButton(onClick = { confirmReset = false }) { Text("取消") } })
}


@Composable
private fun SourceReader(source: AskSource, number: Int, onBack: () -> Unit) {
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
