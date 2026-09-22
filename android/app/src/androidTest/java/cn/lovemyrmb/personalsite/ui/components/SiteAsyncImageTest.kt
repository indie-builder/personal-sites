package cn.lovemyrmb.personalsite.ui.components

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import coil3.ImageLoader
import coil3.SingletonImageLoader
import coil3.intercept.Interceptor
import java.io.IOException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * SiteAsyncImage 的自动重试：首次获取失败后按退避自动重发、成功收敛；
 * 持续失败则收敛在重试上限。用可切换的计数拦截器确定性证明。
 * 注意：单例拦截器驻留进程且 setSafe 二次调用是静默 no-op，因此两阶段
 * 必须在同一个测试方法内完成（靠新 model 实例获得全新重试预算）。
 */
@RunWith(AndroidJUnit4::class)
class SiteAsyncImageTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun retryRecoversFromTransientFailureAndConvergesAtLimitOnPersistentFailure() {
        val calls = AtomicInteger(0)
        val persistent = AtomicBoolean(false)
        val flaky = Interceptor { chain ->
            val call = calls.incrementAndGet()
            if (call == 1 || persistent.get()) throw IOException("flaky")
            chain.proceed()
        }
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        SingletonImageLoader.setSafe(
            object : SingletonImageLoader.Factory {
                override fun newImageLoader(context: Context): ImageLoader =
                    ImageLoader.Builder(context)
                        .components { add(flaky) }
                        .build()
            },
        )

        var model by mutableStateOf<Any?>(ColorDrawable(Color.RED))
        compose.setContent {
            SiteAsyncImage(
                model = model,
                contentDescription = null,
                modifier = Modifier.size(40.dp),
            )
        }

        // 阶段一（瞬态失败）：首次失败 + 1s 退避重试成功 = 恰好两次获取。
        compose.waitUntil(10_000) { calls.get() >= 2 }
        Thread.sleep(500)
        assertEquals(2, calls.get())

        // 阶段二（持续失败）：新 model 获得全新重试预算；失败 + 两次退避重试
        // = 3 次，等待越过 3s 退避窗口后不得再增。
        compose.runOnIdle {
            persistent.set(true)
            model = ColorDrawable(Color.BLUE)
        }
        compose.waitUntil(15_000) { calls.get() >= 5 }
        Thread.sleep(3_500)
        assertEquals(5, calls.get())
    }
}
