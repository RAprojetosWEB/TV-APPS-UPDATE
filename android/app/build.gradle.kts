import java.util.Properties
import java.io.File as JFile

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// ---- Versionamento automático --------------------------------------------
// Lê android/version.properties e gera versionName/versionCode a partir de
// um contador (buildNumber) que é incrementado a cada build. Sem datas,
// sem timestamps. Resultado: 2.80, 2.81, 2.82, ...
val versionPropsFile: JFile = rootProject.file("version.properties")
val versionProps = Properties().apply {
    if (versionPropsFile.exists()) versionPropsFile.inputStream().use { load(it) }
}
val versionBase: String = versionProps.getProperty("versionBase", "2")
val previousBuildNumber: Int = versionProps.getProperty("buildNumber", "0").toInt()
val nextBuildNumber: Int = previousBuildNumber + 1
val computedVersionCode: Int = nextBuildNumber
val computedVersionName: String = "$versionBase.$nextBuildNumber"

// Persiste o novo buildNumber de volta no arquivo, preservando comentários
// simples (header). Só roda quando alguma task de assemble for executada.
fun bumpBuildNumber() {
    val header = """
        # Fonte única de verdade para a versão do TV.Apps.
        # - versionBase: número "marketing". Só edite quando quiser virar pra 3, 4, 5...
        # - buildNumber: contador automático. O Gradle soma +1 a cada build.
        #   NÃO edite na mão (a menos que queira resetar a contagem).
        # Resultado: versionName = "{versionBase}.{buildNumber}" → ex: 2.80, 2.81, 2.82
    """.trimIndent()
    versionPropsFile.writeText("$header\nversionBase=$versionBase\nbuildNumber=$nextBuildNumber\n")
}
// --------------------------------------------------------------------------

android {
    namespace = "com.tvapps.launcher"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.tvapps.launcher"
        minSdk = 24
        targetSdk = 34
        versionCode = computedVersionCode
        versionName = computedVersionName
    }

    signingConfigs {
        create("release") {
            storeFile = file("tvapps.keystore")
            storePassword = "tvapps2026"
            keyAlias = "tvapps"
            keyPassword = "tvapps2026"
            storeType = "PKCS12"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        getByName("debug") {
            signingConfig = signingConfigs.getByName("release")
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

    // Renomeia o APK final sempre para "app-release-latest.apk" (ou o que preferir).
    applicationVariants.all {
        outputs.all {
            (this as com.android.build.gradle.internal.api.BaseVariantOutputImpl)
                .outputFileName = "app-release-latest.apk"
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
        bumpBuildNumber()
        listOf("release", "debug").forEach { variant ->
            val apkDir = layout.buildDirectory.dir("outputs/apk/$variant").get().asFile
            if (!apkDir.exists()) return@forEach
            val json = """
                {
                  "versionCode": $computedVersionCode,
                  "versionName": "$computedVersionName",
                  "apkUrl": "https://bunvyxogwpwiojzczgwl.supabase.co/storage/v1/object/public/tvapps-updates/app-release-latest.apk"
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