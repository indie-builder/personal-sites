package cn.lovemyrmb.personalsite.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import coil3.compose.AsyncImage
import coil3.compose.AsyncImagePainter
import coil3.request.ImageRequest
import kotlinx.coroutines.delay

/**
 * 带自动重试的网络图片：弱网/服务抖动导致的瞬态失败会按 1s、3s 退避重试两次，
 * 仍失败保持调用方的占位背景（切主题等重组不再自动重发）。静态资源请勿使用本组件。
 */
@Composable
fun SiteAsyncImage(
    model: Any?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
) {
    // 空白字符串同样视为无图（如 posterUrl 为空串），避免发起注定失败的重试。
    if (model == null || (model as? String)?.isBlank() == true) {
        Box(modifier)
        return
    }
    val context = LocalContext.current
    // retry 经 memoryCacheKeyExtra 计入请求身份触发重发；最多两次退避重试。
    var retry by remember(model) { mutableIntStateOf(0) }
    var failures by remember(model) { mutableIntStateOf(0) }
    LaunchedEffect(failures) {
        if (failures in 1..MAX_RETRIES) {
            delay(RETRY_BACKOFF_MILLIS[(failures - 1).coerceIn(RETRY_BACKOFF_MILLIS.indices)])
            retry++
        }
    }
    val request = remember(model, retry) {
        ImageRequest.Builder(context)
            .data(model)
            .memoryCacheKeyExtra("retry", retry.toString())
            .build()
    }
    AsyncImage(
        model = request,
        contentDescription = contentDescription,
        contentScale = contentScale,
        modifier = modifier,
        onState = { state ->
            if (state is AsyncImagePainter.State.Error) failures++
        },
    )
}

private const val MAX_RETRIES = 2
private val RETRY_BACKOFF_MILLIS = listOf(1_000L, 3_000L)
