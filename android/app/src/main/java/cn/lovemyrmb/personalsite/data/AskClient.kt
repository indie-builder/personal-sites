package cn.lovemyrmb.personalsite.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.io.InterruptedIOException

/** /api/ask 的 SSE 事件（lib/ask-types.ts 契约的 App 侧投影）。 */
sealed interface AskEvent {
    data class Sources(val items: List<AskSource>) : AskEvent
    data class Delta(val text: String) : AskEvent
    data object Done : AskEvent
    data class Error(val message: String) : AskEvent
}

enum class AskScope(val apiValue: String, val label: String) {
    ALL("all", "全部资料"), PROFILE("profile", "个人资料"), AI_NEWS("ai-news", "每日动态"),
    DAILY("daily", "每日关注"), OPEN_SOURCE("open-source", "开源内容"),
}

@kotlinx.serialization.Serializable
data class AskSource(
    val id: String = "",
    val sourceId: String = "",
    val content: String = "",
    val scope: String = "",
    val publishedAt: String? = null,
    val title: String = "",
    val sourceUrl: String = "",
    val section: String? = null,
)

/**
 * 问一问流式客户端：POST /api/ask（SSE），逐行解析 event/data 帧。
 * 非 2xx 优先采用服务端 error 字段文案（route 契约），网络失败回退固定中文提示，
 * 全部以 AskEvent.Error 返回由 UI 呈现。
 */
class AskClient(
    private val client: OkHttpClient,
    private val json: Json,
    private val baseUrl: String = SITE_BASE_URL,
) {
    fun ask(
        question: String,
        conversationId: String,
        visitorId: String,
        scope: AskScope = AskScope.ALL,
        onEvent: (AskEvent) -> Unit,
    ): Call {
        val payload = buildJsonObject {
            put("conversationId", conversationId)
            put("visitorId", visitorId)
            put("question", question)
            put("scope", scope.apiValue)
        }
        val body = payload.toString()
            .toRequestBody("application/json; charset=utf-8".toMediaType())

        val request = Request.Builder()
            .url(baseUrl.trimEnd('/') + "/api/ask")
            .header("Accept", "text/event-stream")
            .post(body)
            .build()

        val call = client.newCall(request)
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (call.isCanceled()) return
                onEvent(
                    AskEvent.Error(
                        if (e is InterruptedIOException) "回答超时了，请稍后再试。" else "网络不可用，请检查连接后重试。",
                    ),
                )
            }

            override fun onResponse(call: Call, response: Response) {
                response.use { resp ->
                    if (!resp.isSuccessful) {
                        onEvent(AskEvent.Error(errorMessage(resp)))
                        return
                    }
                    val source = resp.body?.source() ?: run {
                        onEvent(AskEvent.Error("暂时无法回答，请稍后再试。"))
                        return
                    }
                    var currentEvent = ""
                    val data = StringBuilder()
                    var terminal = false
                    fun dispatch() {
                        if (data.isEmpty()) return
                        val event = parseFrame(currentEvent, data.toString())
                        if (event != null) onEvent(event)
                        terminal = event is AskEvent.Done || event is AskEvent.Error
                        currentEvent = ""
                        data.setLength(0)
                    }
                    try {
                        while (!terminal && !call.isCanceled()) {
                            val line = source.readUtf8Line() ?: break
                            when {
                                line.isEmpty() -> dispatch()
                                line.startsWith("event:") -> currentEvent = line.removePrefix("event:").trim()
                                line.startsWith("data:") -> {
                                    if (data.isNotEmpty()) data.append('\n')
                                    data.append(line.removePrefix("data:").trimStart())
                                }
                            }
                        }
                        if (!terminal && !call.isCanceled()) {
                            dispatch()
                            if (!terminal) onEvent(AskEvent.Error("连接提前结束了，请重试。"))
                        }
                    } catch (_: IOException) {
                        if (!call.isCanceled()) onEvent(AskEvent.Error("连接中断了，请重试。"))
                    }
                }
            }
        })
        return call
    }

    /** data 帧按 JSON 形状分发：delta→文本增量、sources→来源、message→错误、空对象→结束。 */
    internal fun parseFrame(event: String, data: String): AskEvent? {
        if (data.isEmpty() || data == "{}") return if (event == "done") AskEvent.Done else null
        val obj = runCatching {
            json.decodeFromString(JsonObject.serializer(), data)
        }.getOrNull() ?: return AskEvent.Error("回答数据格式异常，请重试。")
        return runCatching { when {
            obj.containsKey("delta") -> AskEvent.Delta(obj["delta"]!!.jsonPrimitive.content)
            obj.containsKey("sources") -> AskEvent.Sources(decodeSources(obj["sources"]!!.jsonArray))
            obj.containsKey("message") -> AskEvent.Error(obj["message"]!!.jsonPrimitive.content)
            event == "done" -> AskEvent.Done
            else -> null
        } }.getOrElse { AskEvent.Error("引用或回答数据格式异常，请重试。") }
    }

    // 保留来源顺序；不能静默丢弃异常项，否则回答中的编号会指向错误资料。
    private fun decodeSources(array: JsonArray): List<AskSource> =
        array.map { element -> json.decodeFromJsonElement(AskSource.serializer(), element) }

    /** 非 2xx：服务端统一返回 {"error": "..."}；缺失、为空、非字符串或非 JSON 时回退固定文案。 */
    private fun errorMessage(resp: Response): String {
        val fallback = if (resp.code == 429) "提问过于频繁，请稍后再试。" else "暂时无法回答，请稍后再试。"
        val body = runCatching { resp.body?.string() }.getOrNull() ?: return fallback
        val message = body.takeIf { it.isNotBlank() }?.let { text ->
            runCatching {
                (json.decodeFromString(JsonObject.serializer(), text)["error"] as? JsonPrimitive)
                    ?.takeIf { it.isString }?.content
            }.getOrNull()
        }
        return message?.takeIf { it.isNotBlank() } ?: fallback
    }
}
