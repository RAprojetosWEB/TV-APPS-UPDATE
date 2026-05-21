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

        passwordInput.requestFocus()
        return root
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
            text = "Após o download, abra o arquivo APK e permita instalação de fontes desconhecidas"
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
            val size = (120 * scale).toInt()
            val lp = LinearLayout.LayoutParams(dp(size), dp(size))
            lp.bottomMargin = dp((24 * scale).toInt())
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
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 32f * scale)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
        }
        val subtitle = TextView(this).apply {
            text = app.description
            setTextColor(Color.parseColor("#99FFFFFF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f * scale)
            gravity = Gravity.CENTER
            setPadding(0, dp((12 * scale).toInt()), 0, dp((24 * scale).toInt()))
        }

        // Pill "INSTALAR"
        val pill = TextView(this).apply {
            text = "⬇  Baixar aplicativo"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f * scale)
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
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 44f * scale)
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
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            )
        }

        val system = makeStatusPill("⟳  Verificando sistema...", "#E8A85C", scale)
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

        row.addView(left)
        row.addView(right)

        // Inicializa valores
        updateClockAndDate()
        refreshWeather()
        updateWifi(isNetworkOnline())
        checkOtaUpdate(system)

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
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            )
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
            if (online) {
                wifiView?.text = "📶  Wi-Fi"
                wifiView?.setTextColor(Color.parseColor("#5EE6A8"))
            } else {
                wifiView?.text = "⚠  Sem rede"
                wifiView?.setTextColor(Color.parseColor("#FF6B6B"))
            }
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

    private fun checkOtaUpdate(systemPill: TextView) {
        scope.launch {
            val updated = try {
                withContext(Dispatchers.IO) {
                    val url = "https://bunvyxogwpwiojzczgwl.supabase.co/storage/v1/object/public/tvapps-updates/update.json?t=${System.currentTimeMillis()}"
                    val client = okhttp3.OkHttpClient()
                    val res = client.newCall(okhttp3.Request.Builder().url(url).build()).execute()
                    res.use {
                        if (!it.isSuccessful) return@withContext null
                        val body = it.body?.string() ?: return@withContext null
                        val json = org.json.JSONObject(body)
                        val remote = json.optString("version", "")
                        val local = try { packageManager.getPackageInfo(packageName, 0).versionName ?: "" } catch (_: Exception) { "" }
                        compareVersions(remote, local) > 0
                    }
                }
            } catch (_: Exception) { null }

            when (updated) {
                true -> {
                    systemPill.text = "⬇  Atualização disponível"
                    systemPill.setTextColor(Color.parseColor("#5EE6A8"))
                }
                false -> {
                    systemPill.text = "✓  Sistema atualizado"
                    systemPill.setTextColor(Color.parseColor("#5EE6A8"))
                }
                null -> {
                    systemPill.text = "⚠  Sem conexão"
                    systemPill.setTextColor(Color.parseColor("#FF6B6B"))
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
        scope.cancel()
        statusHandler.removeCallbacksAndMessages(null)
        unregisterNetworkCallback()
        super.onDestroy()
    }
}