package cn.lovemyrmb.personalsite.ui.components

import android.animation.ValueAnimator
import android.graphics.ImageDecoder
import android.graphics.drawable.AnimatedImageDrawable
import android.widget.ImageView
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.currentStateAsState
import cn.lovemyrmb.personalsite.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Web 开场原素材：人物序列、电池五格充电、800ms 上滑揭幕。 */
@Composable
fun OpeningScreen(onComplete: () -> Unit) {
    val context = LocalContext.current
    val lifecycle by LocalLifecycleOwner.current.lifecycle.currentStateAsState()
    var character by remember { mutableStateOf<AnimatedImageDrawable?>(null) }
    val time = remember { Animatable(0f) }
    val reveal = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        if (!ValueAnimator.areAnimatorsEnabled()) { onComplete(); return@LaunchedEffect }
        character = withContext(Dispatchers.IO) {
            runCatching { ImageDecoder.decodeDrawable(ImageDecoder.createSource(context.resources, R.raw.opening_character)) as AnimatedImageDrawable }.getOrNull()
        }
        if (character == null) onComplete()
    }
    LaunchedEffect(character, lifecycle) {
        val drawable = character ?: return@LaunchedEffect
        if (!lifecycle.isAtLeast(Lifecycle.State.RESUMED)) { drawable.stop(); return@LaunchedEffect }
        drawable.repeatCount = 0
        drawable.start()
        try {
            time.animateTo(5f, tween(((5f - time.value) * 1000).toInt(), easing = LinearEasing))
            reveal.animateTo(1f, tween(800, easing = CubicBezierEasing(0.76f, 0f, 0.24f, 1f)))
            onComplete()
        } finally { drawable.stop() }
    }
    DisposableEffect(character) { onDispose { character?.stop() } }
    Box(
        Modifier.fillMaxSize().graphicsLayer { translationY = -size.height * reveal.value }
            .background(Color.White).clickable(onClickLabel = "跳过开场", onClick = onComplete),
        contentAlignment = Alignment.Center,
    ) {
        Box(Modifier.size(180.dp, 176.dp)) {
            AndroidView(
                factory = { ImageView(it).apply { scaleType = ImageView.ScaleType.FIT_CENTER } },
                update = { if (it.drawable !== character) it.setImageDrawable(character) },
                modifier = Modifier.fillMaxSize(),
            )
            Canvas(Modifier.align(Alignment.TopCenter).padding(top = 3.dp).size(52.dp, 18.dp)) {
                val t = time.value
                val progress = (t / 4.7f).coerceIn(0f, 1f)
                val red = Color(0xFFEF4444); val yellow = Color(0xFFF2C94C); val green = Color(0xFF24CB71)
                val color = when {
                    progress < 0.18f -> red
                    progress < 0.52f -> lerp(red, yellow, (progress - 0.18f) / 0.34f)
                    else -> lerp(yellow, green, (progress - 0.52f) / 0.48f)
                }
                val bodyWidth = size.width - 3.dp.toPx()
                drawRoundRect(Color.White, size = Size(bodyWidth, size.height), cornerRadius = CornerRadius(5.dp.toPx()))
                drawRoundRect(Color(0xFF161616), size = Size(bodyWidth, size.height), cornerRadius = CornerRadius(5.dp.toPx()), style = Stroke(1.5.dp.toPx()))
                drawRect(Color(0xFF161616), Offset(bodyWidth, size.height * 0.3f), Size(3.dp.toPx(), size.height * 0.4f))
                val inset = 3.dp.toPx(); val gap = 2.dp.toPx(); val width = (bodyWidth - inset * 2 - gap * 4) / 5
                repeat(5) { index ->
                    val charge = ((t - (0.45f + index * 0.95f)) / 0.18f).coerceIn(0f, 1f)
                    val height = (size.height - inset * 2) * (0.55f + charge * 0.45f)
                    drawRoundRect(color.copy(alpha = charge), Offset(inset + index * (width + gap), (size.height - height) / 2), Size(width, height), CornerRadius(1.5.dp.toPx()))
                }
            }
        }
    }
}
