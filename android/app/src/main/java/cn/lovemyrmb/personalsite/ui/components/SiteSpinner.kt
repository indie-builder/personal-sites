package cn.lovemyrmb.personalsite.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

import cn.lovemyrmb.personalsite.ui.theme.SiteTheme

/** 全站共用的整块加载占位:居中细线弱色指示。 */
@Composable
fun SiteSpinner(modifier: Modifier = Modifier) {
    Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = SiteTheme.colors.muted, strokeWidth = 2.dp)
    }
}
