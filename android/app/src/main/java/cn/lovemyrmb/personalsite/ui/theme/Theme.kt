package cn.lovemyrmb.personalsite.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
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
    private val base = TextStyle(fontFamily = FontFamily.SansSerif, letterSpacing = 0.sp, fontWeight = FontWeight.Normal)
    val identity = base.copy(fontSize = 32.sp, lineHeight = 40.sp, fontWeight = FontWeight.Medium)
    val pageTitle = base.copy(fontSize = 22.sp, lineHeight = 30.sp, fontWeight = FontWeight.SemiBold)
    val title = base.copy(fontSize = 16.sp, lineHeight = 24.sp, fontWeight = FontWeight.Medium)
    val listTitle = base.copy(fontSize = 15.sp, lineHeight = 22.sp, fontWeight = FontWeight.Medium)
    val body = base.copy(fontSize = 15.sp, lineHeight = 26.sp)
    val summary = base.copy(fontSize = 13.sp, lineHeight = 21.sp)
    val meta = base.copy(fontSize = 12.sp, lineHeight = 18.sp)
    val eyebrow = meta.copy(fontWeight = FontWeight.Medium)
    val label = base.copy(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.Medium)
    val tab = label.copy(fontWeight = FontWeight.Normal)
    val tabSelected = label.copy(fontWeight = FontWeight.SemiBold)
}

object SiteSpace {
    val micro = 4.dp
    val compact = 8.dp
    val related = 12.dp
    val paragraph = 16.dp
    val item = 20.dp
    val page = 24.dp
    val section = 24.dp
    val touch = 48.dp
}

private val SiteTypography = Typography(
    displayLarge = SiteText.identity, displayMedium = SiteText.identity, displaySmall = SiteText.identity,
    headlineLarge = SiteText.identity, headlineMedium = SiteText.pageTitle, headlineSmall = SiteText.pageTitle,
    titleLarge = SiteText.title, titleMedium = SiteText.listTitle, titleSmall = SiteText.label,
    bodyLarge = SiteText.body, bodyMedium = SiteText.summary, bodySmall = SiteText.meta,
    labelLarge = SiteText.label, labelMedium = SiteText.eyebrow, labelSmall = SiteText.meta,
)

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
            typography = SiteTypography,
            colorScheme = if (darkTheme) DarkScheme else LightScheme,
            content = content,
        )
    }
}
