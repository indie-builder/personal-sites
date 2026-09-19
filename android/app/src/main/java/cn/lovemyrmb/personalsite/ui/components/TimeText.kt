package cn.lovemyrmb.personalsite.ui.components

import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** ISO 时间 → 相对时间文案（与站点一致的措辞：刚刚/N分钟前/N小时前/N天前）。 */
fun relativeTimeLabel(iso: String?, now: Long = System.currentTimeMillis()): String? {
    val instant = parseIso(iso) ?: return null
    val minutes = Duration.between(instant, Instant.ofEpochMilli(now)).toMinutes()
    if (minutes < 0) return null
    if (minutes < 1) return "刚刚"
    if (minutes < 60) return "$minutes 分钟前"
    val hours = minutes / 60
    if (hours < 24) return "$hours 小时前"
    val days = hours / 24
    if (days < 30) return "$days 天前"
    return null
}

/** ISO 时间 → 「M月d日」；解析失败返回 null。 */
fun dayLabel(iso: String?): String? {
    val instant = parseIso(iso) ?: return null
    val formatter = DateTimeFormatter.ofPattern("M月d日").withZone(ZoneId.systemDefault())
    return formatter.format(instant)
}

/** 列表条目的时间标签：优先相对时间，超一个月回退日期。 */
fun feedTimeLabel(iso: String?): String? =
    relativeTimeLabel(iso) ?: dayLabel(iso)

private fun parseIso(iso: String?): Instant? = iso?.let { value ->
    runCatching { Instant.parse(value) }.getOrNull()
}
