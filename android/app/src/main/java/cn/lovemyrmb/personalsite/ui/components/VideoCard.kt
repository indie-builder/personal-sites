package cn.lovemyrmb.personalsite.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil3.compose.AsyncImage
import cn.lovemyrmb.personalsite.ui.icons.SiteIcons
import cn.lovemyrmb.personalsite.data.CurationMedia
import cn.lovemyrmb.personalsite.data.CurationSource
import cn.lovemyrmb.personalsite.data.MediaUrls
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import cn.lovemyrmb.personalsite.ui.theme.SiteText

/**
 * 策展媒体的视频卡片：默认展示封面 + 播放圆钮，点击后换 ExoPlayer 原生播放。
 * X 平台视频自动经 /api/x-media 代理（MediaUrls.video）。
 */
@Composable
fun VideoCard(
    media: CurationMedia,
    source: CurationSource,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var playing by remember(media.url) { mutableStateOf(false) }
    val aspect = media.width?.takeIf { it > 0 && media.height != null && media.height > 0 }
        ?.let { it.toFloat() / media.height!!.toFloat() } ?: 16f / 9f

    Box(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(aspect)
            .clip(RoundedCornerShape(8))
            .background(SiteTheme.colors.line),
    ) {
        if (playing) {
            val player = remember(media.url) {
                ExoPlayer.Builder(context).build().apply {
                    setMediaItem(MediaItem.fromUri(MediaUrls.video(source.platform, media.videoUrl ?: media.url)))
                    prepare()
                    playWhenReady = true
                }
            }
            DisposableEffect(media.url) {
                onDispose { player.release() }
            }
            AndroidView(
                factory = { PlayerView(it).apply { useController = true } },
                update = { it.player = player },
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            AsyncImage(
                model = media.posterUrl,
                contentDescription = "视频封面",
                contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .clickable { playing = true },
            )
            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(52.dp)
                    .clip(CircleShape)
                    .background(SiteTheme.colors.glass)
                    .clickable { playing = true },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = SiteIcons.PlayArrow,
                    contentDescription = "播放视频",
                    tint = SiteTheme.colors.ink,
                    modifier = Modifier.size(32.dp),
                )
            }
        }
    }
}
