package cn.lovemyrmb.personalsite.ui.about

import android.animation.ValueAnimator
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.dp
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.alpha
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

// 同 Web ProfileIntroduction 的问候语与 2600ms 停顿、72ms 逐字节奏。
private val greetings = listOf("你好，", "Hello,", "Hola,", "こんにちは、", "안녕하세요,", "Bonjour,", "नमस्ते,", "Ciao,", "Olá,", "Hallo,", "Merhaba,", "Привет,", "مرحبًا،", "สวัสดีครับ,")

@Composable
fun ProfileGreeting() {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val view = LocalView.current
    var visible by remember { mutableStateOf(false) }
    var greeting by remember { mutableStateOf(greetings.first()) }
    LaunchedEffect(lifecycle, visible) {
        greeting = greetings.first()
        if (!visible) return@LaunchedEffect
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            var index = 0
            try {
                while (isActive) {
                    if (!ValueAnimator.areAnimatorsEnabled()) {
                        greeting = greetings.first()
                        index = 0
                        delay(300)
                        continue
                    }
                    delay(2600)
                    if (!ValueAnimator.areAnimatorsEnabled()) continue
                    index = (index + 1) % greetings.size
                    val next = greetings[index]
                    for (count in 1..next.length) {
                        if (!ValueAnimator.areAnimatorsEnabled()) break
                        greeting = next.take(count)
                        delay(72)
                    }
                }
            } finally { greeting = greetings.first() }
        }
    }
    Box(
        modifier = Modifier
            .clearAndSetSemantics { contentDescription = "你好" }
            .onGloballyPositioned {
                val bounds = it.boundsInWindow()
                visible = bounds.height > 0 && bounds.bottom > 0 && bounds.top < view.height
            },
        contentAlignment = Alignment.CenterStart,
    ) {
        // Reserve the actual maximum font metrics for every script, including at large font scales.
        // Unlike a minimum dp height, this prevents fallback fonts from pushing the biography down.
        greetings.forEach { text ->
            Text(text, style = SiteText.title, modifier = Modifier.alpha(0f), maxLines = 1, softWrap = false)
        }
        Text(greeting, style = SiteText.title, color = SiteTheme.colors.ink, maxLines = 1, softWrap = false)
    }
}
