package cn.lovemyrmb.personalsite.ui.components

import androidx.compose.runtime.staticCompositionLocalOf
import cn.lovemyrmb.personalsite.data.VideoPreloader

/** 由 MainActivity 在 setContent 时提供的进程级视频预加载器；预览/测试下默认 null，走独立播放器。 */
val LocalVideoPreloader = staticCompositionLocalOf<VideoPreloader?> { null }
