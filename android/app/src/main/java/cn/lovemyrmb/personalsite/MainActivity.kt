package cn.lovemyrmb.personalsite

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
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
                PersonalSiteApp(container)
            }
        }
    }
}
