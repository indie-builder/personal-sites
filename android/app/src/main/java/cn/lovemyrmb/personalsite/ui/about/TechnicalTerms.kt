package cn.lovemyrmb.personalsite.ui.about

import android.animation.ValueAnimator
import android.graphics.Paint
import android.graphics.Typeface
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

// Web interactive-dot-field 的六条泳道，复用同一组公开技术词条。
private val terms = listOf(
    "retry.policy", "human.in.loop", "agent.runtime", "tool.call()",
    "rag.retrieval", "sse.stream", "planner.agent", "memory.store",
    "function.calling", "eval.loop", "context.engine", "ship.systems",
    "React.js", "Next.js", "TypeScript", "Node.js", "Python", "Postgres",
    "Docker", "Kubernetes", "Tailwind CSS", "Git/GitHub", "JavaScript",
    "Sass", "Express.js", "Redux", "Java", "Spring", "Spring Boot",
    "Spring Cloud", "MyBatis", "MySQL", "Redis", "RabbitMQ", "Elasticsearch",
    "Maven", "Nginx",
)
private val lanes = List(6) { lane -> terms.filterIndexed { index, _ -> index % 6 == lane } }
private val durations = listOf(63f, 69f, 60f, 81f, 72f, 66f)

@Composable
fun TechnicalTerms() {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val view = LocalView.current
    val fontScale = LocalDensity.current.fontScale.coerceAtLeast(1f)
    var visible by remember { mutableStateOf(false) }
    val elapsed = remember { mutableFloatStateOf(0f) }
    val ink = SiteTheme.colors.ink
    val background = SiteTheme.colors.background
    val paint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.create("sans-serif", Typeface.NORMAL) } }
    LaunchedEffect(lifecycle, visible) {
        if (!visible) return@LaunchedEffect
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            var previous = 0L
            while (isActive) {
                if (!ValueAnimator.areAnimatorsEnabled()) {
                    elapsed.floatValue = 0f
                    previous = 0L
                    delay(300)
                } else {
                    withFrameNanos { now ->
                        if (previous != 0L) elapsed.floatValue += (now - previous) / 1_000_000_000f
                        previous = now
                    }
                }
            }
        }
    }
    Spacer(
        Modifier.fillMaxWidth().height(140.dp * fontScale)
            .semantics { contentDescription = "技术词条：" + terms.joinToString("、") }
            .onGloballyPositioned {
                val bounds = it.boundsInWindow()
                visible = bounds.bottom > 0 && bounds.top < view.height && bounds.height > 0
            }.drawWithCache {
        // Cache geometry, font metrics and brushes; frame updates invalidate drawing only.
        val step = 9.dp.toPx()
        val dots = Path()
        for (x in 0..(size.width / step).toInt()) {
            for (y in 0..(size.height / step).toInt()) {
                val radius = 0.65.dp.toPx()
                dots.addOval(androidx.compose.ui.geometry.Rect(
                    x * step - radius, y * step - radius, x * step + radius, y * step + radius,
                ))
            }
        }
        paint.textSize = SiteText.meta.fontSize.toPx()
        val padding = 8.dp.toPx()
        val gap = 112.dp.toPx()
        val height = maxOf(22.dp.toPx(), paint.fontSpacing + 6.dp.toPx())
        val laneWidths = lanes.map { words -> words.map { paint.measureText(it) + padding * 2 } }
        val lengths = laneWidths.map { widths -> widths.sum() + gap * widths.size }
        val baseline = height / 2 - (paint.ascent() + paint.descent()) / 2
        val fillColor = background.copy(alpha = 0.96f).toArgb()
        val borderColor = ink.copy(alpha = 0.25f).toArgb()
        val textColor = ink.copy(alpha = 0.85f).toArgb()
        val dotColor = ink.copy(alpha = 0.12f)
        val stroke = 0.7.dp.toPx()
        val leftFade = Brush.horizontalGradient(listOf(background, background.copy(alpha = 0f)), endX = 18.dp.toPx())
        val rightFade = Brush.horizontalGradient(listOf(background.copy(alpha = 0f), background), startX = size.width - 18.dp.toPx())
        onDrawBehind {
        drawPath(dots, dotColor)
        clipRect {
            lanes.forEachIndexed { lane, words ->
                val widths = laneWidths[lane]
                val length = lengths[lane]
                val phase = (elapsed.floatValue + lane * 1.7f) / durations[lane] % 1f
                val top = lane * (size.height - height) / 5
                var x = -phase * length
                repeat(2) {
                    words.forEachIndexed { index, word ->
                        val width = widths[index]
                        if (x + width > 0 && x < size.width) {
                            paint.style = Paint.Style.FILL
                            paint.color = fillColor
                            drawContext.canvas.nativeCanvas.drawRect(x, top, x + width, top + height, paint)
                            paint.style = Paint.Style.STROKE
                            paint.strokeWidth = stroke
                            paint.color = borderColor
                            drawContext.canvas.nativeCanvas.drawRect(x, top, x + width, top + height, paint)
                            paint.style = Paint.Style.FILL
                            paint.color = textColor
                            drawContext.canvas.nativeCanvas.drawText(word, x + padding, top + baseline, paint)
                        }
                        x += width + gap
                    }
                }
            }
            drawRect(leftFade)
            drawRect(rightFade)
        }
        }
    },
    )
}
