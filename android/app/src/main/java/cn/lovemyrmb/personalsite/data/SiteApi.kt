package cn.lovemyrmb.personalsite.data

import java.net.URLEncoder
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

const val SITE_BASE_URL = "https://default-coder.lovemyrmb.cn/"

/** 站点公共 GET API。全部公开读，无需鉴权；分页契约 { hasMore, items }。 */
interface SiteApi {
    @GET("api/ai-news")
    suspend fun aiNews(
        @Query("offset") offset: Long,
        @Query("limit") limit: Int,
    ): FeedPage<AiNewsListItem>

    @GET("api/ai-news/{id}")
    suspend fun aiNewsDetail(@Path("id") id: String): AiNewsDetailResponse

    @GET("api/curation")
    suspend fun curation(
        @Query("offset") offset: Long,
        @Query("limit") limit: Int,
    ): FeedPage<CurationItem>

    @GET("api/design")
    suspend fun design(
        @Query("offset") offset: Long,
        @Query("limit") limit: Int,
    ): FeedPage<CurationItem>

    @GET("api/douyin")
    suspend fun douyin(
        @Query("offset") offset: Long,
        @Query("limit") limit: Int,
    ): FeedPage<CurationItem>

    @GET("api/open-source")
    suspend fun openSource(
        @Query("offset") offset: Long,
        @Query("limit") limit: Int,
    ): FeedPage<OpenSourceListEntry>
}

/** 站内媒体 URL 语义：X 平台视频必须走 /api/x-media 代理，其余直连。 */
object MediaUrls {
    fun video(platform: String, videoUrl: String): String {
        if (platform != "x") return videoUrl
        val encoded = URLEncoder.encode(videoUrl, "UTF-8")
        return "${SITE_BASE_URL}api/x-media?url=$encoded"
    }

    fun sitePage(path: String): String = SITE_BASE_URL.removeSuffix("/") + path
}
