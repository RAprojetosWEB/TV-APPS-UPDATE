package com.tvapps.launcher

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

import android.view.SoundEffectConstants
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {

    private val scope: CoroutineScope = MainScope()
    private val cardJobs = mutableMapOf<Int, Job>()
    private val cardViews = mutableListOf<CardViews>()
    private var webView: WebView? = null
    private var isUnlocked = false

    // Status bar do topo
    private var clockView: TextView? = null
    private var dateView: TextView? = null
    private var weatherView: TextView? = null
    private var wifiView: TextView? = null
    private var otaStatusPill: TextView? = null
    private val statusHandler = Handler(Looper.getMainLooper())
    private val clockTicker = object : Runnable {
        override fun run() {
            updateClockAndDate()
            statusHandler.postDelayed(this, 30_000)
        }
    }
    private val weatherTicker = object : Runnable {
        override fun run() {
            refreshWeather()
            statusHandler.postDelayed(this, 30 * 60_000L)
        }
    }
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var packageReceiver: PackageInstallReceiver? = null



    private data class CardViews(
        val container: FrameLayout,
        val content: LinearLayout,
        val iconBadge: FrameLayout,
        val iconImage: ImageView,
        val title: TextView,
        val subtitle: TextView,
        val pill: TextView,
        val progress: ProgressBar,
        val percent: TextView,
        val installedChip: TextView,
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
        )
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
        setupWebViewBridge()
        // No lugar do buildRoot() direto, vamos construir a UI do login
        setContentView(buildLoginScreen())

        // Limpeza inicial do cache de APKs (apps já instalados + órfãos + limite)
        try {
            ApkCache.cleanupInstalled(this, AppCatalog.apps)
            ApkCache.enforceSizeLimit(this)
        } catch (_: Exception) {
        }

        setupPackageReceiver()
    }

    private fun setupPackageReceiver() {
        packageReceiver = PackageInstallReceiver { packageName ->
            // Busca o app no catálogo que corresponde ao package instalado
            val app = AppCatalog.apps.find { 
                InstalledRegistry.resolvePackage(this, it) == packageName 
            }

            if (app != null) {
                ApkCache.deleteFor(this, app.name)
                runOnUiThread {
                    Toast.makeText(this, "Instalação concluída. Arquivo temporário removido.", Toast.LENGTH_LONG).show()
                    // Atualiza a UI se o app estiver visível
                    if (cardViews.isNotEmpty()) {
                        val index = AppCatalog.apps.indexOf(app)
                        if (index != -1) {
                            cardViews.getOrNull(index)?.let { refreshInstalledState(it, app) }
                        }
                    }
                }
            }

        }
        PackageInstallReceiver.register(this, packageReceiver!!)
    }




    override fun onResume() {
        super.onResume()
        // Revalida estado de instalação de cada card e trata limpeza de cache
        if (cardViews.isNotEmpty()) {
            AppCatalog.apps.forEachIndexed { index, app ->
                cardViews.getOrNull(index)?.let { refreshInstalledState(it, app) }
            }
        }
        // Status bar tickers
        if (clockView != null) {
            statusHandler.removeCallbacks(clockTicker)
            statusHandler.post(clockTicker)
        }
        if (weatherView != null) {
            statusHandler.removeCallbacks(weatherTicker)
            statusHandler.post(weatherTicker)
        }
        registerNetworkCallback()
    }

    override fun onPause() {
        super.onPause()
        statusHandler.removeCallbacks(clockTicker)
        statusHandler.removeCallbacks(weatherTicker)
        unregisterNetworkCallback()
    }

    private fun buildLoginScreen(): View {
        val dm = resources.displayMetrics
        val widthDp = dm.widthPixels / dm.density
        val scaleFactor = (widthDp / 1280f).coerceIn(0.7f, 1.3f)

        val root = FrameLayout(this).apply {
            background = makeRootBackground()
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        // Layout para bloquear o login caso haja atualização
        val updateOverlay = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            visibility = View.GONE
            setBackgroundColor(Color.parseColor("#E60A0D1A"))
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { gravity = Gravity.CENTER }
        }

        val title = TextView(this).apply {
            text = "Área Restrita"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 32f * scaleFactor)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(0, 0, 0, dp((24 * scaleFactor).toInt()))
            gravity = Gravity.CENTER
        }

        val subtitle = TextView(this).apply {
            text = "Digite a senha para continuar"
            setTextColor(Color.parseColor("#99FFFFFF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f * scaleFactor)
            setPadding(0, 0, 0, dp((32 * scaleFactor).toInt()))
            gravity = Gravity.CENTER
        }

        val passwordInput = android.widget.EditText(this).apply {
            hint = "Senha"
            setHintTextColor(Color.parseColor("#44FFFFFF"))
            setTextColor(Color.WHITE)
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD
            background = makeCardBg(false, scaleFactor)
            val px = dp((24 * scaleFactor).toInt())
            val py = dp((16 * scaleFactor).toInt())
            setPadding(px, py, px, py)
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(dp((300 * scaleFactor).toInt()), ViewGroup.LayoutParams.WRAP_CONTENT)
        }

        val loginButton = TextView(this).apply {
            text = "ENTRAR"
            setTextColor(Color.parseColor("#15102A"))
            background = makePillBg(true, scaleFactor)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f * scaleFactor)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            isFocusable = true
            isClickable = true
            val px = dp((48 * scaleFactor).toInt())
            val py = dp((18 * scaleFactor).toInt())
            setPadding(px, py, px, py)
            val lp = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            lp.topMargin = dp((24 * scaleFactor).toInt())
            layoutParams = lp

            setOnFocusChangeListener { v, hasFocus ->
                v.background = makePillBg(hasFocus, scaleFactor)
                (v as TextView).setTextColor(if (hasFocus) Color.parseColor("#15102A") else Color.WHITE)
            }

            setOnClickListener {
                if (passwordInput.text.toString() == "1555") {
                    isUnlocked = true
                    setContentView(buildRoot())
                } else {
                    Toast.makeText(this@MainActivity, "Senha incorreta", Toast.LENGTH_SHORT).show()
                    passwordInput.text.clear()
                }
            }
        }

        container.addView(title)
        container.addView(subtitle)
        container.addView(passwordInput)
        container.addView(loginButton)
        root.addView(container)
        root.addView(updateOverlay)

        passwordInput.requestFocus()

        // Verificação automática de OTA ANTES do login
        checkOtaUpdateBlocking(updateOverlay, scaleFactor)

        return root
    }

    private fun checkOtaUpdateBlocking(overlay: LinearLayout, scale: Float) {
        scope.launch {
            val otaInfo = try {
                withContext(Dispatchers.IO) {
                    val url = "https://bunvyxogwpwiojzczgwl.supabase.co/storage/v1/object/public/tvapps-updates/update.json?t=${System.currentTimeMillis()}"
                    val client = okhttp3.OkHttpClient()
                    val res = client.newCall(okhttp3.Request.Builder().url(url).build()).execute()
                    res.use {
                        if (!it.isSuccessful) return@withContext null
                        val body = it.body?.string() ?: return@withContext null
                        val json = org.json.JSONObject(body)
                        val remoteName = json.optString("versionName", json.optString("version", ""))
                        val remoteCode = json.optLong("versionCode", -1L)
                        val downloadUrl = json.optString("apkUrl", json.optString("url", ""))

                        val pkgInfo = try { packageManager.getPackageInfo(packageName, 0) } catch (_: Exception) { null }
                        val localCode: Long = if (pkgInfo == null) 0L else {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) pkgInfo.longVersionCode
                            else @Suppress("DEPRECATION") pkgInfo.versionCode.toLong()
                        }

                        val hasUpdate = if (remoteCode > 0L) remoteCode > localCode else false 
                        if (hasUpdate) Triple(true, remoteName, downloadUrl) else null
                    }
                }
            } catch (_: Exception) { null }

            if (otaInfo != null) {
                val (_, remoteVersion, downloadUrl) = otaInfo
                runOnUiThread {
                    overlay.visibility = View.VISIBLE
                    overlay.removeAllViews()

                    val warnIcon = TextView(this@MainActivity).apply {
                        text = "⚠"
                        setTextColor(Color.parseColor("#E8A85C"))
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 64f * scale)
                        gravity = Gravity.CENTER
                    }

                    val title = TextView(this@MainActivity).apply {
                        text = "Atualização Obrigatória"
                        setTextColor(Color.WHITE)
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f * scale)
                        setTypeface(null, android.graphics.Typeface.BOLD)
                        gravity = Gravity.CENTER
                        setPadding(0, dp((16 * scale).toInt()), 0, dp((8 * scale).toInt()))
                    }

                    val msg = TextView(this@MainActivity).apply {
                        text = "Uma nova versão ($remoteVersion) está disponível.\nAtualize para continuar acessando o app."
                        setTextColor(Color.parseColor("#CCFFFFFF"))
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f * scale)
                        gravity = Gravity.CENTER
                        setPadding(0, 0, 0, dp((32 * scale).toInt()))
                    }

                    val btn = TextView(this@MainActivity).apply {
                        text = "ATUALIZAR AGORA"
                        setTextColor(Color.BLACK)
                        background = makePillBg(true, scale)
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f * scale)
                        setTypeface(null, android.graphics.Typeface.BOLD)
                        gravity = Gravity.CENTER
                        isFocusable = true
                        isClickable = true
                        val px = dp((40 * scale).toInt())
                        val py = dp((16 * scale).toInt())
                        setPadding(px, py, px, py)
                        
                        setOnClickListener {
                            showOtaConfirmDialog(remoteVersion, downloadUrl)
                        }
                    }

                    overlay.addView(warnIcon)
                    overlay.addView(title)
                    overlay.addView(msg)
                    overlay.addView(btn)
                    btn.requestFocus()
                }
            }
        }
    }


    private fun setupWebViewBridge() {
        // WebView invisível apenas para servir de bridge para o código React
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            addJavascriptInterface(object {
                @JavascriptInterface
                fun isNative(): Boolean = true

                @JavascriptInterface
                fun isAppInstalled(packageName: String): Boolean = this@MainActivity.isAppInstalled(packageName)

                @JavascriptInterface
                fun openApp(packageName: String) = this@MainActivity.openApp(packageName)

                @JavascriptInterface
                fun installApk(url: String, name: String) {
                    val index = AppCatalog.apps.indexOfFirst { it.name == name }
                    if (index != -1) {
                        runOnUiThread { startDownload(index) }
                    }
                }

                @JavascriptInterface
                fun version(): String = try {
                    packageManager.getPackageInfo(packageName, 0).versionName ?: ""
                } catch (_: Exception) { "" }

                @JavascriptInterface
                fun versionCode(): Long = try {
                    val info = packageManager.getPackageInfo(packageName, 0)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode
                    else @Suppress("DEPRECATION") info.versionCode.toLong()
                } catch (_: Exception) { 0L }
            }, "Android")
            
            // Não precisamos carregar nada real aqui se estivermos usando a UI nativa,
            // mas o código React no index.tsx espera a bridge.
        }
    }

    private fun buildRoot(): View {
        val dm = resources.displayMetrics
        val widthDp = dm.widthPixels / dm.density
        val heightDp = dm.heightPixels / dm.density
        
        // Fator de escala base: assumimos que o design ideal foi feito para uma tela de ~1280dp de largura
        // Limitamos para evitar que em telas muito pequenas ou muito grandes fique bizarro
        val scaleFactor = (widthDp / 1280f).coerceIn(0.85f, 1.1f)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = makeRootBackground()
            setPadding(dp((64 * scaleFactor).toInt()), dp((40 * scaleFactor).toInt()), dp((64 * scaleFactor).toInt()), dp((32 * scaleFactor).toInt()))
        }

        // Cabeçalho: logo+subtitulo à esquerda, barra de status à direita
        root.addView(buildTopBar(scaleFactor))

        val cardWidth = (300 * scaleFactor).toInt()
        val cardHeight = (420 * scaleFactor).toInt()
        val cardMargin = (20 * scaleFactor).toInt()

        // Linha de cards centralizada com navegação infinita
        val row = object : LinearLayout(this) {
            override fun focusSearch(focused: View, direction: Int): View? {
                val currentIdx = cardViews.indexOfFirst { it.container == focused }
                if (currentIdx != -1) {
                    if (direction == View.FOCUS_RIGHT) {
                        return cardViews[(currentIdx + 1) % cardViews.size].container
                    }
                    if (direction == View.FOCUS_LEFT) {
                        return cardViews[(currentIdx - 1 + cardViews.size) % cardViews.size].container
                    }
                }
                return super.focusSearch(focused, direction)
            }
        }.apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f,
            )
            clipChildren = false
            clipToPadding = false
            setPadding(0, dp((20 * scaleFactor).toInt()), 0, dp((20 * scaleFactor).toInt()))
        }

        AppCatalog.apps.forEachIndexed { index, app ->
            val card = buildCard(index, app, cardWidth, cardHeight, cardMargin, scaleFactor)
            row.addView(card.container)
            cardViews.add(card)

            // Atualiza estado inicial do botão + chip "INSTALADO"
            refreshInstalledState(card, app)
        }
        root.addView(row)

        val footer = TextView(this).apply {
            text = "Selecione um aplicativo e pressione OK para instalar ou abrir"
            setTextColor(Color.parseColor("#66FFFFFF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f * scaleFactor)
            gravity = Gravity.CENTER
        }
        root.addView(footer)

        cardViews.getOrNull(0)?.container?.post {
            cardViews[0].container.requestFocus()
        }
        return root
    }

    private fun makeRootBackground(): LayerDrawable {
        val base = GradientDrawable().apply {
            setColor(Color.parseColor("#0A0D1A"))
        }
        val glowBottom = GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            intArrayOf(Color.TRANSPARENT, Color.parseColor("#3315E68A")),
        )
        return LayerDrawable(arrayOf(base, glowBottom))
    }

    private fun buildCard(index: Int, app: CatalogApp, width: Int, height: Int, margin: Int, scale: Float): CardViews {
        // Container externo (FrameLayout) recebe o foco e o background com borda
        val container = FrameLayout(this).apply {
            isFocusable = true
            isFocusableInTouchMode = true
            isClickable = true
            background = makeCardBg(false, scale)
            val lp = LinearLayout.LayoutParams(dp(width), dp(height))
            lp.marginStart = dp(margin)
            lp.marginEnd = dp(margin)
            layoutParams = lp
        }

        // Conteúdo vertical centralizado dentro do card
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            val p = (28 * scale).toInt()
            setPadding(dp(p), dp(p), dp(p), dp(p))
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
        }

        // Badge de ícone (quadrado arredondado, gradiente quando focado)
        val iconBadge = FrameLayout(this).apply {
            background = makeIconBadgeBg(false, scale)
            val size = (100 * scale).toInt()
            val lp = LinearLayout.LayoutParams(dp(size), dp(size))
            lp.bottomMargin = dp((20 * scale).toInt())
            layoutParams = lp
        }
        val iconImage = ImageView(this).apply {
            setImageResource(app.iconRes)
            scaleType = ImageView.ScaleType.FIT_CENTER
            val pad = dp((10 * scale).toInt())
            setPadding(pad, pad, pad, pad)
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ).apply { gravity = Gravity.CENTER }
        }
        iconBadge.addView(iconImage)

        val title = TextView(this).apply {
            text = app.name
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 26f * scale)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
        }
        val subtitle = TextView(this).apply {
            text = app.description
            setTextColor(Color.parseColor("#99FFFFFF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f * scale)
            gravity = Gravity.CENTER
            setPadding(0, dp((8 * scale).toInt()), 0, dp((20 * scale).toInt()))
        }

        // Pill "INSTALAR"
        val pill = TextView(this).apply {
            text = "⬇  Baixar aplicativo"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f * scale)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            background = makePillBg(false, scale)
            val px = (32 * scale).toInt()
            val py = (18 * scale).toInt()
            setPadding(dp(px), dp(py), dp(px), dp(py))
        }

        // Barra de progresso (escondida no estado idle)
        val progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progress = 0
            visibility = View.GONE
            val lp = LinearLayout.LayoutParams(dp((220 * scale).toInt()), dp((8 * scale).toInt()))
            lp.topMargin = dp((14 * scale).toInt())
            layoutParams = lp
        }
        val percent = TextView(this).apply {
            text = ""
            setTextColor(Color.parseColor("#5EE6A8"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f * scale)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            visibility = View.GONE
            setPadding(0, dp((6 * scale).toInt()), 0, 0)
        }

        content.addView(iconBadge)
        content.addView(title)
        content.addView(subtitle)
        content.addView(pill)
        content.addView(progress)
        content.addView(percent)
        container.addView(content)

        // Chip "INSTALADO" sobreposto no canto superior direito do card
        val installedChip = TextView(this).apply {
            text = "INSTALADO"
            setTextColor(Color.parseColor("#15102A"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f * scale)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            val bg = GradientDrawable().apply {
                setColor(Color.parseColor("#5EE6A8"))
                cornerRadius = dp((100 * scale).toInt()).toFloat()
            }
            background = bg
            val px = (12 * scale).toInt()
            val py = (6 * scale).toInt()
            setPadding(dp(px), dp(py), dp(px), dp(py))
            visibility = View.GONE
            val lp = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply {
                gravity = Gravity.TOP or Gravity.END
                topMargin = dp((14 * scale).toInt())
                marginEnd = dp((14 * scale).toInt())
            }
            layoutParams = lp
        }
        container.addView(installedChip)

        container.setOnFocusChangeListener { v, hasFocus ->
            if (hasFocus) {
                v.playSoundEffect(SoundEffectConstants.NAVIGATION_RIGHT)
            }
            v.background = makeCardBg(hasFocus, scale)
            iconBadge.background = makeIconBadgeBg(hasFocus, scale)
            pill.background = makePillBg(hasFocus, scale)
            pill.setTextColor(
                if (hasFocus) Color.parseColor("#15102A") else Color.WHITE,
            )
            v.animate().scaleX(if (hasFocus) 1.06f else 1f)
                .scaleY(if (hasFocus) 1.06f else 1f)
                .setDuration(180).start()
        }
        container.setOnClickListener { 
            it.playSoundEffect(SoundEffectConstants.CLICK)
            startDownload(index) 
        }
        return CardViews(container, content, iconBadge, iconImage, title, subtitle, pill, progress, percent, installedChip)
    }

    private fun makeCardBg(focused: Boolean, scale: Float): GradientDrawable {
        val gd = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(Color.parseColor("#2A1F44"), Color.parseColor("#1E1638")),
        )
        gd.cornerRadius = dp((28 * scale).toInt()).toFloat()
        gd.setStroke(
            dp(if (focused) (3 * scale).toInt().coerceAtLeast(1) else (2 * scale).toInt().coerceAtLeast(1)),
            if (focused) Color.parseColor("#5EE6A8") else Color.parseColor("#3F3360"),
        )
        return gd
    }

    private fun makeIconBadgeBg(focused: Boolean, scale: Float): GradientDrawable {
        val gd = if (focused) {
            GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(Color.parseColor("#5EE6A8"), Color.parseColor("#A78BFA")),
            )
        } else {
            GradientDrawable().apply { setColor(Color.parseColor("#38305A")) }
        }
        gd.cornerRadius = dp((20 * scale).toInt()).toFloat()
        return gd
    }

    private fun makePillBg(focused: Boolean, scale: Float): GradientDrawable {
        val gd = GradientDrawable()
        gd.cornerRadius = dp((100 * scale).toInt()).toFloat()
        if (focused) {
            gd.setColor(Color.parseColor("#5EE6A8"))
            gd.setStroke(dp((2 * scale).toInt().coerceAtLeast(1)), Color.parseColor("#5EE6A8"))
        } else {
            gd.setColor(Color.TRANSPARENT)
            gd.setStroke(dp((2 * scale).toInt().coerceAtLeast(1)), Color.parseColor("#3F3360"))
        }
        return gd
    }

    private fun isAppInstalled(packageName: String): Boolean {
        return try {
            packageManager.getPackageInfo(packageName, 0)
            true
        } catch (e: PackageManager.NameNotFoundException) {
            false
        }
    }

    /**
     * Aplica no card o estado visual de acordo com a instalação e cache.
     * Estados: "Abrir aplicativo", "Instalar aplicativo", "Baixar aplicativo"
     */
    private fun refreshInstalledState(card: CardViews, app: CatalogApp) {
        if (card.progress.visibility == View.VISIBLE) return // download em andamento
        
        val installed = InstalledRegistry.isInstalled(this, app)
        val apkFile = ApkCache.fileFor(this, app.name)
        val hasApk = apkFile.exists() && apkFile.length() > 0

        if (installed) {
            card.pill.text = "▶  Abrir aplicativo"
            card.installedChip.visibility = View.VISIBLE
            // Se já está instalado, removemos o APK do cache para liberar espaço
            ApkCache.deleteFor(this, app.name)
        } else if (hasApk) {
            card.pill.text = "⬇  Instalar aplicativo"
            card.installedChip.visibility = View.GONE
        } else {
            card.pill.text = "⬇  Baixar aplicativo"
            card.installedChip.visibility = View.GONE
        }
    }

    private fun openApp(packageName: String) {
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        if (intent != null) {
            startActivity(intent)
        } else {
            Toast.makeText(this, "Não foi possível abrir o aplicativo", Toast.LENGTH_SHORT).show()
        }
    }

    private fun showAlreadyInstalledDialog(app: CatalogApp) {
        // Estilo customizado para o Dialog ficaria melhor com um layout XML, 
        // mas como estamos fazendo via código, usaremos o AlertDialog padrão
        // que segue o tema do sistema (Android TV geralmente é escuro).
        val builder = AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
        builder.setTitle("Este aplicativo já está instalado.")
        builder.setMessage("Deseja abrir o aplicativo?")
        
        builder.setPositiveButton("Sim, abrir") { dialog, _ ->
            openApp(app.packageName)
            dialog.dismiss()
        }
        
        builder.setNegativeButton("Não") { dialog, _ ->
            dialog.dismiss()
        }
        
        val dialog = builder.create()
        dialog.show()
        
        // Foco inicial no botão "Sim" (Positive Button)
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).requestFocus()
    }

    private fun startDownload(index: Int) {
        val app = AppCatalog.apps[index]
        val card = cardViews[index]
        
        // Se já estiver instalado, abre direto
        if (InstalledRegistry.isInstalled(this, app)) {
            openApp(InstalledRegistry.resolvePackage(this, app))
            return
        }

        // Se não está instalado mas já temos o APK baixado, abre o instalador direto
        val apkFile = ApkCache.fileFor(this, app.name)
        if (apkFile.exists() && apkFile.length() > 0) {
            ApkInstaller.install(this, apkFile)
            return
        }

        if (cardJobs[index]?.isActive == true) return

        card.progress.visibility = View.VISIBLE
        card.progress.progress = 0
        card.percent.visibility = View.VISIBLE
        card.percent.text = "0%"
        card.percent.setTextColor(Color.parseColor("#5EE6A8"))
        card.pill.visibility = View.GONE
        card.subtitle.text = "Baixando…"

        cardJobs[index] = scope.launch {
            ApkDownloader.download(this@MainActivity, app.url, app.name).collect { p ->
                when (p) {
                    is DownloadProgress.Progress -> withContext(Dispatchers.Main) {
                        card.progress.progress = p.percent
                        card.percent.text = "${p.percent}%"
                    }
                    is DownloadProgress.Done -> withContext(Dispatchers.Main) {
                        card.progress.progress = 100
                        card.percent.text = "100%"
                        
                        // Diferencia se foi cache ou download real para o log/UI se quiser, 
                        // mas o comportamento de abrir o instalador é o mesmo.
                        card.subtitle.text = "Abrindo instalador…"
                        
                        ApkInstaller.install(this@MainActivity, p.file)
                        card.pill.postDelayed({
                            card.progress.visibility = View.GONE
                            card.percent.visibility = View.GONE
                            card.pill.visibility = View.VISIBLE
                            card.subtitle.text = AppCatalog.apps[index].description
                            // Revalida instalação real, cache e atualiza chip/botão
                            refreshInstalledState(card, app)
                        }, 2500)
                    }
                    is DownloadProgress.Error -> withContext(Dispatchers.Main) {
                        card.progress.visibility = View.GONE
                        card.percent.visibility = View.GONE
                        card.pill.visibility = View.VISIBLE
                        card.subtitle.text = "Falha no download"
                        Toast.makeText(
                            this@MainActivity,
                            "Falha ao baixar ${app.name}: ${p.message}",
                            Toast.LENGTH_LONG,
                        ).show()
                    }
                }
            }
        }

    }

    private fun dp(value: Int): Int {
        val d = resources.displayMetrics.density
        return (value * d).toInt()
    }

    // ===================== TOP BAR =====================

    private fun buildTopBar(scale: Float): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            )
        }

        // Bloco esquerdo: TV.Apps + subtítulo
        val left = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        val header = TextView(this).apply {
            val accent = "#5EE6A8"
            val spanned = android.text.SpannableString("TV.Apps")
            spanned.setSpan(
                android.text.style.ForegroundColorSpan(Color.parseColor(accent)),
                2, 3, android.text.Spannable.SPAN_EXCLUSIVE_EXCLUSIVE,
            )
            text = spanned
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 36f * scale)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        val sub = TextView(this).apply {
            text = "Central de Downloads Automática"
            setTextColor(Color.parseColor("#99FFFFFF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f * scale)
            setPadding(0, dp((4 * scale).toInt()), 0, 0)
        }
        left.addView(header)
        left.addView(sub)

        // Bloco direito: pílulas de status
        val right = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            // Habilita animações de transição de layout (expansão suave)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.HONEYCOMB) {
                layoutTransition = android.animation.LayoutTransition().apply {
                    setDuration(250)
                    enableTransitionType(android.animation.LayoutTransition.CHANGING)
                }
            }
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            )
        }

        val system = makeStatusPill("🔍", "#E8A85C", scale).apply {
            isFocusable = true
            isClickable = true
            // Desativa a mudança de linha automática para permitir animação de largura
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
            
            setOnClickListener { checkOtaUpdate(this, true) }
            setOnFocusChangeListener { v, hasFocus ->
                val tv = v as TextView
                val bg = (tv.background as? GradientDrawable) ?: return@setOnFocusChangeListener
                
                if (hasFocus) {
                    bg.setColor(Color.parseColor("#335EE6A8"))
                    bg.setStroke(dp(2), Color.parseColor("#5EE6A8"))
                    
                    // Expande com texto e animação
                    tv.text = "🔍  Procurar atualizações"
                    tv.animate().alpha(1f).setDuration(200).start()
                } else {
                    bg.setColor(Color.parseColor("#1AFFFFFF"))
                    bg.setStroke(dp(1), Color.parseColor("#33FFFFFF"))
                    
                    // Retrai para apenas o ícone
                    tv.text = "🔍"
                }
            }
        }
        val clock = makeStatusPill("🕐  --:--", "#FFFFFF", scale)
        val date = makeStatusPill("📅  ---", "#FFFFFF", scale)
        val weather = makeStatusPill("🌥  --°C", "#FFFFFF", scale)
        val wifi = makeStatusPill("📶  Wi-Fi", "#5EE6A8", scale)

        val gap = dp((8 * scale).toInt())
        listOf(system, clock, date, weather, wifi).forEach { pill ->
            (pill.layoutParams as LinearLayout.LayoutParams).marginStart = gap
        }

        right.addView(system)
        right.addView(clock)
        right.addView(date)
        right.addView(weather)
        right.addView(wifi)

        clockView = clock
        dateView = date
        weatherView = weather
        wifiView = wifi
        otaStatusPill = system

        row.addView(left)
        row.addView(right)

        // Inicializa valores
        updateClockAndDate()
        refreshWeather()
        updateWifi(isNetworkOnline())
        // checkOtaUpdate removido daqui para desativar verificação automática pós-login
        // Só será possível verificar manualmente via clique no botão.

        return row
    }

    private fun makeStatusPill(text: String, accentHex: String, scale: Float): TextView {
        return TextView(this).apply {
            this.text = text
            setTextColor(Color.parseColor(accentHex))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f * scale)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            val bg = GradientDrawable().apply {
                setColor(Color.parseColor("#1AFFFFFF"))
                cornerRadius = dp((12 * scale).toInt()).toFloat()
                setStroke(dp(1), Color.parseColor("#33FFFFFF"))
            }
            background = bg
            val px = dp((14 * scale).toInt())
            val py = dp((10 * scale).toInt())
            setPadding(px, py, px, py)
            
            // Layout animável
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            
            // Ativa animações de layout automáticas no container pai se possível
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.HONEYCOMB) {
                // Configuração para permitir que o texto apareça suavemente
                animate().duration = 200
            }
        }
    }

    private fun updateClockAndDate() {
        val now = Date()
        clockView?.text = "🕐  " + SimpleDateFormat("HH:mm", Locale("pt", "BR")).format(now)
        val raw = SimpleDateFormat("EEE, dd 'De' MMM.", Locale("pt", "BR")).format(now)
        dateView?.text = "📅  " + capitalizeWords(raw)
    }

    private fun capitalizeWords(s: String): String =
        s.split(" ").joinToString(" ") { word ->
            if (word.isEmpty()) word
            else word.substring(0, 1).uppercase(Locale("pt", "BR")) + word.substring(1)
        }

    private fun refreshWeather() {
        scope.launch {
            val w = StatusInfo.fetchWeather()
            if (w != null) {
                weatherView?.text = "${w.emoji}  ${w.tempC}°C"
            }
        }
    }

    // ===================== REDE =====================

    private fun isNetworkOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        val net = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(net) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun updateWifi(online: Boolean) {
        wifiView?.post {
            val v = wifiView ?: return@post
            val iconRes = if (online) R.drawable.ic_wifi else R.drawable.ic_wifi_off
            val color = if (online) Color.parseColor("#5EE6A8") else Color.parseColor("#FF6B6B")
            v.text = if (online) "Wi-Fi" else "Sem rede"
            v.setTextColor(color)
            val icon = androidx.core.content.ContextCompat.getDrawable(this, iconRes)?.mutate()
            icon?.setTint(color)
            val size = dp(16)
            icon?.setBounds(0, 0, size, size)
            v.setCompoundDrawables(icon, null, null, null)
            v.compoundDrawablePadding = dp(6)
        }
    }

    private fun registerNetworkCallback() {
        if (networkCallback != null) return
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) { updateWifi(true) }
            override fun onLost(network: Network) { updateWifi(false) }
            override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                updateWifi(
                    caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                        caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
                )
            }
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                cm.registerDefaultNetworkCallback(cb)
            } else {
                val req = NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build()
                cm.registerNetworkCallback(req, cb)
            }
            networkCallback = cb
        } catch (_: Exception) {
        }
    }

    private fun unregisterNetworkCallback() {
        val cb = networkCallback ?: return
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        try { cm?.unregisterNetworkCallback(cb) } catch (_: Exception) {}
        networkCallback = null
    }

    // ===================== OTA =====================

    private fun checkOtaUpdate(systemPill: TextView, manual: Boolean = false) {
        scope.launch {
            val otaInfo = try {
                withContext(Dispatchers.IO) {
                    val url = "https://bunvyxogwpwiojzczgwl.supabase.co/storage/v1/object/public/tvapps-updates/update.json?t=${System.currentTimeMillis()}"
                    val client = okhttp3.OkHttpClient()
                    val res = client.newCall(okhttp3.Request.Builder().url(url).build()).execute()
                    res.use {
                        if (!it.isSuccessful) return@withContext null
                        val body = it.body?.string() ?: return@withContext null
                        val json = org.json.JSONObject(body)
                        // Aceita o novo schema (versionCode/versionName/apkUrl)
                        // e também o antigo (version/url) para retrocompatibilidade.
                        val remoteName = json.optString("versionName",
                            json.optString("version", ""))
                        val remoteCode = json.optLong("versionCode", -1L)
                        val downloadUrl = json.optString("apkUrl",
                            json.optString("url", ""))

                        val pkgInfo = try { packageManager.getPackageInfo(packageName, 0) } catch (_: Exception) { null }
                        val localName = pkgInfo?.versionName ?: ""
                        val localCode: Long = if (pkgInfo == null) 0L else {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) pkgInfo.longVersionCode
                            else @Suppress("DEPRECATION") pkgInfo.versionCode.toLong()
                        }

                        val hasUpdate = if (remoteCode > 0L) {
                            remoteCode > localCode
                        } else {
                            compareVersions(remoteName, localName) > 0
                        }
                        Triple(hasUpdate, remoteName, downloadUrl)
                    }
                }
            } catch (_: Exception) { null }

            if (otaInfo == null) {
                systemPill.text = if (systemPill.hasFocus()) "🔍  Procurar atualizações" else "🔍"
                systemPill.setTextColor(Color.parseColor("#FF6B6B"))
                if (manual) {
                    Toast.makeText(this@MainActivity, "Falha ao verificar atualizações (sem conexão)", Toast.LENGTH_SHORT).show()
                }
                return@launch
            }

            val (hasUpdate, remoteVersion, downloadUrl) = otaInfo

            if (hasUpdate) {
                systemPill.text = "⬇  Atualização disponível ($remoteVersion)"
                systemPill.setTextColor(Color.parseColor("#5EE6A8"))
                if (manual) {
                    showOtaConfirmDialog(remoteVersion, downloadUrl)
                }
            } else {
                systemPill.text = if (systemPill.hasFocus()) "🔍  Procurar atualizações" else "🔍"
                systemPill.setTextColor(Color.parseColor("#5EE6A8"))
                if (manual) {
                    Toast.makeText(this@MainActivity, "Você já está na versão mais recente", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun showOtaConfirmDialog(version: String, url: String) {
        if (url.isEmpty()) {
            Toast.makeText(this, "URL de atualização inválida", Toast.LENGTH_SHORT).show()
            return
        }
        val builder = AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
        builder.setTitle("Nova Atualização")
        builder.setMessage("Uma nova versão ($version) do TV.Apps está disponível. Deseja baixar e instalar agora?")
        builder.setPositiveButton("Baixar Agora") { dialog, _ ->
            dialog.dismiss()
            startLauncherUpdate(url)
        }
        builder.setNegativeButton("Mais Tarde") { dialog, _ ->
            dialog.dismiss()
        }
        builder.create().show()
    }

    private fun startLauncherUpdate(url: String) {
        val systemPill = otaStatusPill ?: return
        val originalText = systemPill.text
        
        scope.launch {
            ApkDownloader.download(this@MainActivity, url, "TV.Apps_Update").collect { p ->
                when (p) {
                    is DownloadProgress.Progress -> withContext(Dispatchers.Main) {
                        systemPill.text = "⬇  Baixando: ${p.percent}%"
                    }
                    is DownloadProgress.Done -> withContext(Dispatchers.Main) {
                        systemPill.text = "✓  Download concluído"
                        ApkInstaller.install(this@MainActivity, p.file)
                        systemPill.postDelayed({ systemPill.text = "✓  Sistema atualizado" }, 5000)
                    }
                    is DownloadProgress.Error -> withContext(Dispatchers.Main) {
                        systemPill.text = "⚠  Erro no download"
                        Toast.makeText(this@MainActivity, "Erro ao baixar atualização: ${p.message}", Toast.LENGTH_LONG).show()
                        systemPill.postDelayed({ systemPill.text = if (systemPill.hasFocus()) "🔍  Procurar atualizações" else "🔍" }, 3000)
                    }
                }
            }
        }
    }

    private fun compareVersions(a: String, b: String): Int {
        val pa = a.split(".").mapNotNull { it.toIntOrNull() }
        val pb = b.split(".").mapNotNull { it.toIntOrNull() }
        val len = maxOf(pa.size, pb.size)
        for (i in 0 until len) {
            val diff = (pa.getOrNull(i) ?: 0) - (pb.getOrNull(i) ?: 0)
            if (diff != 0) return diff
        }
        return 0
    }

    override fun onDestroy() {
        packageReceiver?.let { PackageInstallReceiver.unregister(this, it) }
        scope.cancel()
        statusHandler.removeCallbacksAndMessages(null)
        unregisterNetworkCallback()
        super.onDestroy()
    }

}