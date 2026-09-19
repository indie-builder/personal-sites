package cn.lovemyrmb.personalsite

import android.content.Context
import cn.lovemyrmb.personalsite.data.AskClient
import cn.lovemyrmb.personalsite.data.AskController
import cn.lovemyrmb.personalsite.data.EntryHolder
import cn.lovemyrmb.personalsite.data.SITE_BASE_URL
import cn.lovemyrmb.personalsite.data.SiteApi
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.Retrofit
import java.security.SecureRandom
import java.util.Base64
import java.util.concurrent.TimeUnit

/**
 * 手写轻量 DI：一个容器持有 JSON/HTTP/Retrofit 与访客身份。
 * 站点公共 GET API 无需鉴权；ask 用独立长超时客户端。
 */
class AppContainer(context: Context) {
    val appContext: Context = context.applicationContext

    val json: Json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    private val feedClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val askOkClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(300, TimeUnit.SECONDS)
        .build()

    val api: SiteApi = Retrofit.Builder()
        .baseUrl(SITE_BASE_URL)
        .client(feedClient)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(SiteApi::class.java)

    val askClient: AskClient = AskClient(
        askOkClient, json,
        if (BuildConfig.DEBUG && BuildConfig.LOCAL_ASK_PORT > 0) "http://127.0.0.1:${BuildConfig.LOCAL_ASK_PORT}/" else SITE_BASE_URL,
    )

    /** 问一问的匿名访客 id：客户端生成一次并持久化（[A-Za-z0-9_-]{16,128}）。 */
    val visitorId: String by lazy {
        val prefs = appContext.getSharedPreferences("site_prefs", Context.MODE_PRIVATE)
        prefs.getString(KEY_VISITOR_ID, null) ?: generateVisitorId().also {
            prefs.edit().putString(KEY_VISITOR_ID, it).apply()
        }
    }

    val entryHolder = EntryHolder()

    /**
     * 问一问会话：按 docs/ask-experience.md 保存在当前 App 进程中。
     * Activity 重建（深浅色、语言、密度变更）不丢对话；进程死亡不承诺恢复。
     */
    val askController: AskController by lazy { AskController(askClient, visitorId) }

    private fun generateVisitorId(): String {
        val bytes = ByteArray(18)
        SecureRandom().nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    private companion object {
        const val KEY_VISITOR_ID = "visitor_id"
    }
}
