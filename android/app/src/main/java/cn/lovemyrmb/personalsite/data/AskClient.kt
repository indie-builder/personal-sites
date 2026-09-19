package cn.lovemyrmb.personalsite.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
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

@kotlinx.serialization.Serializable
data class AskSource(
    val title: String = "",
    val sourceUrl: String = "",
    val section: String = "",
)

/**
 * 问一问流式客户端：POST /api/ask（SSE），逐行解析 event/data 帧。
 * 限流（429）与网络失败都以 AskEvent.Error 返回，由 UI 呈现中文提示。
 */
class AskClient(
    private val client: OkHttpClient,
    private val json: Json,
) {
    fun ask(
        question: String,
        conversationId: String,
        visitorId: String,
        onEvent: (AskEvent) -> Unit,
    ): Call {
        val payload = buildJsonObject {
            put("conversationId", conversationId)
            put("visitorId", visitorId)
            put("question", question)
            put("scope", "all")
        }
        val body = payload.toString()
            .toRequestBody("application/json; charset=utf-8".toMediaType())

        val request = Request.Builder()
            .url(SITE_BASE_URL + "api/ask")
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
                        onEvent(
                            AskEvent.Error(
                                if (resp.code == 429) "提问太频繁了，请十分钟后再试。" else "暂时无法回答，请稍后再试。",
                            ),
                        )
                        return
                    }
                    val source = resp.body?.source() ?: run {
                        onEvent(AskEvent.Error("暂时无法回答，请稍后再试。"))
                        return
                    }
                    var currentEvent = ""
                    try {
                        while (true) {
                            val line = source.readUtf8Line() ?: break
                            when {
                                line.startsWith("event:") -> currentEvent = line.removePrefix("event:").trim()
                                line.startsWith("data:") -> {
                                    val data = line.removePrefix("data:").trim()
                                    parseFrame(currentEvent, data)?.let(onEvent)
                                    currentEvent = ""
                                }
                            }
                        }
                        onEvent(AskEvent.Done)
                    } catch (_: IOException) {
                        if (!call.isCanceled()) onEvent(AskEvent.Error("连接中断了，请重试。"))
                    }
                }
            }
        })
        return call
    }

    /** data 帧按 JSON 形状分发：delta→文本增量、sources→来源、message→错误、空对象→结束。 */
    private fun parseFrame(event: String, data: String): AskEvent? {
        if (data.isEmpty() || data == "{}") return if (event == "done") AskEvent.Done else null
        val obj = runCatching {
            json.decodeFromString(JsonObject.serializer(), data)
        }.getOrNull() ?: return null
        return when {
            obj.containsKey("delta") -> AskEvent.Delta(obj["delta"]!!.jsonPrimitive.content)
            obj.containsKey("sources") -> AskEvent.Sources(decodeSources(obj["sources"]!!.jsonArray))
            obj.containsKey("message") -> AskEvent.Error(obj["message"]!!.jsonPrimitive.content)
            else -> null
        }
    }

    // 单个来源缺字段不影响整体。
    private fun decodeSources(array: JsonArray): List<AskSource> =
        array.mapNotNull { element ->
            runCatching { json.decodeFromJsonElement(AskSource.serializer(), element) }.getOrNull()
        }
}
