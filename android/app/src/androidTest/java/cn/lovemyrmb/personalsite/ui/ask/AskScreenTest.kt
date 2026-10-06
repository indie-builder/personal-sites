package cn.lovemyrmb.personalsite.ui.ask

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import cn.lovemyrmb.personalsite.data.*
import cn.lovemyrmb.personalsite.ui.theme.PersonalSiteTheme
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import okhttp3.MediaType.Companion.toMediaType
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.Assert.*
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.text.TextLayoutResult

@RunWith(AndroidJUnit4::class)
class AskScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test fun markdownRendersStructureAndKeepsInlineCitationClickable() {
        var selected = -1
        compose.setContent { PersonalSiteTheme {
            AnswerMarkdown("# 标题\n\n**粗体**与引用【1】。\n\n- 条目一\n- 条目二\n\n```kotlin\nprintln(1)\n```", 1) { selected = it }
        } }
        compose.onNodeWithText("标题").assertExists()
        compose.onNodeWithText("粗体与引用【1】。").assertExists()
        compose.onNodeWithText("**粗体**", substring = true).assertDoesNotExist()
        compose.onNodeWithText("条目一").assertExists()
        compose.onNodeWithText("println(1)").assertExists()
        val layouts = mutableListOf<TextLayoutResult>()
        compose.onNodeWithText("粗体与引用【1】。").performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
        val position = layouts.single().getBoundingBox(6).center
        compose.onNodeWithText("粗体与引用【1】。").performTouchInput { click(position) }
        compose.runOnIdle { assertEquals(0, selected) }
    }

    @Test fun stopAndNewConversationRejectLateResponse() {
        val release = CountDownLatch(1)
        val entered = CountDownLatch(1)
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            entered.countDown()
            release.await(5, TimeUnit.SECONDS)
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body("event: text\ndata: {\"delta\":\"不应显示的旧回复\"}\n\nevent: done\ndata: {}\n\n".toResponseBody("text/event-stream".toMediaType())).build()
        }.build()
        val controller = AskController(AskClient(client, Json), "1234567890123456")
        compose.setContent { PersonalSiteTheme { AskScreen(controller, onDismiss = {}) } }
        compose.onNodeWithTag("ask-input").performTextInput("长".repeat(1001))
        compose.onNodeWithContentDescription("发送").assertIsNotEnabled()
        compose.onNodeWithTag("ask-input").performTextReplacement("测试停止")
        compose.onNodeWithContentDescription("发送").performClick()
        assertTrue(entered.await(5, TimeUnit.SECONDS))
        compose.onNodeWithContentDescription("停止生成").performClick()
        compose.runOnIdle {
            assertFalse(controller.state.value.streaming)
            assertEquals(AskMessage.Status.STOPPED, controller.state.value.messages.last().status)
            controller.newConversation()
        }
        release.countDown()
        client.dispatcher.executorService.shutdown()
        assertTrue(client.dispatcher.executorService.awaitTermination(5, TimeUnit.SECONDS))
        compose.runOnIdle { assertTrue(controller.state.value.messages.isEmpty()) }
        client.connectionPool.evictAll()
    }

    /** 一个源引用的 SSE 应答固定器：返回 (controller, client)，用毕关闭 client。 */
    private fun answeringController(): Pair<AskController, OkHttpClient> {
        val sse = """
            event: sources
            data: {"sources":[{"id":"fixture:1","sourceId":"1","title":"引用测试资料","content":"这是本次回答的具体依据，仅用于自动化测试。","scope":"daily","section":null,"sourceUrl":"https://example.invalid/never-open"}]}

            event: text
            data: {"delta":"回答来自站内资料【1】。"}

            event: done
            data: {}

        """.trimIndent()
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body(sse.toResponseBody("text/event-stream".toMediaType())).build()
        }.build()
        return AskController(AskClient(client, Json { ignoreUnknownKeys = true }), "1234567890123456") to client
    }

    private fun shutdown(client: OkHttpClient) {
        client.dispatcher.executorService.shutdown()
        client.connectionPool.evictAll()
    }

    @Test fun sourceOpensNativeContentAndReturnsToDraft() {
        val (controller, client) = answeringController()
        compose.setContent { PersonalSiteTheme { AskScreen(controller, onDismiss = {}) } }
        compose.onNodeWithTag("ask-input").performTextInput("问")
        compose.onNodeWithContentDescription("发送").assertIsNotEnabled()
        compose.onNodeWithTag("ask-input").performTextReplacement("测试问题")
        compose.onNodeWithContentDescription("发送").performClick()
        compose.waitUntil(5000) { !controller.state.value.streaming && controller.state.value.messages.size == 2 }
        compose.onNodeWithText("引用测试资料").assertExists()
        compose.onNodeWithContentDescription("复制回答").performClick()
        compose.onNodeWithContentDescription("已复制").assertExists()
        compose.onNodeWithText("复制").assertDoesNotExist()
        compose.onNodeWithContentDescription("重新生成回答").assertExists()
        compose.onNodeWithTag("ask-input").performTextInput("下一问草稿")
        compose.onNodeWithText("引用测试资料").performClick()
        compose.onNodeWithText("引用 1").assertIsDisplayed()
        compose.onNodeWithText("这是本次回答的具体依据，仅用于自动化测试。").assertIsDisplayed()
        compose.onNodeWithContentDescription("返回对话").performClick()
        compose.onNodeWithTag("ask-input").assertTextContains("下一问草稿")
        compose.onNodeWithText("引用测试资料").assertExists()
        compose.runOnIdle { controller.cancel() }
        shutdown(client)
    }

    /** 阅读器在场时下层会话必须惰性（指针、语义、焦点、快捷发送），关闭后全部恢复。 */
    @Test fun readerShieldsConversationUntilClosed() {
        val (controller, client) = answeringController()
        var dismissed = false
        compose.setContent { PersonalSiteTheme { AskScreen(controller, onDismiss = { dismissed = true }) } }
        compose.onNodeWithText("介绍一下陈远").performClick()
        compose.onNodeWithContentDescription("发送").performClick()
        compose.waitUntil(5000) { !controller.state.value.streaming && controller.state.value.messages.size == 2 }
        compose.onNodeWithTag("ask-input").performTextInput("下一问草稿")
        val coveredNewChat = compose.onNodeWithText("新对话").fetchSemanticsNode().positionInRoot

        compose.onNodeWithText("引用测试资料").performClick()
        compose.onNodeWithText("引用 1").assertIsDisplayed()
        compose.onNodeWithText("新对话").assertDoesNotExist()
        compose.onNodeWithTag("ask-input").assertDoesNotExist()
        compose.onRoot().performTouchInput { click(coveredNewChat) }
        compose.onNodeWithText("开始新对话？").assertDoesNotExist()
        compose.onNodeWithText("引用 1").assertIsDisplayed()
        // 硬件键路径。按键一律真实注入：onRoot().performKeyInput 最终走
        // View.dispatchKeyEvent（对已随会话语义移除的 ask-input 注入会在注入前抛
        // 错，故必须从 onRoot 注入且不得捕获异常）；先经 sendKeyDownUpSync 注入
        // 一次真实 DPAD（走 ViewRootImpl，非触摸导航键使窗口离开触摸模式，onRoot
        // 注入不经过 ViewRootImpl、无此效果），使后续按键能参与焦点遍历。此后
        // DPAD/Tab/Enter 连击不得激活会话侧任何控件：焦点组 onEnter 拒入（canFocus
        // 级联止步于 LazyColumn 中间焦点目标）让遍历在会话子树前一无所获（焦点无
        // 法落进被封锁的子树，会话控件已被语义移除、其焦点态不可见，故以行为断言
        // 代替焦点位置断言）——不得弹新对话确认、不得触发 onDismiss、不得追加或
        // 改动草稿、不得追加消息，阅读器保持在场。
        compose.onRoot().performKeyInput { pressKey(Key.Enter) }
        compose.onNodeWithText("开始新对话？").assertDoesNotExist()
        compose.onNodeWithText("引用 1").assertIsDisplayed()
        compose.runOnIdle { assertEquals(2, controller.state.value.messages.size) }

        androidx.test.platform.app.InstrumentationRegistry.getInstrumentation()
            .sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_DPAD_DOWN)
        compose.onRoot().performKeyInput {
            pressKey(Key.Tab); pressKey(Key.Tab); pressKey(Key.Enter); pressKey(Key.Enter)
        }
        compose.onNodeWithText("开始新对话？").assertDoesNotExist()
        // 焦点组拒入后，DPAD 默认焦点与第二次 Tab 都落在阅读器自己的返回键上，随后
        // 的 Enter 激活它是合法的键盘可达路径：阅读器就此关闭，但会话侧仍不得有
        // 任何激活（无确认弹层、消息数不变、未退出）。
        compose.onNodeWithText("引用 1").assertDoesNotExist()
        compose.runOnIdle { assertEquals(2, controller.state.value.messages.size) }
        compose.runOnIdle { assertEquals(false, dismissed) }

        compose.onNodeWithTag("ask-input").assertTextEquals("下一问草稿")
        compose.onNodeWithText("新对话").assertExists()
        compose.onNodeWithTag("ask-input").assertIsNotFocused()
        compose.onNodeWithTag("ask-input").performClick()
        compose.onNodeWithTag("ask-input").performKeyInput { withKeysDown(listOf(Key.CtrlLeft)) { pressKey(Key.Enter) } }
        compose.waitUntil(5000) { controller.state.value.messages.size == 4 }
        compose.runOnIdle { controller.cancel() }
        shutdown(client)
    }

    /** 五轮焦点边界：反向遍历（Shift+Tab）不得从阅读器返回键漏进会话子树，焦点组
     *  拒入后 Enter 应落空（重新生成不触发、阅读器在场、回答 id 不变），关闭后编
     *  辑器可达。突变验证：去掉 focusGroup/onEnter 边界（只留 canFocus）后，Shift+Tab
     *  落到会话末尾的重新生成，Enter 以回答 id 变化（换新的问答对）失败。 */
    @Test fun readerBackwardKeyTraversalDoesNotActivateConversationControls() {
        val (controller, client) = answeringController()
        compose.setContent { PersonalSiteTheme { AskScreen(controller, onDismiss = {}) } }
        compose.onNodeWithText("介绍一下陈远").performClick()
        compose.onNodeWithContentDescription("发送").performClick()
        compose.waitUntil(5000) { !controller.state.value.streaming && controller.state.value.messages.size == 2 }
        compose.onNodeWithText("引用测试资料").performClick()
        compose.onNodeWithText("引用 1").assertIsDisplayed()
        androidx.test.platform.app.InstrumentationRegistry.getInstrumentation()
            .sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_DPAD_DOWN)
        // 前向 Tab 有限步内必须落到阅读器返回键：修复后焦点组拒入一步直达；未修复
        // 时逐步穿过会话子树后也能到达，两条路径都以它为 Shift+Tab 起点。
        var backFocused = false
        for (i in 1..12) {
            compose.onRoot().performKeyInput { pressKey(Key.Tab) }
            if (compose.onAllNodesWithContentDescription("返回对话").fetchSemanticsNodes()
                    .any { SemanticsProperties.Focused in it.config && it.config[SemanticsProperties.Focused] }) {
                backFocused = true
                break
            }
        }
        assertTrue("Tab traversal must be able to focus the reader's back button", backFocused)
        var ids = listOf<Long>()
        compose.runOnIdle { ids = controller.state.value.messages.map { it.id } }
        compose.onRoot().performKeyInput {
            withKeysDown(listOf(Key.ShiftLeft)) { pressKey(Key.Tab) }
            pressKey(Key.Enter)
        }
        compose.runOnIdle {
            assertEquals("Shift+Tab then Enter must not regenerate the answer", ids, controller.state.value.messages.map { it.id })
        }
        compose.onNodeWithText("引用 1").assertIsDisplayed()
        compose.onNodeWithContentDescription("返回对话").performClick()
        compose.onNodeWithText("引用 1").assertDoesNotExist()
        compose.onNodeWithTag("ask-input").performClick().assertIsFocused()
        compose.runOnIdle { controller.cancel() }
        shutdown(client)
    }
}
