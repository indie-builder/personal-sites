plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "cn.lovemyrmb.personalsite"
    compileSdk = 37
    compileSdkMinor = 1
    buildFeatures { buildConfig = true }

    defaultConfig {
        applicationId = "cn.lovemyrmb.personalsite"
        minSdk = 31
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("int", "LOCAL_ASK_PORT", "0")
    }

    buildTypes {
        debug {
            val port = providers.gradleProperty("localAskPort").orNull?.toInt() ?: 0
            require(port == 0 || port in 1..65535) { "localAskPort must be a valid port" }
            buildConfigField("int", "LOCAL_ASK_PORT", port.toString())
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions {
        // PagedFeed 失败路径写 android.util.Log；单测中让桩返回默认值以覆盖该路径。
        unitTests.isReturnDefaultValues = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

dependencies {
    implementation(libs.commonmark)
    implementation(libs.commonmark.ext.gfm.tables)
    implementation(libs.commonmark.ext.gfm.strikethrough)
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.browser)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.retrofit)
    implementation(libs.retrofit.kotlinx.serialization)
    implementation(libs.okhttp)
    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)
    implementation(libs.media3.exoplayer)
    implementation(libs.media3.ui)
    implementation(libs.haze)
    implementation(libs.haze.materials)
}
