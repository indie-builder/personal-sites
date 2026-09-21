package cn.lovemyrmb.personalsite.data

import android.content.Context
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.preload.DefaultPreloadManager
import androidx.media3.exoplayer.source.preload.TargetPreloadStatusControl
import java.io.File

/**
 * 视频预加载：卡片可见时用 DefaultPreloadManager 预取片头数秒到磁盘缓存，
 * 点击播放时从同一 Builder 构建共享缓存与数据源的 ExoPlayer，实现点开即播。
 * 单进程应用内单实例（AppContainer 持有）；SimpleCache 不允许多实例打开同一目录。
 */
@OptIn(UnstableApi::class)
class VideoPreloader(context: Context) {

    private val cache = SimpleCache(
        File(context.applicationContext.cacheDir, CACHE_DIR),
        LeastRecentlyUsedCacheEvictor(PRELOAD_CACHE_BYTES),
        StandaloneDatabaseProvider(context.applicationContext),
    )

    private val builder = DefaultPreloadManager.Builder(
        context.applicationContext,
        TargetPreloadStatusControl<Int, DefaultPreloadManager.PreloadStatus> {
            // specifiedRangeCached：经 PreCacheHelper 写入磁盘缓存，卡片销毁后仍可复用；
            // specifiedRangeLoaded 只进内存，随卡片销毁丢弃。
            DefaultPreloadManager.PreloadStatus.specifiedRangeCached(PRELOAD_DURATION_MS)
        },
    ).setCache(cache)

    private val preloadManager = builder.build()

    /** 预取片头到缓存；同 URL 重复调用会先移除旧任务再重试。 */
    fun preload(url: String) {
        val item = MediaItem.fromUri(url)
        preloadManager.remove(item)
        preloadManager.add(item, RANKING)
        // 单个 add() 只入队，必须 invalidate() 才会真正启动预加载调度。
        preloadManager.invalidate()
    }

    /** 撤销预取任务（已写入缓存的分片保留，由 LRU 淘汰）。 */
    fun cancel(url: String) {
        preloadManager.remove(MediaItem.fromUri(url))
        preloadManager.invalidate()
    }

    /** 构建与预加载共享数据源和缓存的播放器，命中缓存即可即点即播。 */
    fun buildPlayer(): ExoPlayer = builder.buildExoPlayer()

    private companion object {
        const val CACHE_DIR = "video_preload"
        const val PRELOAD_DURATION_MS = 5_000L
        const val PRELOAD_CACHE_BYTES = 64L * 1024 * 1024
        const val RANKING = 0
    }
}
