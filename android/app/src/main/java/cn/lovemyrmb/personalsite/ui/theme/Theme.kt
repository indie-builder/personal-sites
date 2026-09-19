package cn.lovemyrmb.personalsite.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * 站点黑白灰单色体系（DESIGN.md 令牌）：亮色 ink #1c1c1e / surface #ffffff /
 * muted #656568 / line #eeeeee；暗色背景 #181818 / 前景 #f4f4f4。
 * 无卡片、无重阴影，层级靠细线、留白与字重。
 */
@Immutable
data class SiteColors(
    val background: Color,
    val ink: Color,
    val muted: Color,
    val quiet: Color,
    val line: Color,
    val glass: Color,
)

private val LightSiteColors = SiteColors(
    background = Color(0xFFFFFFFF),
    ink = Color(0xFF1C1C1E),
    muted = Color(0xFF656568),
    quiet = Color(0xFF767676),
    line = Color(0xFFEEEEEE),
    glass = Color(0xCCFFFFFF),
)

private val DarkSiteColors = SiteColors(
    background = Color(0xFF181818),
    ink = Color(0xFFF4F4F4),
    muted = Color(0xFFA1A1A4),
    quiet = Color(0xFF8E8E93),
    line = Color(0xFF2A2A2C),
    glass = Color(0xB3181818),
)

val LocalSiteColors = staticCompositionLocalOf { LightSiteColors }

object SiteTheme {
    val colors: SiteColors
        @Composable get() = LocalSiteColors.current
}

// 站点排版阶梯的 App 侧映射：标题 600 字重，正文 15sp，辅助 12sp。
object SiteText {
    val pageTitle = TextStyle(fontSize = 22.sp, lineHeight = 30.sp, fontWeight = FontWeight.SemiBold)
    val title = TextStyle(fontSize = 16.sp, lineHeight = 23.sp, fontWeight = FontWeight.SemiBold)
    val listTitle = TextStyle(fontSize = 15.sp, lineHeight = 21.sp, fontWeight = FontWeight.SemiBold)
    val body = TextStyle(fontSize = 15.sp, lineHeight = 26.sp)
    val summary = TextStyle(fontSize = 13.sp, lineHeight = 19.sp)
    val meta = TextStyle(fontSize = 12.sp, lineHeight = 17.sp)
    val eyebrow = TextStyle(fontSize = 12.sp, lineHeight = 16.sp, fontWeight = FontWeight.Medium)
}

private val LightScheme = lightColorScheme(
    background = LightSiteColors.background,
    onBackground = LightSiteColors.ink,
    surface = LightSiteColors.background,
    onSurface = LightSiteColors.ink,
    surfaceVariant = LightSiteColors.line,
    onSurfaceVariant = LightSiteColors.muted,
    outline = LightSiteColors.line,
    primary = LightSiteColors.ink,
    onPrimary = LightSiteColors.background,
)

private val DarkScheme = darkColorScheme(
    background = DarkSiteColors.background,
    onBackground = DarkSiteColors.ink,
    surface = DarkSiteColors.background,
    onSurface = DarkSiteColors.ink,
    surfaceVariant = DarkSiteColors.line,
    onSurfaceVariant = DarkSiteColors.muted,
    outline = DarkSiteColors.line,
    primary = DarkSiteColors.ink,
    onPrimary = DarkSiteColors.background,
)

@Composable
fun PersonalSiteTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colors = if (darkTheme) DarkSiteColors else LightSiteColors
    CompositionLocalProvider(LocalSiteColors provides colors) {
        MaterialTheme(
            colorScheme = if (darkTheme) DarkScheme else LightScheme,
            content = content,
        )
    }
}
