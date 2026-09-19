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
    val status: Status = Status.COMPLETE,
    val scope: AskScope = AskScope.ALL,
) {
    enum class Role { QUESTION, ANSWER }
    enum class Status { STREAMING, COMPLETE, STOPPED, ERROR }
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
    private var generation = 0L

    fun send(question: String, scope: AskScope = AskScope.ALL) {
        val trimmed = question.trim()
        val current = _state.value
        if (trimmed.length !in 2..1000 || current.streaming) return
        val requestGeneration = ++generation

        val answerId = nextMessageId()
        _state.value = AskUiState(
            messages = current.messages +
                AskMessage(nextMessageId(), AskMessage.Role.QUESTION, trimmed, scope = scope) +
                AskMessage(answerId, AskMessage.Role.ANSWER, status = AskMessage.Status.STREAMING),
            streaming = true,
            error = null,
        )

        var appended = ""
        var sources: List<AskSource> = emptyList()
        val call = askClient.ask(
            question = trimmed,
            conversationId = conversationId,
            visitorId = visitorId,
            scope = scope,
        ) { event ->
            mainHandler.post {
                if (requestGeneration != generation) return@post
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
                        generation++
                        activeCall.set(null)
                        finishAnswer(AskMessage.Status.ERROR, event.message)
                    }
                    AskEvent.Done -> {
                        generation++
                        activeCall.set(null)
                        val answer = appended.ifBlank { "（这次没有可回答的内容，换个问法试试。）" }
                        patchAnswer(answerId, answer, sources)
                        finishAnswer(AskMessage.Status.COMPLETE)
                    }
                }
            }
        }
        activeCall.set(call)
    }

    fun cancel() {
        generation++
        activeCall.getAndSet(null)?.cancel()
        if (_state.value.streaming) {
            finishAnswer(AskMessage.Status.STOPPED)
        }
    }

    fun newConversation() {
        cancel()
        conversationId = newConversationId()
        _state.value = AskUiState()
    }

    fun retryLast() {
        if (_state.value.streaming) return
        val messages = _state.value.messages
        if (messages.size < 2 || messages.last().role != AskMessage.Role.ANSWER) return
        val question = messages[messages.lastIndex - 1]
        if (question.role != AskMessage.Role.QUESTION) return
        _state.value = AskUiState(messages = messages.dropLast(2))
        send(question.text, question.scope)
    }

    private fun finishAnswer(status: AskMessage.Status, error: String? = null) {
        val current = _state.value
        _state.value = current.copy(streaming = false, error = error, messages = current.messages.map {
            if (it.status == AskMessage.Status.STREAMING) it.copy(status = status) else it
        })
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
