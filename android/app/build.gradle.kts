import java.util.Properties
import java.io.File as JFile
import java.net.HttpURLConnection
import java.net.URL

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// ---- Versionamento via Lovable Cloud -------------------------------------
// O contador real fica no banco. A cada build, fazemos UM POST autenticado
// para /api/public/bump-version, que incrementa atomicamente e devolve
// { versionName, versionCode }. Resultado: 2.1, 2.2, 2.3... que nunca reseta,
// independente de baixar ZIP novo do GitHub ou trocar de máquina.
//
// O token vem de:
//   1) variável de ambiente BUILD_VERSION_TOKEN, OU
//   2) android/local.properties com BUILD_VERSION_TOKEN=...
private val BUMP_URL =
    "https://project--2f745f30-5619-44f8-8570-ed19b1d0795a.lovable.app/api/public/bump-version"

private fun loadBuildToken(): String? {
    System.getenv("BUILD_VERSION_TOKEN")?.takeIf { it.isNotBlank() }?.let { return it }
    val localProps = rootProject.file("local.properties")
    if (localProps.exists()) {
        val p = Properties().apply { localProps.inputStream().use { load(it) } }
        p.getProperty("BUILD_VERSION_TOKEN")?.takeIf { it.isNotBlank() }?.let { return it }
    }
    return null
}

private data class RemoteVersion(val name: String, val code: Int)

private fun shouldBumpVersion(): Boolean {
    val taskNames = gradle.startParameter.taskNames
    if (taskNames.isEmpty()) return false
    val pattern = Regex("(assemble|bundle|install)(Release|Debug)", RegexOption.IGNORE_CASE)
    return taskNames.any { pattern.containsMatchIn(it) }
}

private fun loadFallbackVersion(): RemoteVersion {
    val props = Properties()
    val file = rootProject.file("version.properties")
    if (file.exists()) file.inputStream().use { props.load(it) }
    val base = props.getProperty("versionBase")?.toIntOrNull() ?: 2
    println("[tvapps] Build sem assemble/bundle/install — usando versão local de dev (sem bump remoto).")
    return RemoteVersion(name = "$base.0-dev", code = 1)
}

private fun fetchRemoteVersion(): RemoteVersion {
    if (!shouldBumpVersion()) {
        return loadFallbackVersion()
    }
    val token = loadBuildToken()
        ?: throw GradleException(
            "BUILD_VERSION_TOKEN ausente. Adicione 'BUILD_VERSION_TOKEN=<seu_token>' " +
                "em android/local.properties (ou exporte como variável de ambiente) " +
                "antes de rodar o build."
        )
    val conn = (URL(BUMP_URL).openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        setRequestProperty("x-build-token", token)
        setRequestProperty("Content-Type", "application/json")
        connectTimeout = 10_000
        readTimeout = 10_000
        doOutput = true
        outputStream.use { it.write("{}".toByteArray()) }
    }
    val status = conn.responseCode
    val body = (if (status in 200..299) conn.inputStream else conn.errorStream)
        .bufferedReader().use { it.readText() }
    if (status !in 200..299) {
        throw GradleException("Falha ao obter versão remota: HTTP $status — $body")
    }
    val nameRegex = Regex("\"versionName\"\\s*:\\s*\"([^\"]+)\"")
    val codeRegex = Regex("\"versionCode\"\\s*:\\s*(\\d+)")
    val name = nameRegex.find(body)?.groupValues?.get(1)
        ?: throw GradleException("Resposta sem versionName: $body")
    val code = codeRegex.find(body)?.groupValues?.get(1)?.toInt()
        ?: throw GradleException("Resposta sem versionCode: $body")
    println("[tvapps] Versão remota obtida: $name (code=$code)")
    return RemoteVersion(name, code)
}

private val remoteVersion: RemoteVersion by lazy { fetchRemoteVersion() }
val computedVersionCode: Int get() = remoteVersion.code
val computedVersionName: String get() = remoteVersion.name
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