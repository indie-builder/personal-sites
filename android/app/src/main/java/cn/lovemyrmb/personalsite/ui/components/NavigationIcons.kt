package cn.lovemyrmb.personalsite.ui.components

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathBuilder
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

/** 专为小站底栏绘制：24px 网格，圆端点、圆转角和一致的 1.7px 线宽。 */
object NavigationIcons {
    val Notes = outline("语雀") {
        moveTo(12f, 5f); curveTo(9f, 3f, 5f, 3f, 2.5f, 4.5f)
        lineTo(2.5f, 19f); curveTo(5f, 17.5f, 9f, 17.5f, 12f, 19.5f)
        curveTo(15f, 17.5f, 19f, 17.5f, 21.5f, 19f); lineTo(21.5f, 4.5f)
        curveTo(19f, 3f, 15f, 3f, 12f, 5f); lineTo(12f, 19.5f)
        moveTo(6f, 8f); lineTo(8.5f, 8.5f)
        moveTo(15.5f, 8.5f); lineTo(18f, 8f)
    }
    // 两条信息摘要与更新圆点：表达持续更新的信息流。
    val Activity = outline("动态") {
        moveTo(16f, 3.5f); lineTo(6f, 3.5f)
        curveTo(4.6f, 3.5f, 3.5f, 4.6f, 3.5f, 6f)
        lineTo(3.5f, 18f); curveTo(3.5f, 19.4f, 4.6f, 20.5f, 6f, 20.5f)
        lineTo(18f, 20.5f); curveTo(19.4f, 20.5f, 20.5f, 19.4f, 20.5f, 18f)
        lineTo(20.5f, 11f)
        moveTo(7.5f, 9f); lineTo(12.5f, 9f)
        moveTo(7.5f, 13f); lineTo(16.5f, 13f)
        moveTo(7.5f, 17f); lineTo(13.5f, 17f)
        circle(19f, 5f, 2f)
    }
    // 提交节点与分支汇流，区别于泛用的代码括号。
    val GitHub = outline("GitHub") {
        circle(6.5f, 5f, 2f); circle(6.5f, 19f, 2f); circle(17.5f, 6f, 2f)
        moveTo(6.5f, 7f); lineTo(6.5f, 17f)
        moveTo(17.5f, 8f); lineTo(17.5f, 10f)
        curveTo(17.5f, 14.5f, 6.5f, 10.5f, 6.5f, 16f)
    }
    // 微笑对话气泡：把“问一问”表达为可以亲近的助手。
    val Ask = outline("问一问") {
        moveTo(12f, 3f)
        curveTo(6.5f, 3f, 3f, 6.3f, 3f, 11f)
        curveTo(3f, 13.5f, 4f, 15.5f, 6f, 17f)
        lineTo(5.2f, 21f); lineTo(10f, 19f)
        curveTo(16.5f, 20f, 21f, 16.5f, 21f, 11f)
        curveTo(21f, 6.3f, 17.5f, 3f, 12f, 3f); close()
        moveTo(8.5f, 9f); lineTo(8.5f, 10f)
        moveTo(15.5f, 9f); lineTo(15.5f, 10f)
        moveTo(9f, 13.5f); curveTo(10.5f, 15.2f, 13.5f, 15.2f, 15f, 13.5f)
    }
    // 叠放的作品画布与小星标，表达创作成果而非公文包。
    val Portfolio = outline("作品集") {
        moveTo(8f, 3.5f); lineTo(18f, 3.5f)
        curveTo(19.4f, 3.5f, 20.5f, 4.6f, 20.5f, 6f); lineTo(20.5f, 15f)
        moveTo(6f, 7f); lineTo(15f, 7f)
        curveTo(16.1f, 7f, 17f, 7.9f, 17f, 9f); lineTo(17f, 18.5f)
        curveTo(17f, 19.6f, 16.1f, 20.5f, 15f, 20.5f); lineTo(6f, 20.5f)
        curveTo(4.9f, 20.5f, 4f, 19.6f, 4f, 18.5f); lineTo(4f, 9f)
        curveTo(4f, 7.9f, 4.9f, 7f, 6f, 7f); close()
        moveTo(10.5f, 10.5f); lineTo(11.5f, 12.8f); lineTo(14f, 14f)
        lineTo(11.5f, 15.2f); lineTo(10.5f, 17.5f); lineTo(9.5f, 15.2f)
        lineTo(7f, 14f); lineTo(9.5f, 12.8f); close()
    }
    // 柔和的半身像与开放肩线，保留个人身份的直觉识别。
    val About = outline("关于我") {
        circle(12f, 7.5f, 4f)
        moveTo(4f, 20.5f); lineTo(4f, 19.5f)
        curveTo(4f, 16.2f, 7.4f, 14f, 12f, 14f)
        curveTo(16.6f, 14f, 20f, 16.2f, 20f, 19.5f); lineTo(20f, 20.5f)
        moveTo(9.5f, 7.5f); curveTo(10.7f, 8.8f, 13.3f, 8.8f, 14.5f, 7.5f)
    }
}

private fun outline(name: String, drawing: PathBuilder.() -> Unit): ImageVector =
    ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f).apply {
        path(fill = null, stroke = SolidColor(Color.Black), strokeLineWidth = 1.7f,
            strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round, pathBuilder = drawing)
    }.build()

private fun PathBuilder.circle(x: Float, y: Float, r: Float) {
    val c = r * 0.5522848f
    moveTo(x + r, y)
    curveTo(x + r, y + c, x + c, y + r, x, y + r)
    curveTo(x - c, y + r, x - r, y + c, x - r, y)
    curveTo(x - r, y - c, x - c, y - r, x, y - r)
    curveTo(x + c, y - r, x + r, y - c, x + r, y); close()
}
