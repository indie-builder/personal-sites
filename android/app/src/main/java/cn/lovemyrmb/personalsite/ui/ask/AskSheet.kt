package cn.lovemyrmb.personalsite.ui.ask

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import cn.lovemyrmb.personalsite.data.AskController
import cn.lovemyrmb.personalsite.data.AskMessage
import cn.lovemyrmb.personalsite.data.MediaUrls
import cn.lovemyrmb.personalsite.ui.components.openExternally
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import cn.lovemyrmb.personalsite.ui.theme.SiteText

/**
 * 问一问：基于站内公开资料的流式问答（/api/ask SSE）。
 * 回答下方附来源条目，点击经 Custom Tabs 打开站内对应页。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AskSheet(
    controller: AskController,
    onDismiss: () -> Unit,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val state by controller.state.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()
    var input by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(state.messages.size, state.messages.lastOrNull()?.text) {
        if (state.messages.isNotEmpty()) listState.animateScrollToItem(state.messages.lastIndex)
    }

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = {
            controller.cancel()
            onDismiss()
        },
        sheetState = sheetState,
        containerColor = SiteTheme.colors.background,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .navigationBarsPadding(),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(horizontal = 24.dp),
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = "问一问", style = SiteText.title, color = SiteTheme.colors.ink)
                    Text(
                        text = "基于站内公开资料回答 · 像素助手",
                        style = SiteText.meta,
                        color = SiteTheme.colors.quiet,
                    )
                }
                Text(
                    text = "新对话",
                    style = SiteText.meta,
                    color = SiteTheme.colors.muted,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .clickable { controller.newConversation() }
                        .padding(6.dp),
                )
            }
            Spacer(Modifier.height(8.dp))

            LazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(380.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 24.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                if (state.messages.isEmpty()) {
                    item {
                        Text(
                            text = "问点什么吧：陈远是谁、在做什么、如何判断，都可以从这里开始。",
                            style = SiteText.summary,
                            color = SiteTheme.colors.quiet,
                        )
                    }
                }
                items(state.messages, key = { it.id }) { message ->
                    when (message.role) {
                        AskMessage.Role.QUESTION -> Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.End,
                        ) {
                            Text(
                                text = message.text,
                                style = SiteText.summary,
                                color = SiteTheme.colors.background,
                                modifier = Modifier
                                    .widthIn(max = 280.dp)
                                    .clip(RoundedCornerShape(14.dp, 14.dp, 4.dp, 14.dp))
                                    .background(SiteTheme.colors.ink)
                                    .padding(horizontal = 14.dp, vertical = 10.dp),
                            )
                        }

                        AskMessage.Role.ANSWER -> Column(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                text = message.text.ifEmpty { if (state.streaming) "…" else "" },
                                style = SiteText.body,
                                color = SiteTheme.colors.ink,
                            )
                            if (message.sources.isNotEmpty()) {
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    message.sources.take(4).forEach { source ->
                                        Text(
                                            text = "· ${source.title.ifEmpty { source.sourceUrl }}",
                                            style = SiteText.meta,
                                            color = SiteTheme.colors.muted,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            modifier = Modifier.clickable {
                                                if (source.sourceUrl.isNotBlank()) {
                                                    openExternally(context, MediaUrls.sitePage(source.sourceUrl))
                                                }
                                            },
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            state.error?.let { error ->
                Text(
                    text = error,
                    style = SiteText.meta,
                    color = SiteTheme.colors.muted,
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp),
                )
            }

            Row(
                verticalAlignment = Alignment.Bottom,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = input,
                    onValueChange = { input = it },
                    placeholder = { Text("问点什么…", style = SiteText.summary, color = SiteTheme.colors.quiet) },
                    textStyle = SiteText.summary,
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = SiteTheme.colors.ink,
                        unfocusedBorderColor = SiteTheme.colors.line,
                        cursorColor = SiteTheme.colors.ink,
                    ),
                    minLines = 1,
                    maxLines = 4,
                    modifier = Modifier.weight(1f),
                )
                Box(
                    modifier = Modifier
                        .padding(bottom = 6.dp)
                        .size(40.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (input.isNotBlank() && !state.streaming) SiteTheme.colors.ink else SiteTheme.colors.line)
                        .clickable(enabled = input.isNotBlank() && !state.streaming) {
                            controller.send(input)
                            input = ""
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Send,
                        contentDescription = "发送",
                        tint = SiteTheme.colors.background,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
        }
    }
}
