package cn.lovemyrmb.personalsite

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.foundation.layout.Box
import cn.lovemyrmb.personalsite.ui.components.OpeningScreen
import cn.lovemyrmb.personalsite.ui.theme.PersonalSiteTheme

class SiteApplication : Application() {
    val container: AppContainer by lazy { AppContainer(this) }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val container = (application as SiteApplication).container
        setContent {
            PersonalSiteTheme {
                var opening by rememberSaveable { mutableStateOf(true) }
                Box {
                    PersonalSiteApp(container)
                    if (opening) OpeningScreen(onComplete = { opening = false })
                }
            }
        }
    }
}
