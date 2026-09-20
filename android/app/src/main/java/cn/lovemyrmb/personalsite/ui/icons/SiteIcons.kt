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
 * 方向性图标（ArrowBack/ArrowForward/OpenInNew/Chat/MenuBook）开启 autoMirror，
 * 保持原先 automirrored 变体在 RTL 布局下的行为。
 */
object SiteIcons {
    val Home = symbol("Home", autoMirror = false, d = "M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z")
    val Person = symbol("Person", autoMirror = false, d = "M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Zm80-80h480v-32q0-11-5.5-20T700-306q-54-27-109-40.5T480-360q-56 0-111 13.5T260-306q-9 5-14.5 14t-5.5 20v32Zm240-320q33 0 56.5-23.5T560-640q0-33-23.5-56.5T480-720q-33 0-56.5 23.5T400-640q0 33 23.5 56.5T480-560Zm0-80Zm0 400Z")
    val Code = symbol("Code", autoMirror = false, d = "M320-240 80-480l240-240 57 57-184 184 183 183-56 56Zm320 0-57-57 184-184-183-183 56-56 240 240-240 240Z")
    val Work = symbol("Work", autoMirror = false, d = "M160-120q-33 0-56.5-23.5T80-200v-440q0-33 23.5-56.5T160-720h160v-80q0-33 23.5-56.5T400-880h160q33 0 56.5 23.5T640-800v80h160q33 0 56.5 23.5T880-640v440q0 33-23.5 56.5T800-120H160Zm0-80h640v-440H160v440Zm240-520h160v-80H400v80ZM160-200v-440 440Z")
    val MenuBook = symbol("MenuBook", autoMirror = true, d = "M560-564v-68q33-14 67.5-21t72.5-7q26 0 51 4t49 10v64q-24-9-48.5-13.5T700-600q-38 0-73 9.5T560-564Zm0 220v-68q33-14 67.5-21t72.5-7q26 0 51 4t49 10v64q-24-9-48.5-13.5T700-380q-38 0-73 9t-67 27Zm0-110v-68q33-14 67.5-21t72.5-7q26 0 51 4t49 10v64q-24-9-48.5-13.5T700-490q-38 0-73 9.5T560-454ZM260-320q47 0 91.5 10.5T440-278v-394q-41-24-87-36t-93-12q-36 0-71.5 7T120-692v396q35-12 69.5-18t70.5-6Zm260 42q44-21 88.5-31.5T700-320q36 0 70.5 6t69.5 18v-396q-33-14-68.5-21t-71.5-7q-47 0-93 12t-87 36v394Zm-40 118q-48-38-104-59t-116-21q-42 0-82.5 11T100-198q-21 11-40.5-1T40-234v-482q0-11 5.5-21T62-752q46-24 96-36t102-12q58 0 113.5 15T480-740q51-30 106.5-45T700-800q52 0 102 12t96 36q11 5 16.5 15t5.5 21v482q0 23-19.5 35t-40.5 1q-37-20-77.5-31T700-240q-60 0-116 21t-104 59ZM280-494Z")
    val Chat = symbol("Chat", autoMirror = true, d = "M240-400h320v-80H240v80Zm0-120h480v-80H240v80Zm0-120h480v-80H240v80ZM80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240L80-80Zm126-240h594v-480H160v525l46-45Zm-46 0v-480 480Z")
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
