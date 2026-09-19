package cn.lovemyrmb.personalsite.data

import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import okhttp3.Call
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference

/** 问答界面的一条消息：question 是用户输入，answer 流式增长。 */
data class AskMessage(
    val id: Long,
    val role: Role,
    val text: String = "",
    val sources: List<AskSource> = emptyList(),
) {
    enum class Role { QUESTION, ANSWER }
}

data class AskUiState(
    val messages: List<AskMessage> = emptyList(),
    val streaming: Boolean = false,
    val error: String? = null,
)

/**
 * 问一问会话控制器：SSE 事件在 OkHttp 线程回调，统一切到主线程后
 * 归并到状态流；文本增量追加到末尾的 answer 消息上。
 */
class AskController(
    private val askClient: AskClient,
    private val visitorId: String,
) {
    private val _state = MutableStateFlow(AskUiState())
    val state: StateFlow<AskUiState> = _state

    private val mainHandler = Handler(Looper.getMainLooper())
    private val activeCall = AtomicReference<Call?>(null)
    private var conversationId: String = newConversationId()
    private var messageId = 0L

    fun send(question: String) {
        val trimmed = question.trim()
        val current = _state.value
        if (trimmed.isEmpty() || current.streaming) return

        val answerId = nextMessageId()
        _state.value = AskUiState(
            messages = current.messages +
                AskMessage(nextMessageId(), AskMessage.Role.QUESTION, trimmed) +
                AskMessage(answerId, AskMessage.Role.ANSWER),
            streaming = true,
            error = null,
        )

        var appended = ""
        var sources: List<AskSource> = emptyList()
        val call = askClient.ask(
            question = trimmed,
            conversationId = conversationId,
            visitorId = visitorId,
        ) { event ->
            mainHandler.post {
                when (event) {
                    is AskEvent.Delta -> {
                        appended += event.text
                        patchAnswer(answerId, appended, sources)
                    }
                    is AskEvent.Sources -> {
                        sources = event.items
                        patchAnswer(answerId, appended, sources)
                    }
                    is AskEvent.Error -> {
                        activeCall.set(null)
                        _state.value = _state.value.copy(streaming = false, error = event.message)
                    }
                    AskEvent.Done -> {
                        activeCall.set(null)
                        val answer = appended.ifBlank { "（这次没有可回答的内容，换个问法试试。）" }
                        patchAnswer(answerId, answer, sources)
                        _state.value = _state.value.copy(streaming = false)
                    }
                }
            }
        }
        activeCall.set(call)
    }

    fun cancel() {
        activeCall.getAndSet(null)?.cancel()
        if (_state.value.streaming) {
            _state.value = _state.value.copy(streaming = false)
        }
    }

    fun newConversation() {
        cancel()
        conversationId = newConversationId()
        _state.value = AskUiState()
    }

    private fun patchAnswer(answerId: Long, text: String, sources: List<AskSource>) {
        _state.value = _state.value.copy(
            messages = _state.value.messages.map { message ->
                if (message.id == answerId) message.copy(text = text, sources = sources) else message
            },
        )
    }

    private fun nextMessageId(): Long = ++messageId

    private fun newConversationId(): String = UUID.randomUUID().toString().replace("-", "").let {
        // 服务端要求 [A-Za-z0-9_-]{16,128}：取 uuid 十六进制串（32 位）即可。
        it
    }
}
