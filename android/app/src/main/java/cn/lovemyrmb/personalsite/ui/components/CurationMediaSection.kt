package cn.lovemyrmb.personalsite.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import cn.lovemyrmb.personalsite.data.CurationMedia
import cn.lovemyrmb.personalsite.data.CurationSource
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme

/** 策展媒体的展示：视频逐个播放卡，图片 1 张整宽、多张三列方格。 */
@Composable
fun CurationMediaSection(media: List<CurationMedia>, source: CurationSource) {
    val videos = media.filter { it.videoUrl != null }
    val photos = media.filter { it.videoUrl == null }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        videos.forEach { video -> VideoCard(media = video, source = source) }
        when (photos.size) {
            0 -> Unit
            1 -> {
                val photo = photos.first()
                val aspect = photo.width?.takeIf { it > 0 && (photo.height ?: 0) > 0 }
                    ?.let { it.toFloat() / photo.height!!.toFloat() } ?: 4f / 3f
                SiteAsyncImage(
                    model = photo.url,
                    contentDescription = "图片",
                    contentScale = ContentScale.FillWidth,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(aspect)
                        .clip(RoundedCornerShape(8.dp))
                        .background(SiteTheme.colors.line),
                )
            }

            else -> photos.chunked(3).forEach { rowPhotos ->
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    rowPhotos.forEach { photo ->
                        SiteAsyncImage(
                            model = photo.url,
                            contentDescription = "图片",
                            modifier = Modifier
                                .weight(1f)
                                .aspectRatio(1f)
                                .clip(RoundedCornerShape(6.dp))
                                .background(SiteTheme.colors.line),
                        )
                    }
                    repeat(3 - rowPhotos.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    }
}
