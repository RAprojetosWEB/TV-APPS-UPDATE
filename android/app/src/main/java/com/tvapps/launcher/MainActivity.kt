package com.tvapps.launcher

import android.os.Bundle
import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.net.Uri
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
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : Activity() {

    companion object {
        // Site publicado no Lovable — toda edição visual é feita aqui e
        // refletida automaticamente nas TV Box (sem recompilar o APK).
        const val SITE_URL = "https://sideload-hero.lovable.app"
    }

    private lateinit var webView: WebView
    private val scope: CoroutineScope = MainScope()

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
            // Rede de segurança: se a página cair no caminho web (download
            // de blob/url de .apk), interceptamos e usamos o instalador nativo.
            setDownloadListener { url, _, contentDisposition, mimeType, _ ->
                val isApk = url.endsWith(".apk", ignoreCase = true) ||
                    mimeType == "application/vnd.android.package-archive" ||
                    contentDisposition?.contains(".apk", ignoreCase = true) == true
                if (!isApk) return@setDownloadListener
                val name = Uri.parse(url).lastPathSegment
                    ?.substringBeforeLast('.') ?: "app"
                Toast.makeText(this@MainActivity, "Baixando $name…", Toast.LENGTH_SHORT).show()
                scope.launch {
                    ApkDownloader.download(this@MainActivity, url, name).collect { p ->
                        when (p) {
                            is DownloadProgress.Done -> withContext(Dispatchers.Main) {
                                ApkInstaller.install(this@MainActivity, p.file)
                            }
                            is DownloadProgress.Error -> withContext(Dispatchers.Main) {
                                Toast.makeText(
                                    this@MainActivity,
                                    "Erro: ${p.message}",
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
        webView.destroy()
        super.onDestroy()
    }
}