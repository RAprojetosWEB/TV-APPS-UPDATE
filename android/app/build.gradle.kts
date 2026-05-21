import java.text.SimpleDateFormat
import java.util.Date
import java.util.Properties
import java.io.File as JFile

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// ---- Versionamento automático --------------------------------------------
// Lê android/version.properties (versionBase) e gera versionCode/Name
// dinamicamente baseado no timestamp da build. Resultado: toda compilação
// produz uma versão maior que a anterior, sem edição manual.
val versionProps = Properties().apply {
    val f = rootProject.file("version.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
val versionBase: String = versionProps.getProperty("versionBase", "2")
val buildTimestamp: String = SimpleDateFormat("yyyy.MM.dd.HHmm").format(Date())
val computedVersionCode: Int = ((Date().time / 1000) - 1700000000).toInt()
val computedVersionName: String = "$versionBase.$buildTimestamp"
// --------------------------------------------------------------------------

android {
    namespace = "com.rastream.platformtv"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.rastream.platformtv"
        minSdk = 24
        targetSdk = 34
        versionCode = computedVersionCode
        versionName = computedVersionName
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    // Renomeia o APK final sempre para "platformtv-latest.apk" (estável p/ Supabase).
    applicationVariants.all {
        outputs.all {
            (this as com.android.build.gradle.internal.api.BaseVariantOutputImpl)
                .outputFileName = "platformtv-latest.apk"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}

// ---- Geração automática do update.json -----------------------------------
// Após cada `assembleRelease`/`assembleDebug`, escreve um update.json ao
// lado do APK contendo versionCode/versionName/apkUrl. Basta subir ambos
// (APK + update.json) no bucket tvapps-updates, sempre com os mesmos nomes.
tasks.register("generateUpdateJson") {
    doLast {
        listOf("release", "debug").forEach { variant ->
            val apkDir = layout.buildDirectory.dir("outputs/apk/$variant").get().asFile
            if (!apkDir.exists()) return@forEach
            val json = """
                {
                  "versionCode": $computedVersionCode,
                  "versionName": "$computedVersionName",
                  "apkUrl": "https://bunvyxogwpwiojzczgwl.supabase.co/storage/v1/object/public/tvapps-updates/platformtv-latest.apk"
                }
            """.trimIndent()
            JFile(apkDir, "update.json").writeText(json)
            println("[tvapps] update.json gerado em ${apkDir.absolutePath} (versionCode=$computedVersionCode, versionName=$computedVersionName)")
        }
    }
}

afterEvaluate {
    listOf("assembleRelease", "assembleDebug").forEach { name ->
        tasks.findByName(name)?.finalizedBy("generateUpdateJson")
    }
}