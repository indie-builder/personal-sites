package cn.lovemyrmb.personalsite.ui.icons

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.graphics.vector.group
import androidx.compose.ui.unit.dp

/**
 * 站点自带图标，取自 Google Material Symbols（outlined，24px 展示、960 设计网格）。
 * androidx material-icons-extended 已停止发版，这里以源码内联，随 R8 自然裁剪。
 * 方向性图标（ArrowBack/ArrowForward/OpenInNew）开启 autoMirror，
 * 保持原先 automirrored 变体在 RTL 布局下的行为。
 */
object SiteIcons {
    val ArrowBack = symbol("ArrowBack", autoMirror = true, d = "m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z")
    val ArrowForward = symbol("ArrowForward", autoMirror = true, d = "M647-440H160v-80h487L423-744l57-56 320 320-320 320-57-56 224-224Z")
    val OpenInNew = symbol("OpenInNew", autoMirror = true, d = "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z")
    val ArrowDownward = symbol("ArrowDownward", autoMirror = false, d = "M440-800v487L216-537l-56 57 320 320 320-320-56-57-224 224v-487h-80Z")
    val ArrowUpward = symbol("ArrowUpward", autoMirror = false, d = "M440-160v-487L216-423l-56-57 320-320 320 320-56 57-224-224v487h-80Z")
    val ArrowDropDown = symbol("ArrowDropDown", autoMirror = false, d = "M480-360 280-560h400L480-360Z")
    val PlayArrow = symbol("PlayArrow", autoMirror = false, d = "M320-200v-560l440 280-440 280Z")
    val Stop = symbol("Stop", autoMirror = false, d = "M240-240v-480h480v480H240Z")
    val ContentCopy = symbol("ContentCopy", autoMirror = false, d = "M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z")
    val Refresh = symbol("Refresh", autoMirror = false, d = "M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z")
    val Check = symbol("Check", autoMirror = false, d = "M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z")
    val Search = symbol("Search", autoMirror = false, d = "M784-120 532-372q-32 26-71.5 39T380-320q-109 0-185.5-76T118-580q0-108 76.5-184.5T381-841q108 0 184 76.5T641-580q0 41-13 79t-39 70l252 253-57 58ZM381-400q75 0 127.5-52.5T561-580q0-75-52.5-127.5T381-760q-75 0-127.5 52.5T201-580q0 75 52.5 127.5T381-400Z")
    val Close = symbol("Close", autoMirror = false, d = "m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z")
}

private fun symbol(name: String, autoMirror: Boolean, d: String): ImageVector =
    ImageVector.Builder(
        name = "SiteIcons.$name",
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 960f,
        viewportHeight = 960f,
        autoMirror = autoMirror,
    ).apply {
        // Symbols 设计网格纵轴为 -960..0，整体下移一个视口归一到 0..960。
        group(translationY = 960f) {
            addPath(pathData = addPathNodes(d), fill = SolidColor(Color.Black))
        }
    }.build()
