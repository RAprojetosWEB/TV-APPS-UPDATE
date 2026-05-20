package com.tvapps.launcher

import android.os.Bundle
import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : Activity() {

    companion object {
        // Site publicado no Lovable — toda edição visual é feita aqui e
        // refletida automaticamente nas TV Box (sem recompilar o APK).
        const val SITE_URL = "https://sideload-hero.lovable.app"
    }

    private lateinit var webView: WebView
    private val downloadScope: CoroutineScope = MainScope()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#1A0D2E"))
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                cacheMode = WebSettings.LOAD_DEFAULT
                useWideViewPort = true
                loadWithOverviewMode = true
                builtInZoomControls = false
                displayZoomControls = false
                userAgentString = "$userAgentString TVAppsLauncher/1.0"
            }
            webViewClient = WebViewClient()
            // Ponte JS → Kotlin: o site chama window.Android.installApk(url)
            addJavascriptInterface(WebAppBridge(this@MainActivity, this), "Android")
            // Rede de segurança: se o site cair no fluxo web (download direto
            // do APK), interceptamos aqui e rodamos o mesmo fluxo nativo de
            // download + instalação. Sem isso, blob/URLs de APK numa WebView
            // simplesmente não abrem o instalador do Android.
            setDownloadListener { url, _, _, mimeType, _ ->
                // blob: URLs não podem ser baixadas pelo ApkDownloader (só http/https).
                // Ignoramos silenciosamente — o web fallback nem usa mais blob.
                if (url.startsWith("blob:")) return@setDownloadListener
                val isApk = mimeType?.contains("vnd.android.package-archive") == true ||
                    url.endsWith(".apk", ignoreCase = true)
                if (!isApk) return@setDownloadListener
                Toast.makeText(this@MainActivity, "Baixando APK…", Toast.LENGTH_SHORT).show()
                val name = url.substringAfterLast('/').substringBefore('?')
                downloadScope.launch {
                    ApkDownloader.download(this@MainActivity, url, name).collect { progress ->
                        when (progress) {
                            is DownloadProgress.Done -> withContext(Dispatchers.Main) {
                                ApkInstaller.install(this@MainActivity, progress.file)
                            }
                            is DownloadProgress.Error -> withContext(Dispatchers.Main) {
                                Toast.makeText(
                                    this@MainActivity,
                                    "Erro no download: ${progress.message}",
                                    Toast.LENGTH_LONG,
                                ).show()
                            }
                            else -> Unit
                        }
                    }
                }
            }
            isFocusable = true
            isFocusableInTouchMode = true
            requestFocus()
        }
        setContentView(webView)

        webView.loadUrl(SITE_URL)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        // Botão Voltar do controle: se a WebView pode voltar página, faz isso.
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        downloadScope.cancel()
        webView.destroy()
        super.onDestroy()
    }
}