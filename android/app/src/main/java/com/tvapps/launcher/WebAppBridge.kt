package com.tvapps.launcher

import android.content.Context
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.URI

/**
 * Ponte JavaScript ↔ Kotlin.
 *
 * O site web chama `window.Android.installApk(url, name)` para acionar o
 * download e a instalação nativa. Sem essa ponte o navegador comum não
 * conseguiria instalar APKs.
 *
 * Segurança: só aceitamos URLs cujo host esteja na allowlist abaixo. Isso
 * impede que qualquer página carregada na WebView (ou um ataque de
 * sequestro de DNS) consiga forçar a instalação de um APK arbitrário.
 */
class WebAppBridge(
    private val context: Context,
    private val webView: WebView,
) {
    private val scope: CoroutineScope = MainScope()

    private val allowedHosts = setOf(
        "apyjsxxuuptelmiwnzwq.supabase.co",
    )

    @JavascriptInterface
    fun isNative(): Boolean = true

    @JavascriptInterface
    fun version(): String = "1.0"

    @JavascriptInterface
    fun installApk(url: String, name: String) {
        val host = runCatching { URI(url).host }.getOrNull()
        if (host == null || host !in allowedHosts) {
            postProgress(name, -1, "URL não autorizada")
            return
        }
        scope.launch {
            ApkDownloader.download(context, url, name).collect { progress ->
                when (progress) {
                    is DownloadProgress.Progress ->
                        postProgress(name, progress.percent, null)
                    is DownloadProgress.Done -> {
                        postProgress(name, 100, null)
                        withContext(Dispatchers.Main) {
                            ApkInstaller.install(context, progress.file)
                        }
                    }
                    is DownloadProgress.Error -> {
                        postProgress(name, -1, progress.message)
                        withContext(Dispatchers.Main) {
                            Toast.makeText(
                                context,
                                "Erro: ${progress.message}",
                                Toast.LENGTH_LONG,
                            ).show()
                        }
                    }
                }
            }
        }
    }

    private fun postProgress(name: String, percent: Int, error: String?) {
        val safeName = name.replace("'", "")
        val safeError = error?.replace("'", "") ?: ""
        val js = """
            if (window.__onNativeApkProgress) {
                window.__onNativeApkProgress('$safeName', $percent, '$safeError');
            }
        """.trimIndent()
        webView.post { webView.evaluateJavascript(js, null) }
    }

    fun dispose() {
        scope.cancel()
    }
}