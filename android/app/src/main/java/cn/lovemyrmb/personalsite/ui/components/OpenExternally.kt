package cn.lovemyrmb.personalsite.ui.components

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.net.toUri

/** 外链统一走 Chrome Custom Tabs；无 Custom Tabs 服务时回退系统浏览器。 */
fun openExternally(context: Context, url: String) {
    val uri = url.toUri()
    val intent = CustomTabsIntent.Builder()
        .setShowTitle(true)
        .build()
    intent.intent.`package` = getPreferredBrowserPackage(context)
    try {
        intent.launchUrl(context, uri)
    } catch (_: Exception) {
        // Custom Tabs 不可用（无浏览器等）时退回普通 VIEW intent。
        context.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}

private fun getPreferredBrowserPackage(context: Context): String? =
    androidx.browser.customtabs.CustomTabsClient.getPackageName(context, null)
