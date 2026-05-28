package com.tvapps.launcher

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Color
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.AlphaAnimation
import android.view.animation.Animation
import android.view.inputmethod.InputMethodManager
import android.widget.FrameLayout
import android.widget.GridLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
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
import java.io.File

import android.view.SoundEffectConstants
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

private const val VERIFY_PASSWORD_ENDPOINT =
    "https://tv-apps-update.lovable.app/api/public/verify-launcher-password"
// Senha de emergência usada APENAS quando a TV está offline / servidor inacessível.
// Quando há rede, vale somente a senha definida no admin (banco).
private const val FALLBACK_LAUNCHER_PASSWORD = "1555"

private enum class VerifyResult { OK, WRONG, NETWORK_ERROR }

private fun verifyLauncherPasswordRemote(password: String): VerifyResult {
    return try {
        val conn = (URL(VERIFY_PASSWORD_ENDPOINT).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 5000
            readTimeout = 5000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
        }
        val payload = JSONObject().put("password", password).toString()
        conn.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
        val code = conn.responseCode
        if (code !in 200..299) {
            conn.disconnect()
            return VerifyResult.NETWORK_ERROR
        }
        val body = conn.inputStream.bufferedReader().use { it.readText() }
        conn.disconnect()
        val ok = JSONObject(body).optBoolean("ok", false)
        if (ok) VerifyResult.OK else VerifyResult.WRONG
    } catch (e: Exception) {
        android.util.Log.e("MainActivity", "verifyLauncherPasswordRemote failed: ${e.message}", e)
        VerifyResult.NETWORK_ERROR
    }
}

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
    private var settingsPill: TextView? = null
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
    private var packageReceiver: PackageInstallReceiver? = null

    // Monitor de rede em tempo real + ícone de status
    private var networkMonitor: NetworkMonitor? = null
    private var loginWifiIcon: ImageView? = null
    private var lastNetworkState: NetworkMonitor.State = NetworkMonitor.State.OFFLINE

    // APK aguardando instalação após usuário conceder permissão "Instalar apps desconhecidos"
    private var pendingInstallApk: File? = null
    private var activeOverlay: View? = null
    private var pendingFocusAddDock = false




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

    private data class OtaProgressViews(
        val button: TextView,
        val progress: ProgressBar,
        val percent: TextView,
        val speed: TextView,
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
        )
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN)
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
        setupWebViewBridge()
        // Mostra splash screen antes do login
        setContentView(buildSplashScreen())
        Handler(Looper.getMainLooper()).postDelayed({
            setContentView(buildLoginScreen())
        }, 3500)

        // Catálogo remoto: usa cache imediatamente, depois refresca em background.
        // Quando o usuário clicar ENTRAR (após splash de 3.5s), os cards usarão
        // a versão mais recente disponível.
        RemoteCatalog.loadCached(this)?.let { cached ->
            if (cached.isNotEmpty()) AppCatalog.apps = cached
        }
        Thread {
            try {
                val fresh = RemoteCatalog.fetchSync(this)
                if (fresh != null && fresh.isNotEmpty()) {
                    AppCatalog.apps = fresh
                }
            } catch (_: Exception) {
            }
        }.start()

        // Limpeza inicial do cache de APKs (apps já instalados + órfãos + limite)
        try {
            ApkCache.cleanupInstalled(this, AppCatalog.apps)
            ApkCache.enforceSizeLimit(this)
        } catch (_: Exception) {
        }

        setupPackageReceiver()

        // Monitor de rede em tempo real (callback do sistema, sem polling)
        networkMonitor = NetworkMonitor(this)
    }

    private fun buildSplashScreen(): View {
        val density = resources.displayMetrics.density
        fun dp(v: Int) = (v * density).toInt()

        // Cor de fundo idêntica à web (--background: oklch(0.16 0.03 270))
        val bgColor = Color.parseColor("#0d0820")
        // Verde idêntico ao da web (oklch(0.78 0.18 155))
        val green = Color.parseColor("#2dd4a8")

        val root = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            setBackgroundColor(bgColor)
        }

        // Glow radial verde central (equivalente ao radial-gradient com blur)
        val glow = View(this).apply {
            val size = (resources.displayMetrics.widthPixels.coerceAtLeast(
                resources.displayMetrics.heightPixels
            ) * 0.9f).toInt()
            val drawable = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                gradientType = GradientDrawable.RADIAL_GRADIENT
                gradientRadius = size / 2f
                colors = intArrayOf(
                    Color.parseColor("#5928c47a"), // ~35% alpha do verde
                    Color.parseColor("#1928c47a"),
                    Color.TRANSPARENT,
                )
            }
            background = drawable
            layoutParams = FrameLayout.LayoutParams(size, size, Gravity.CENTER)
        }
        root.addView(glow)

        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
        }

        // Título gigante: TV.Apps com "." verde
        val title = TextView(this).apply {
            text = android.text.SpannableString("TV.Apps").apply {
                setSpan(
                    android.text.style.ForegroundColorSpan(green),
                    2, 3,
                    android.text.Spannable.SPAN_EXCLUSIVE_EXCLUSIVE,
                )
            }
            setTextColor(Color.WHITE)
            // clamp(4rem, 14vw, 10rem) ~ 14% da largura da tela, limitado
            val px = (resources.displayMetrics.widthPixels * 0.14f)
                .coerceIn(64f * density, 140f * density)
            setTextSize(TypedValue.COMPLEX_UNIT_PX, px)
            typeface = android.graphics.Typeface.create(
                android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD
            )
            gravity = Gravity.CENTER
            includeFontPadding = false
            // text-shadow: 0 0 60px verde
            setShadowLayer(60f, 0f, 0f, Color.parseColor("#992dd4a8"))
        }

        val subtitle = TextView(this).apply {
            text = "A maneira mais fácil de baixar apps"
            setTextColor(Color.parseColor("#b3ffffff"))
            val px = (resources.displayMetrics.widthPixels * 0.022f)
                .coerceIn(16f * density, 28f * density)
            setTextSize(TypedValue.COMPLEX_UNIT_PX, px)
            gravity = Gravity.CENTER
            letterSpacing = 0.04f
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = dp(24) }
        }

        column.addView(title)
        column.addView(subtitle)
        root.addView(column)

        // Fade-in + zoom-in (animate-in fade-in / zoom-in-95)
        root.alpha = 0f
        root.animate().alpha(1f).setDuration(500).start()
        column.scaleX = 0.95f
        column.scaleY = 0.95f
        column.animate().scaleX(1f).scaleY(1f).setDuration(700).start()

        return root
    }

    private fun setupPackageReceiver() {
        packageReceiver = PackageInstallReceiver { packageName ->
            // Busca o app no catálogo que corresponde ao package instalado.
            // Usamos isInstalled para garantir que a heurística rode e "aprenda" o pacote se necessário.
            val app = AppCatalog.apps.find { app ->
                InstalledRegistry.isInstalled(this, app) && InstalledRegistry.resolvePackage(this, app) == packageName
            }

            if (app != null) {
                ApkCache.deleteFor(this, app.name)
                runOnUiThread {
                    Toast.makeText(this, "Instalação concluída. Arquivo temporário removido.", Toast.LENGTH_LONG).show()
                    // Atualiza todos os cards para garantir que o estado reflita a mudança
                    cardViews.forEachIndexed { index, views ->
                        refreshInstalledState(views, AppCatalog.apps[index])
                    }
                }
            } else {
                // Caso não encontre mapeamento direto, atualiza tudo por segurança
                runOnUiThread {
                    cardViews.forEachIndexed { index, views ->
                        refreshInstalledState(views, AppCatalog.apps[index])
                    }
                }
            }
        }
        PackageInstallReceiver.register(this, packageReceiver!!)
    }




    override fun onResume() {
        super.onResume()
        // Se há um APK aguardando instalação e a permissão já foi concedida,
        // dispara o instalador automaticamente ao voltar das Configurações.
        pendingInstallApk?.also { apk ->
            val canInstall = Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
                packageManager.canRequestPackageInstalls()
            if (canInstall && apk.exists()) {
                pendingInstallApk = null
                ApkInstaller.install(this, apk)
            } else if (apk.exists()) {
                // Em algumas TV boxes a permissão demora alguns instantes para
                // ser reconhecida após o usuário voltar das Configurações.
                // Tenta de novo após um pequeno atraso antes de desistir.
                Handler(Looper.getMainLooper()).postDelayed({
                    val pending = pendingInstallApk ?: return@postDelayed
                    val canNow = Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
                        packageManager.canRequestPackageInstalls()
                    if (canNow && pending.exists()) {
                        pendingInstallApk = null
                        ApkInstaller.install(this, pending)
                    }
                }, 600)
            }
        }
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
    }

    override fun onPause() {
        super.onPause()
        statusHandler.removeCallbacks(clockTicker)
        statusHandler.removeCallbacks(weatherTicker)
    }

    override fun onStart() {
        super.onStart()
        // Estado inicial conservador antes do primeiro evento real
        applyNetworkState(NetworkMonitor.State.OFFLINE)
        networkMonitor?.start { state -> applyNetworkState(state) }
    }

    override fun onStop() {
        networkMonitor?.stop()
        super.onStop()
    }

    override fun onBackPressed() {
        val root = findViewById<ViewGroup>(android.R.id.content)
        val lastChild = if (root.childCount > 0) root.getChildAt(root.childCount - 1) else null
        
        // Verifica se o topo é um overlay (nossos overlays são FrameLayout clicáveis)
        if (lastChild is FrameLayout && lastChild.isClickable && lastChild != findViewById(android.R.id.content)) {
            root.removeView(lastChild)
            val newLast = if (root.childCount > 0) root.getChildAt(root.childCount - 1) else null
            activeOverlay = if (newLast is FrameLayout && newLast.isClickable) newLast else null
            
            // Se voltamos para a tela principal, recarrega para mostrar favoritos novos
            if (activeOverlay == null) {
                setContentView(buildRoot())
            }
        } else {
            super.onBackPressed()
        }
    }


    private fun applyNetworkState(state: NetworkMonitor.State) {
        lastNetworkState = state
        val res = when (state) {
            NetworkMonitor.State.OFFLINE -> R.drawable.ic_wifi_off
            NetworkMonitor.State.WIFI_LEVEL_1 -> R.drawable.ic_wifi_1
            NetworkMonitor.State.WIFI_LEVEL_2 -> R.drawable.ic_wifi_2
            NetworkMonitor.State.WIFI_LEVEL_3 -> R.drawable.ic_wifi_3
            NetworkMonitor.State.WIFI_LEVEL_4 -> R.drawable.ic_wifi_4
            NetworkMonitor.State.WIFI_NO_INTERNET -> R.drawable.ic_wifi_alert
            NetworkMonitor.State.ETHERNET -> R.drawable.ic_ethernet
            NetworkMonitor.State.ETHERNET_NO_INTERNET -> R.drawable.ic_ethernet_alert
        }
        loginWifiIcon?.let { iv ->
            // Limpa o tint branco aplicado em makeIconButton para preservar
            // as cores originais do vetor (ex.: badge amarelo do alerta).
            iv.clearColorFilter()
            iv.setImageResource(res)
        }
        // Pílula única de Wi-Fi na barra superior (ícone + texto + cor).
        wifiView?.let { v ->
            val label = when (state) {
                NetworkMonitor.State.OFFLINE -> "Sem rede"
                NetworkMonitor.State.WIFI_NO_INTERNET -> "Sem internet"
                NetworkMonitor.State.ETHERNET -> "Ethernet"
                NetworkMonitor.State.ETHERNET_NO_INTERNET -> "Sem internet"
                else -> "Wi-Fi"
            }
            val color = when (state) {
                NetworkMonitor.State.OFFLINE,
                NetworkMonitor.State.WIFI_NO_INTERNET,
                NetworkMonitor.State.ETHERNET_NO_INTERNET -> Color.parseColor("#FF6B6B")
                else -> Color.parseColor("#5EE6A8")
            }
            v.text = label
            v.setTextColor(color)
            val icon = androidx.core.content.ContextCompat.getDrawable(this, res)?.mutate()
            // Mantém cores originais do vetor para alerta/ethernet; nos demais aplica cor da pílula.
            if (state != NetworkMonitor.State.WIFI_NO_INTERNET &&
                state != NetworkMonitor.State.ETHERNET_NO_INTERNET) {
                icon?.setTint(color)
            }
            val size = dp(16)
            icon?.setBounds(0, 0, size, size)
            v.setCompoundDrawables(icon, null, null, null)
            v.compoundDrawablePadding = dp(6)
        }
    }

    private fun buildLoginScreen(): View {
        val dm = resources.displayMetrics
        val widthDp = dm.widthPixels / dm.density
        val scaleFactor = (widthDp / 1280f).coerceIn(0.7f, 1.3f)

        val root = FrameLayout(this).apply {
            background = makeRootBackground()
            isFocusable = true
            isFocusableInTouchMode = true
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            clipChildren = false
            clipToPadding = false
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
            // Força o overlay a renderizar acima do card de login (que tem elevation pelo glow).
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                elevation = dp(100).toFloat()
            }
            val pad = dp(48)
            setPadding(pad, pad, pad, pad)
        }

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            clipChildren = false
            clipToPadding = false
        }

        // Card wrapper (igual ao card da versão web: fundo translúcido,
        // borda sutil e glow verde ao redor).
        val cardPadding = dp((40 * scaleFactor).toInt())
        val cardMaxWidth = dp((420 * scaleFactor).toInt())
        val screenSideMargin = dp(24)
        val cardWidth = minOf(cardMaxWidth, dm.widthPixels - screenSideMargin * 2)

        val cardBg = GradientDrawable().apply {
            setColor(Color.parseColor("#66000000"))
            cornerRadius = dp(24).toFloat()
            setStroke(dp(1), Color.parseColor("#1AFFFFFF"))
        }

        val cardWrapper = FrameLayout(this).apply {
            background = cardBg
            setPadding(cardPadding, cardPadding, cardPadding, cardPadding)
            layoutParams = FrameLayout.LayoutParams(
                cardWidth,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { gravity = Gravity.CENTER }
            clipChildren = false
            clipToPadding = false
            // Glow verde discreto (API 28+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                elevation = dp(24).toFloat()
                outlineSpotShadowColor = Color.parseColor("#4ade80")
                outlineAmbientShadowColor = Color.parseColor("#4ade80")
            }
        }

        // Logo TV.Apps (igual à versão web)
        val logo = TextView(this).apply {
            val spannable = android.text.SpannableString("TV.Apps")
            spannable.setSpan(
                android.text.style.ForegroundColorSpan(Color.parseColor("#4ade80")),
                2, 3,
                android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            )
            text = spannable
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 44f * scaleFactor)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(0, 0, 0, dp((24 * scaleFactor).toInt()))
            gravity = Gravity.CENTER
        }

        val title = TextView(this).apply {
            text = "Bem-vindo"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f * scaleFactor)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(0, 0, 0, dp((8 * scaleFactor).toInt()))
            gravity = Gravity.CENTER
        }

        val subtitle = TextView(this).apply {
            text = "Digite a senha e clique em Entrar para continuar"
            setTextColor(Color.parseColor("#99FFFFFF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f * scaleFactor)
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
            val py = dp((13 * scaleFactor).toInt())
            setPadding(px, py, px, py)
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(dp((300 * scaleFactor).toInt()), ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        passwordInput.isFocusable = true
        passwordInput.isFocusableInTouchMode = true
        passwordInput.setOnFocusChangeListener { v, hasFocus ->
            v.background = makeCardBg(hasFocus, scaleFactor)
            if (hasFocus) {
                v.animate().scaleX(1.04f).scaleY(1.04f).setDuration(150).start()
                v.elevation = dp(6).toFloat()
            } else {
                v.animate().scaleX(1f).scaleY(1f).setDuration(150).start()
                v.elevation = 0f
            }
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
            val py = dp((14 * scaleFactor).toInt())
            setPadding(px, py, px, py)
            val lp = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            lp.topMargin = dp((24 * scaleFactor).toInt())
            layoutParams = lp

            setOnFocusChangeListener { v, hasFocus ->
                v.background = makePillBg(hasFocus, scaleFactor)
                (v as TextView).setTextColor(if (hasFocus) Color.parseColor("#15102A") else Color.WHITE)
                if (hasFocus) {
                    v.animate().scaleX(1.08f).scaleY(1.08f).setDuration(180).start()
                    v.elevation = dp(8).toFloat()
                    (v as TextView).setShadowLayer(24f, 0f, 0f, Color.parseColor("#992dd4a8"))
                } else {
                    v.animate().scaleX(1f).scaleY(1f).setDuration(180).start()
                    v.elevation = 0f
                    (v as TextView).setShadowLayer(0f, 0f, 0f, Color.TRANSPARENT)
                }
            }

            setOnClickListener {
                val typed = passwordInput.text.toString().trim()
                val btn = this
                if (typed.isEmpty()) {
                    Toast.makeText(this@MainActivity, "Digite a senha", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                // Bloqueia clique duplo enquanto verifica e dá feedback visual.
                val originalText = btn.text
                btn.isClickable = false
                btn.text = "VERIFICANDO…"
                scope.launch {
                    val result = withContext(Dispatchers.IO) {
                        verifyLauncherPasswordRemote(typed)
                    }
                    btn.isClickable = true
                    btn.text = originalText
                    val ok = when (result) {
                        VerifyResult.OK -> true
                        VerifyResult.WRONG -> false
                        // Offline / erro de rede: fallback para a senha de emergência.
                        VerifyResult.NETWORK_ERROR -> typed == FALLBACK_LAUNCHER_PASSWORD
                    }
                    if (ok) {
                        isUnlocked = true
                        setContentView(buildRoot())
                    } else {
                        val message = when (result) {
                            VerifyResult.WRONG -> "Senha incorreta"
                            VerifyResult.NETWORK_ERROR -> "Erro de conexão com o servidor"
                            else -> "Erro desconhecido"
                        }
                        Toast.makeText(this@MainActivity, message, Toast.LENGTH_SHORT).show()
                        passwordInput.text.clear()
                    }
                }
            }
        }

        container.addView(logo)
        container.addView(title)
        container.addView(subtitle)
        container.addView(passwordInput)
        container.addView(loginButton)

        // Linha de ícones rápidos: ⚙️ Configurações  📶 Rede
        val quickActions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            val lp = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            lp.topMargin = dp((20 * scaleFactor).toInt())
            layoutParams = lp
            clipChildren = false
            clipToPadding = false
        }

        val iconSize = dp((52 * scaleFactor).toInt())
        val iconGap = dp((16 * scaleFactor).toInt())

        fun makeIconButton(label: String, drawableRes: Int, onTap: () -> Unit): FrameLayout {
            val wrapper = FrameLayout(this).apply {
                isFocusable = true
                isClickable = true
                contentDescription = label
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#1AFFFFFF"))
                    cornerRadius = dp((14 * scaleFactor).toInt()).toFloat()
                    setStroke(dp(2), Color.parseColor("#33FFFFFF"))
                }
                layoutParams = LinearLayout.LayoutParams(iconSize, iconSize).apply {
                    marginStart = iconGap / 2
                    marginEnd = iconGap / 2
                }
                setOnFocusChangeListener { v, hasFocus ->
                    val bg = v.background as? GradientDrawable ?: return@setOnFocusChangeListener
                    if (hasFocus) {
                        bg.setColor(Color.parseColor("#33FFFFFF"))
                        bg.setStroke(dp(2), Color.parseColor("#FFFFFF"))
                        v.animate().scaleX(1.08f).scaleY(1.08f).setDuration(150).start()
                    } else {
                        bg.setColor(Color.parseColor("#1AFFFFFF"))
                        bg.setStroke(dp(2), Color.parseColor("#33FFFFFF"))
                        v.animate().scaleX(1f).scaleY(1f).setDuration(150).start()
                    }
                }
                setOnClickListener { onTap() }
            }
            val iv = ImageView(this).apply {
                setImageResource(drawableRes)
                setColorFilter(Color.WHITE)
                val s = (iconSize * 0.5f).toInt()
                layoutParams = FrameLayout.LayoutParams(s, s).apply {
                    gravity = Gravity.CENTER
                }
            }
            wrapper.addView(iv)
            return wrapper
        }

        val settingsBtn = makeIconButton("Configurações", R.drawable.ic_settings) {
            openSystemSettings()
        }
        val wifiBtn = makeIconButton("Wi-Fi", R.drawable.ic_wifi) {
            openNetworkSettings()
        }
        // Reaproveita o ImageView interno do botão Wi-Fi para refletir o estado
        // real da rede (mesmos drawables usados pelo ícone de status da home).
        loginWifiIcon = wifiBtn.getChildAt(0) as? ImageView
        // Reaplica o último estado conhecido para o ícone novo
        // (o monitor só notifica em mudanças, então sem isso o ícone ficaria parado).
        applyNetworkState(lastNetworkState)

        quickActions.addView(settingsBtn)
        quickActions.addView(wifiBtn)
        container.addView(quickActions)

        cardWrapper.addView(container)
        root.addView(cardWrapper)
        root.addView(updateOverlay)

        val footerNotice = TextView(this).apply {
            text = "Acesso restrito a clientes. Peça o acesso no WhatsApp 14 99868-1696"
            setTextColor(Color.parseColor("#66FFFFFF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f * scaleFactor)
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.TOP
                topMargin = dp((16 * scaleFactor).toInt())
            }
        }
        root.addView(footerNotice)
        root.requestFocus()

        // Verificação automática de OTA ANTES do login. O campo de senha só ganha foco
        // depois dessa checagem para não abrir teclado virtual quando houver atualização.
        checkOtaUpdateBlocking(updateOverlay, passwordInput, scaleFactor)

        return root
    }

    private fun hideSoftKeyboardAndClearFocus() {
        val focused = currentFocus ?: window.decorView
        try {
            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
            imm?.hideSoftInputFromWindow(focused.windowToken, 0)
        } catch (_: Exception) {
        }
        focused.clearFocus()
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN)
    }

    private fun isTextInputFocused(): Boolean = currentFocus is android.widget.EditText

    private fun checkOtaUpdateBlocking(overlay: LinearLayout, passwordInput: android.widget.EditText, scale: Float) {
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
                    hideSoftKeyboardAndClearFocus()
                    overlay.visibility = View.VISIBLE
                    // O overlay NÃO deve ser focável — senão ele rouba o foco
                    // do botão "ATUALIZAR AGORA" e o D-pad não consegue chegar nele.
                    overlay.isFocusable = false
                    overlay.isFocusableInTouchMode = false
                    overlay.descendantFocusability = ViewGroup.FOCUS_AFTER_DESCENDANTS
                    overlay.removeAllViews()

                    // Esconde o card de login e o rodapé enquanto a atualização é obrigatória,
                    // para não ficarem "vazando" por trás do overlay (o card de login tem
                    // elevation por causa do glow verde e, sem isso, aparece sobreposto).
                    val parent = overlay.parent as? FrameLayout
                    parent?.let { p ->
                        for (i in 0 until p.childCount) {
                            val child = p.getChildAt(i)
                            if (child !== overlay) child.visibility = View.GONE
                        }
                    }

                    // Card com glow âmbar (igual versão web)
                    val amber = Color.parseColor("#F59E0B")
                    val cardBg = GradientDrawable().apply {
                        setColor(Color.parseColor("#66000000"))
                        cornerRadius = dp((24 * scale).toInt()).toFloat()
                        setStroke(dp(1), Color.parseColor("#33F59E0B"))
                    }
                    val card = LinearLayout(this@MainActivity).apply {
                        orientation = LinearLayout.VERTICAL
                        gravity = Gravity.CENTER
                        background = cardBg
                        val pad = dp((40 * scale).toInt())
                        setPadding(pad, pad, pad, pad)
                        layoutParams = LinearLayout.LayoutParams(
                            dp((420 * scale).toInt()),
                            ViewGroup.LayoutParams.WRAP_CONTENT
                        )
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            elevation = dp(24).toFloat()
                            outlineSpotShadowColor = amber
                            outlineAmbientShadowColor = amber
                        }
                    }

                    // Quadrado âmbar com ícone ⚠ dentro (igual web)
                    val iconBoxBg = GradientDrawable().apply {
                        setColor(Color.parseColor("#33F59E0B"))
                        cornerRadius = dp((16 * scale).toInt()).toFloat()
                    }
                    val iconBoxSize = dp((80 * scale).toInt())
                    val warnIcon = TextView(this@MainActivity).apply {
                        text = "⚠"
                        setTextColor(amber)
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 40f * scale)
                        gravity = Gravity.CENTER
                        background = iconBoxBg
                        layoutParams = LinearLayout.LayoutParams(iconBoxSize, iconBoxSize).apply {
                            bottomMargin = dp((24 * scale).toInt())
                        }
                    }

                    val title = TextView(this@MainActivity).apply {
                        text = "Atualização Obrigatória"
                        setTextColor(Color.WHITE)
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f * scale)
                        setTypeface(null, android.graphics.Typeface.BOLD)
                        gravity = Gravity.CENTER
                        setPadding(0, 0, 0, dp((16 * scale).toInt()))
                    }

                    val msg = TextView(this@MainActivity).apply {
                        text = "Uma nova versão ($remoteVersion) está disponível.\nAtualize para continuar acessando o app."
                        setTextColor(Color.parseColor("#CCFFFFFF"))
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f * scale)
                        gravity = Gravity.CENTER
                        setPadding(0, 0, 0, dp((32 * scale).toInt()))
                    }

                    val progress = ProgressBar(this@MainActivity, null, android.R.attr.progressBarStyleHorizontal).apply {
                        max = 100
                        progress = 0
                        visibility = View.GONE
                        progressDrawable = makeProgressDrawable(scale, amber)
                        layoutParams = LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            dp((12 * scale).toInt()),
                        ).apply { bottomMargin = dp((14 * scale).toInt()) }
                    }

                    val percent = TextView(this@MainActivity).apply {
                        text = "0%"
                        setTextColor(amber)
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 34f * scale)
                        setTypeface(null, android.graphics.Typeface.BOLD)
                        gravity = Gravity.CENTER
                        visibility = View.GONE
                    }

                    val speed = TextView(this@MainActivity).apply {
                        text = "Velocidade: —"
                        setTextColor(Color.parseColor("#CCFFFFFF"))
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f * scale)
                        gravity = Gravity.CENTER
                        setPadding(0, dp((4 * scale).toInt()), 0, dp((18 * scale).toInt()))
                        visibility = View.GONE
                    }

                    // Botão âmbar (igual web)
                    val btnBg = GradientDrawable().apply {
                        setColor(amber)
                        cornerRadius = dp((16 * scale).toInt()).toFloat()
                    }
                    val btnBgFocus = GradientDrawable().apply {
                        setColor(Color.parseColor("#FBBF24"))
                        cornerRadius = dp((16 * scale).toInt()).toFloat()
                        setStroke(dp(3), Color.WHITE)
                    }
                    val btn = TextView(this@MainActivity).apply {
                        text = "ATUALIZAR AGORA"
                        setTextColor(Color.BLACK)
                        background = btnBg
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f * scale)
                        setTypeface(null, android.graphics.Typeface.BOLD)
                        gravity = Gravity.CENTER
                        isFocusable = true
                        isClickable = true
                        val px = dp((48 * scale).toInt())
                        val py = dp((20 * scale).toInt())
                        setPadding(px, py, px, py)
                        layoutParams = LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.WRAP_CONTENT
                        )

                        setOnFocusChangeListener { v, hasFocus ->
                            v.background = if (hasFocus) btnBgFocus else btnBg
                        }

                        setOnClickListener {
                            if (downloadUrl.isEmpty()) {
                                Toast.makeText(this@MainActivity, "URL de atualização inválida", Toast.LENGTH_SHORT).show()
                            } else {
                                startLauncherUpdate(downloadUrl, OtaProgressViews(this, progress, percent, speed))
                            }
                        }
                    }

                    card.addView(warnIcon)
                    card.addView(title)
                    card.addView(msg)
                    card.addView(progress)
                    card.addView(percent)
                    card.addView(speed)
                    card.addView(btn)
                    overlay.addView(card)
                    // Foca diretamente no botão para que o controle remoto já o ative.
                    btn.post { btn.requestFocus() }
                }
            } else {
                runOnUiThread {
                    if (overlay.visibility != View.VISIBLE && !isTextInputFocused()) {
                        passwordInput.requestFocus()
                    }
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
                fun openSettings() {
                    try {
                        startActivity(Intent(android.provider.Settings.ACTION_SETTINGS))
                    } catch (e: Exception) {
                        // ignore
                    }
                }

                @JavascriptInterface
                fun installApk(url: String, name: String) {
                    if (name == "TV.Apps") {
                        runOnUiThread { startLauncherUpdate(url) }
                        return
                    }
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
        // Tela de login foi descartada — o ImageView de Wi-Fi do login não existe mais.
        loginWifiIcon = null
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
            clipChildren = false
            clipToPadding = false
        }

        // Cabeçalho: logo+subtitulo à esquerda, barra de status à direita
        root.addView(buildTopBar(scaleFactor))

        val cardWidth = (300 * scaleFactor).toInt()
        val cardHeight = (357 * scaleFactor).toInt()
        val cardMargin = (20 * scaleFactor).toInt()

        // Linha de cards centralizada com navegação infinita
        val row = object : LinearLayout(this) {
            override fun focusSearch(focused: View, direction: Int): View? {
                val currentIdx = cardViews.indexOfFirst { it.container == focused }
                if (currentIdx != -1) {
                    // Pula cards bloqueados (que têm isFocusable=false). Sem wrap circular:
                    // para nas bordas (primeiro/último card).
                    val total = cardViews.size
                    fun nextFocusable(start: Int, step: Int): View? {
                        var i = start + step
                        while (i in 0 until total) {
                            val view = cardViews[i].container
                            if (view.isFocusable && view != focused) return view
                            i += step
                        }
                        return null
                    }
                    if (direction == View.FOCUS_RIGHT) {
                        return nextFocusable(currentIdx, 1) ?: super.focusSearch(focused, direction)
                    }
                    if (direction == View.FOCUS_LEFT) {
                        return nextFocusable(currentIdx, -1) ?: super.focusSearch(focused, direction)
                    }
                }
                return super.focusSearch(focused, direction)
            }
        }.apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            clipChildren = false
            clipToPadding = false
            setPadding(0, dp((20 * scaleFactor).toInt()), 0, dp((20 * scaleFactor).toInt()))
        }

        val favorites = LauncherSettings.getFavorites(this)
        val displayedApps = AppCatalog.apps.toMutableList()
        val pm = packageManager
        
        favorites.forEach { pkg ->
            if (AppCatalog.apps.none { it.packageName == pkg }) {
                try {
                    val info = pm.getApplicationInfo(pkg, 0)
                    displayedApps.add(CatalogApp(
                        name = pm.getApplicationLabel(info).toString(),
                        description = "Aplicativo favorito",
                        url = "",
                        icon = "",
                        packageName = pkg,
                        iconRes = 0
                    ))
                } catch (_: Exception) {}
            }
        }

        displayedApps.forEachIndexed { index, app ->
            val card = buildCard(index, app, cardWidth, cardHeight, cardMargin, scaleFactor)
            row.addView(card.container)
            cardViews.add(card)

            // Atualiza estado inicial do botão + chip "INSTALADO"
            refreshInstalledState(card, app)
        }

        // HorizontalScrollView para permitir rolagem quando há mais cards
        // do que cabem na tela (5+ cards). O foco do controle remoto centraliza
        // o card focado automaticamente.
        val scroller = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            isFillViewport = true
            overScrollMode = View.OVER_SCROLL_NEVER
            clipChildren = false
            clipToPadding = false
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f,
            )
            addView(row)
        }
        root.addView(scroller)

        // Centraliza o card focado dentro do scroller ao navegar com D-pad.
        // Rolagem suave customizada: o smoothScrollTo padrão é curto (~250ms)
        // e linear, parecendo "duro". Animamos scrollX com desaceleração para
        // ficar fluido. Guardamos o animator atual para cancelar se o foco
        // mudar rapidamente (evita travadas no D-pad).
        var currentScrollAnim: android.animation.ObjectAnimator? = null
        cardViews.forEach { card ->
            val view = card.container
            val previous = view.onFocusChangeListener
            view.setOnFocusChangeListener { v, hasFocus ->
                previous?.onFocusChange(v, hasFocus)
                if (hasFocus) {
                    v.post {
                        val scrollerWidth = scroller.width
                        if (scrollerWidth <= 0) return@post
                        val cardCenter = v.left + v.width / 2
                        val target = (cardCenter - scrollerWidth / 2)
                            .coerceAtLeast(0)
                            .coerceAtMost((row.width - scrollerWidth).coerceAtLeast(0))
                        if (target == scroller.scrollX) return@post
                        currentScrollAnim?.cancel()
                        currentScrollAnim = android.animation.ObjectAnimator
                            .ofInt(scroller, "scrollX", scroller.scrollX, target)
                            .apply {
                                duration = 450
                                interpolator = android.view.animation.DecelerateInterpolator(1.6f)
                                start()
                            }
                    }
                }
            }
        }

        // Garante que "baixo" a partir das pílulas da topbar caia sempre no primeiro card
        cardViews.firstOrNull()?.container?.let { firstCard ->
            if (firstCard.id == View.NO_ID) firstCard.id = View.generateViewId()
            otaStatusPill?.nextFocusDownId = firstCard.id
            settingsPill?.nextFocusDownId = firstCard.id
        }

        // Barra de acesso rápido (Dock)
        root.addView(buildDock(scaleFactor))


        // Foca o primeiro card não-bloqueado.
        val firstFocusable = cardViews.firstOrNull { it.container.isFocusable }
        firstFocusable?.container?.post { firstFocusable.container.requestFocus() }
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
        if (app.isBlocked) {
            return buildBlockedCard(app, width, height, margin, scale)
        }
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
            scaleType = ImageView.ScaleType.FIT_CENTER
            val pad = dp((10 * scale).toInt())
            setPadding(pad, pad, pad, pad)
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ).apply { gravity = Gravity.CENTER }
        }
        val remoteIcon = app.iconUrl
        if (!remoteIcon.isNullOrBlank()) {
            RemoteIconLoader.loadInto(this, iconImage, remoteIcon, app.iconRes)
        } else if (app.iconRes != 0) {
            iconImage.setImageResource(app.iconRes)
        } else {
            // Fallback: carregar ícone do sistema para apps favoritos
            try {
                val pm = packageManager
                val icon = pm.getApplicationIcon(app.packageName)
                iconImage.setImageDrawable(icon)
            } catch (e: Exception) {
                // Fallback final se o pacote não for encontrado
                iconImage.setImageResource(R.drawable.ic_unitv)
            }
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
            text = "Baixar aplicativo"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f * scale)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            background = makePillBg(false, scale)
            val px = (32 * scale).toInt()
            val py = (18 * scale).toInt()
            setPadding(dp(px), dp(py), dp(px), dp(py))
            val dl = androidx.core.content.ContextCompat.getDrawable(this@MainActivity, R.drawable.ic_download)
            val s = (textSize * 1.1f).toInt()
            dl?.setBounds(0, 0, s, s)
            dl?.setTint(Color.WHITE)
            setCompoundDrawables(dl, null, null, null)
            compoundDrawablePadding = dp(8)
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
            v.animate().cancel()
            if (hasFocus) {
                v.animate()
                    .scaleX(1.07f)
                    .scaleY(1.07f)
                    .translationZ(dp(10).toFloat())
                    .setDuration(260)
                    .setInterpolator(android.view.animation.OvershootInterpolator(1.1f))
                    .start()
            } else {
                v.animate()
                    .scaleX(1f)
                    .scaleY(1f)
                    .translationZ(0f)
                    .setDuration(220)
                    .setInterpolator(android.view.animation.DecelerateInterpolator(1.5f))
                    .start()
            }
        }
        container.setOnClickListener { 
            it.playSoundEffect(SoundEffectConstants.CLICK)
            startDownload(index) 
        }
        return CardViews(container, content, iconBadge, iconImage, title, subtitle, pill, progress, percent, installedChip)
    }

    /**
     * Card 100% neutro para apps bloqueados pelo painel admin.
     * Sem logo, sem nome, sem foco — apenas cadeado + "Indisponível" + motivo opcional.
     */
    private fun buildBlockedCard(app: CatalogApp, width: Int, height: Int, margin: Int, scale: Float): CardViews {
        val grayDark = Color.parseColor("#1f2233")
        val grayBorder = Color.parseColor("#2a2e44")
        val grayMid = Color.parseColor("#3a3f5a")
        val grayText = Color.parseColor("#8a8fa8")
        val grayLabel = Color.parseColor("#a8adc4")

        val container = FrameLayout(this).apply {
            isFocusable = false
            isClickable = false
            background = GradientDrawable().apply {
                cornerRadius = dp((24 * scale).toInt()).toFloat()
                setColor(grayDark)
                setStroke(dp(2), grayBorder)
            }
            val lp = LinearLayout.LayoutParams(dp(width), dp(height))
            lp.marginStart = dp(margin)
            lp.marginEnd = dp(margin)
            layoutParams = lp
        }

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

        val iconBadge = FrameLayout(this).apply {
            background = GradientDrawable().apply {
                cornerRadius = dp((16 * scale).toInt()).toFloat()
                setColor(android.graphics.Color.parseColor("#3A1212"))
            }
            val size = (100 * scale).toInt()
            val lp = LinearLayout.LayoutParams(dp(size), dp(size))
            lp.bottomMargin = dp((20 * scale).toInt())
            layoutParams = lp
        }
        val iconImage = ImageView(this).apply {
            // Usa ícone de cadeado padrão do Android.
            setImageResource(android.R.drawable.ic_lock_lock)
            scaleType = ImageView.ScaleType.FIT_CENTER
            val pad = dp((18 * scale).toInt())
            setPadding(pad, pad, pad, pad)
            setColorFilter(android.graphics.Color.parseColor("#FF4D4D"))
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ).apply { gravity = Gravity.CENTER }
        }
        iconBadge.addView(iconImage)

        val title = TextView(this).apply {
            text = "Em breve um novo app aqui"
            setTextColor(grayLabel)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f * scale)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
        }
        val rawReason = app.blockReason?.trim().orEmpty()
        val hasReason = rawReason.isNotEmpty() &&
            !rawReason.equals("null", ignoreCase = true) &&
            !rawReason.equals("undefined", ignoreCase = true)
        val subtitle = TextView(this).apply {
            text = if (hasReason) rawReason else ""
            visibility = if (hasReason) View.VISIBLE else View.GONE
            setTextColor(grayText)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f * scale)
            gravity = Gravity.CENTER
            setPadding(0, dp((8 * scale).toInt()), 0, 0)
        }

        content.addView(iconBadge)
        content.addView(title)
        content.addView(subtitle)
        container.addView(content)

        // Placeholders para preencher o data class CardViews — nunca exibidos.
        val pill = TextView(this).apply { visibility = View.GONE }
        val progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { visibility = View.GONE }
        val percent = TextView(this).apply { visibility = View.GONE }
        val installedChip = TextView(this).apply { visibility = View.GONE }

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

    private fun makeProgressDrawable(scale: Float, accent: Int): LayerDrawable {
        val track = GradientDrawable().apply {
            setColor(Color.parseColor("#33FFFFFF"))
            cornerRadius = dp((100 * scale).toInt()).toFloat()
        }
        val fill = GradientDrawable(
            GradientDrawable.Orientation.LEFT_RIGHT,
            intArrayOf(accent, Color.parseColor("#FBBF24")),
        ).apply {
            cornerRadius = dp((100 * scale).toInt()).toFloat()
        }
        return LayerDrawable(
            arrayOf(
                track,
                android.graphics.drawable.ClipDrawable(fill, Gravity.START, android.graphics.drawable.ClipDrawable.HORIZONTAL),
            ),
        ).apply {
            setId(0, android.R.id.background)
            setId(1, android.R.id.progress)
        }
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
        if (app.isBlocked) return
        if (card.progress.visibility == View.VISIBLE) return // download em andamento
        
        val installed = InstalledRegistry.isInstalled(this, app)
        val apkFile = ApkCache.fileFor(this, app.name)
        val hasApk = apkFile.exists() && apkFile.length() > 0

        if (installed) {
            setPillContent(card.pill, R.drawable.ic_play, "Abrir aplicativo")
            card.installedChip.visibility = View.VISIBLE
            // Se já está instalado, removemos o APK do cache para liberar espaço
            ApkCache.deleteFor(this, app.name)
        } else if (hasApk) {
            setPillContent(card.pill, R.drawable.ic_download, "Instalar aplicativo")
            card.installedChip.visibility = View.GONE
        } else {
            setPillContent(card.pill, R.drawable.ic_download, "Baixar aplicativo")
            card.installedChip.visibility = View.GONE
        }
    }

    /**
     * Define o ícone (compound drawable à esquerda) e o texto de um pill,
     * substituindo emojis por vetores estilo lucide (igual à versão Web).
     */
    private fun setPillContent(pill: TextView, iconRes: Int, label: String) {
        val icon = androidx.core.content.ContextCompat.getDrawable(this, iconRes)
        val size = (pill.textSize * 1.1f).toInt()
        icon?.setBounds(0, 0, size, size)
        icon?.setTint(pill.currentTextColor)
        pill.setCompoundDrawables(icon, null, null, null)
        // Sem padding quando só ícone, evita deslocar o ícone para a esquerda
        pill.compoundDrawablePadding = if (label.isEmpty()) 0 else dp(8)
        pill.text = label
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
        if (app.isBlocked) return
        val card = cardViews[index]
        
        // Se já estiver instalado, abre direto
        if (InstalledRegistry.isInstalled(this, app)) {
            openApp(InstalledRegistry.resolvePackage(this, app))
            return
        }

        // Se não está instalado mas já temos o APK baixado, abre o instalador direto
        val apkFile = ApkCache.fileFor(this, app.name)
        if (apkFile.exists() && apkFile.length() > 0) {
            if (!ApkInstaller.install(this, apkFile)) {
                pendingInstallApk = apkFile
            }
            return
        }

        if (cardJobs[index]?.isActive == true) return

        card.progress.visibility = View.VISIBLE
        card.progress.progress = 0
        card.percent.visibility = View.VISIBLE
        card.percent.text = "0%"
        card.percent.setTextColor(Color.parseColor("#5EE6A8"))
        card.pill.visibility = View.GONE
        card.subtitle.visibility = View.GONE

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

                        // Aprende o packageName real do APK baixado para detecção futura precisa
                        InstalledRegistry.learnFromApk(this@MainActivity, app.name, p.file)
                        
                        if (!ApkInstaller.install(this@MainActivity, p.file)) {
                            pendingInstallApk = p.file
                        }
                        card.pill.postDelayed({
                            card.progress.visibility = View.GONE
                            card.percent.visibility = View.GONE
                            card.pill.visibility = View.VISIBLE
                            card.subtitle.visibility = View.VISIBLE
                            card.subtitle.text = AppCatalog.apps[index].description
                            // Revalida instalação real, cache e atualiza chip/botão
                            refreshInstalledState(card, app)
                        }, 2500)
                    }
                    is DownloadProgress.Error -> withContext(Dispatchers.Main) {
                        card.progress.visibility = View.GONE
                        card.percent.visibility = View.GONE
                        card.pill.visibility = View.VISIBLE
                        card.subtitle.visibility = View.VISIBLE
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

    private fun openSystemSettings() {
        // 1) Tenta a tela de Settings nativa do Android TV
        val tvIntent = Intent().apply {
            component = android.content.ComponentName(
                "com.android.tv.settings",
                "com.android.tv.settings.MainSettings"
            )
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        if (tvIntent.resolveActivity(packageManager) != null) {
            try { startActivity(tvIntent); return } catch (_: Exception) {}
        }

        // 2) Fallback: Settings padrão do Android (celular / TV Box genérica)
        val phoneIntent = Intent().apply {
            component = android.content.ComponentName(
                "com.android.settings",
                "com.android.settings.Settings"
            )
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        if (phoneIntent.resolveActivity(packageManager) != null) {
            try { startActivity(phoneIntent); return } catch (_: Exception) {}
        }

        // 3) Último recurso: ação genérica ACTION_SETTINGS
        try {
            startActivity(Intent(android.provider.Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: Exception) {
            // Silencioso por requisito
        }
    }

    private fun openNetworkSettings() {
        // 1) Tela de rede da Android TV
        val tvIntent = Intent().apply {
            component = android.content.ComponentName(
                "com.android.tv.settings",
                "com.android.tv.settings.connectivity.NetworkActivity"
            )
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        if (tvIntent.resolveActivity(packageManager) != null) {
            try { startActivity(tvIntent); return } catch (_: Exception) {}
        }

        // 2) Fallback: Wireless Settings do Android padrão
        val wirelessIntent = Intent().apply {
            component = android.content.ComponentName(
                "com.android.settings",
                "com.android.settings.Settings\$WirelessSettings"
            )
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        if (wirelessIntent.resolveActivity(packageManager) != null) {
            try { startActivity(wirelessIntent); return } catch (_: Exception) {}
        }

        // 3) Fallbacks genéricos
        try {
            startActivity(Intent(android.provider.Settings.ACTION_WIFI_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            return
        } catch (_: Exception) {}
        try {
            startActivity(Intent(android.provider.Settings.ACTION_WIRELESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: Exception) {
            // Silencioso por requisito
        }
    }

    private fun openDateSettings() {
        try {
            startActivity(Intent(android.provider.Settings.ACTION_DATE_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            return
        } catch (_: Exception) {}
        openSystemSettings()
    }

    private fun openLocationSettings() {
        try {
            startActivity(Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            return
        } catch (_: Exception) {}
        openSystemSettings()
    }

    /** Torna uma pílula focável (D-pad), clicável e com mesmo realce de foco
     *  das demais pílulas (borda branca + leve scale). */
    private fun wireStatusPillAction(pill: TextView, onTap: () -> Unit) {
        pill.isFocusable = true
        pill.isClickable = true
        pill.setOnClickListener { onTap() }
        pill.setOnFocusChangeListener { v, hasFocus ->
            val bg = (v.background as? GradientDrawable) ?: return@setOnFocusChangeListener
            if (hasFocus) {
                bg.setColor(Color.parseColor("#33FFFFFF"))
                bg.setStroke(dp(2), Color.parseColor("#FFFFFF"))
                v.animate().scaleX(1.05f).scaleY(1.05f).setDuration(150).start()
            } else {
                bg.setColor(Color.parseColor("#1AFFFFFF"))
                bg.setStroke(dp(1), Color.parseColor("#33FFFFFF"))
                v.animate().scaleX(1f).scaleY(1f).setDuration(150).start()
            }
        }
    }

    private fun dp(value: Int): Int {
        val d = resources.displayMetrics.density
        return (value * d).toInt()
    }

    // Formata bytes pra "12.4 MB", "850 KB", etc.
    private fun formatBytes(b: Long): String {
        if (b <= 0) return "0 B"
        val mb = b / 1024.0 / 1024.0
        if (mb >= 1.0) return String.format(Locale.getDefault(), "%.1f MB", mb)
        val kb = b / 1024.0
        if (kb >= 1.0) return String.format(Locale.getDefault(), "%.0f KB", kb)
        return "$b B"
    }

    private fun formatSpeed(bps: Long): String {
        if (bps <= 0) return "—"
        val mbps = bps / 1024.0 / 1024.0
        if (mbps >= 1.0) return String.format(Locale.getDefault(), "%.1f MB/s", mbps)
        val kbps = bps / 1024.0
        return String.format(Locale.getDefault(), "%.0f KB/s", kbps)
    }

    private fun formatEta(seconds: Long): String {
        if (seconds < 0) return "—"
        if (seconds < 60) return "${seconds}s restantes"
        val m = seconds / 60
        val s = seconds % 60
        if (m < 60) return String.format(Locale.getDefault(), "%dm %02ds restantes", m, s)
        val h = m / 60
        val mm = m % 60
        return String.format(Locale.getDefault(), "%dh %02dm restantes", h, mm)
    }

    private fun buildProgressLine(p: DownloadProgress.Progress): String {
        val sizePart = if (p.totalBytes > 0)
            "${formatBytes(p.downloadedBytes)} / ${formatBytes(p.totalBytes)}"
        else formatBytes(p.downloadedBytes)
        val speedPart = formatSpeed(p.speedBytesPerSec)
        val etaPart = formatEta(p.etaSeconds)
        return "$sizePart  •  $speedPart  •  $etaPart"
    }

    // ===================== TOP BAR =====================

    private fun buildTopBar(scale: Float): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            clipChildren = false
            clipToPadding = false
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            )
            // Espaço extra à direita para o efeito de foco da última pílula (Wi-Fi)
            // não ser cortado pela borda do container.
            setPadding(0, 0, dp((12 * scale).toInt()), 0)
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
            clipChildren = false
            clipToPadding = false
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

        val system = makeStatusPill("", "#E8A85C", scale).apply {
            isFocusable = true
            isClickable = true
            // Desativa a mudança de linha automática para permitir animação de largura
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
            gravity = android.view.Gravity.CENTER

            // Ícone de refresh (estilo lucide RotateCcw)
            val refresh = androidx.core.content.ContextCompat.getDrawable(this@MainActivity, R.drawable.ic_rotate_ccw)
            val rs = dp((16 * scale).toInt())
            refresh?.setBounds(0, 0, rs, rs)
            refresh?.setTint(Color.parseColor("#E8A85C"))
            setCompoundDrawables(refresh, null, null, null)
            // Sem padding quando colapsado (só ícone), evita deslocar para a esquerda
            compoundDrawablePadding = 0

            setOnClickListener { checkOtaUpdate(this, true) }
            setOnFocusChangeListener { v, hasFocus ->
                val tv = v as TextView
                val bg = (tv.background as? GradientDrawable) ?: return@setOnFocusChangeListener
                
                if (hasFocus) {
                    bg.setColor(Color.parseColor("#335EE6A8"))
                    bg.setStroke(dp(2), Color.parseColor("#5EE6A8"))
                    tv.compoundDrawablePadding = dp((6 * scale).toInt())
                    // Expande com texto e animação
                    tv.text = "Procurar atualizações"
                    tv.animate().alpha(1f).setDuration(200).start()
                } else {
                    bg.setColor(Color.parseColor("#1AFFFFFF"))
                    bg.setStroke(dp(1), Color.parseColor("#33FFFFFF"))
                    tv.compoundDrawablePadding = 0
                    // Retrai para apenas o ícone
                    tv.text = ""
                }
            }
        }
        val allApps = makeStatusPill("", "#FFFFFF", scale).apply {
            isFocusable = true
            isClickable = true
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
            gravity = android.view.Gravity.CENTER

            val grid = androidx.core.content.ContextCompat.getDrawable(this@MainActivity, R.drawable.ic_grid)
            val rs = dp((16 * scale).toInt())
            grid?.setBounds(0, 0, rs, rs)
            grid?.setTint(Color.WHITE)
            setCompoundDrawables(grid, null, null, null)
            compoundDrawablePadding = 0

            setOnClickListener { showAllAppsOverlay(scale) }
            setOnFocusChangeListener { v, hasFocus ->
                val tv = v as TextView
                val bg = (tv.background as? GradientDrawable) ?: return@setOnFocusChangeListener
                
                if (hasFocus) {
                    bg.setColor(Color.parseColor("#33FFFFFF"))
                    bg.setStroke(dp(2), Color.parseColor("#FFFFFF"))
                    tv.compoundDrawablePadding = dp((6 * scale).toInt())
                    tv.text = "Todos os aplicativos"
                } else {
                    bg.setColor(Color.parseColor("#1AFFFFFF"))
                    bg.setStroke(dp(1), Color.parseColor("#33FFFFFF"))
                    tv.compoundDrawablePadding = 0
                    tv.text = ""
                }
            }
        }
        val settings = makeStatusPill("", "#FFFFFF", scale).apply {
            isFocusable = true
            isClickable = true
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
            gravity = android.view.Gravity.CENTER

            // Ícone de engrenagem (estilo lucide), igual ao da versão Web
            val gear = androidx.core.content.ContextCompat.getDrawable(this@MainActivity, R.drawable.ic_settings)
            val gs = dp((16 * scale).toInt())
            gear?.setBounds(0, 0, gs, gs)
            gear?.setTint(Color.WHITE)
            setCompoundDrawables(gear, null, null, null)
            compoundDrawablePadding = 0

            setOnClickListener {
                openSystemSettings()
            }
            setOnFocusChangeListener { v, hasFocus ->
                val tv = v as TextView
                val bg = (tv.background as? GradientDrawable) ?: return@setOnFocusChangeListener
                
                if (hasFocus) {
                    bg.setColor(Color.parseColor("#33FFFFFF"))
                    bg.setStroke(dp(2), Color.parseColor("#FFFFFF"))
                    tv.compoundDrawablePadding = dp((6 * scale).toInt())
                    tv.text = "Configurações"
                } else {
                    bg.setColor(Color.parseColor("#1AFFFFFF"))
                    bg.setStroke(dp(1), Color.parseColor("#33FFFFFF"))
                    tv.compoundDrawablePadding = 0
                    tv.text = ""
                }
            }
        }
        val clock = makeStatusPill("🕐  --:--", "#FFFFFF", scale)
        val date = makeStatusPill("📅  ---", "#FFFFFF", scale)
        val weather = makeStatusPill("🌥  --°C", "#FFFFFF", scale)
        val wifi = makeStatusPill("📶  Wi-Fi", "#5EE6A8", scale)

        // Pílulas que abrem a configuração correspondente do sistema.
        wireStatusPillAction(clock) { openDateSettings() }
        wireStatusPillAction(date) { openDateSettings() }
        wireStatusPillAction(weather) { openLocationSettings() }
        wireStatusPillAction(wifi) { openNetworkSettings() }

        val gap = dp((8 * scale).toInt())
        listOf<View>(system, allApps, settings, clock, date, weather, wifi).forEach { pill ->
            (pill.layoutParams as LinearLayout.LayoutParams).marginStart = gap
        }

        right.addView(system)
        right.addView(allApps)
        right.addView(settings)
        right.addView(clock)
        right.addView(date)
        right.addView(weather)
        right.addView(wifi)

        clockView = clock
        dateView = date
        weatherView = weather
        wifiView = wifi
        otaStatusPill = system
        settingsPill = settings
        // Reaplica o último estado conhecido ao ícone recém-criado
        // (o monitor só dispara em mudanças de rede).
        applyNetworkState(lastNetworkState)

        // Navegação D-pad determinística entre as pílulas focáveis
        system.id = View.generateViewId()
        allApps.id = View.generateViewId()
        settings.id = View.generateViewId()
        clock.id = View.generateViewId()
        date.id = View.generateViewId()
        weather.id = View.generateViewId()
        wifi.id = View.generateViewId()
        
        system.nextFocusRightId = allApps.id
        
        allApps.nextFocusLeftId = system.id
        allApps.nextFocusRightId = settings.id
        
        settings.nextFocusLeftId = allApps.id
        settings.nextFocusRightId = clock.id
        
        clock.nextFocusLeftId = settings.id
        clock.nextFocusRightId = date.id
        
        date.nextFocusLeftId = clock.id
        date.nextFocusRightId = weather.id
        
        weather.nextFocusLeftId = date.id
        weather.nextFocusRightId = wifi.id
        
        wifi.nextFocusLeftId = weather.id
        wifi.nextFocusRightId = View.NO_ID

        row.addView(left)
        row.addView(right)

        // Inicializa valores
        updateClockAndDate()
        refreshWeather()
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
                setPillContent(systemPill, R.drawable.ic_rotate_ccw, if (systemPill.hasFocus()) "Procurar atualizações" else "")
                systemPill.setTextColor(Color.parseColor("#FF6B6B"))
                if (manual) {
                    Toast.makeText(this@MainActivity, "Falha ao verificar atualizações (sem conexão)", Toast.LENGTH_SHORT).show()
                }
                return@launch
            }

            val (hasUpdate, remoteVersion, downloadUrl) = otaInfo

            if (hasUpdate) {
                setPillContent(systemPill, R.drawable.ic_download, "Atualização disponível ($remoteVersion)")
                systemPill.setTextColor(Color.parseColor("#5EE6A8"))
                if (manual) {
                    if (downloadUrl.isEmpty()) {
                        Toast.makeText(this@MainActivity, "URL de atualização inválida", Toast.LENGTH_SHORT).show()
                    } else {
                        startLauncherUpdate(downloadUrl)
                    }
                }
            } else {
                setPillContent(systemPill, R.drawable.ic_rotate_ccw, if (systemPill.hasFocus()) "Procurar atualizações" else "")
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

    private fun startLauncherUpdate(url: String, ui: OtaProgressViews? = null) {
        hideSoftKeyboardAndClearFocus()
        scope.launch {
            ApkDownloader.download(this@MainActivity, url, "TV.Apps_Update").collect { p ->
                val systemPill = otaStatusPill
                when (p) {
                    is DownloadProgress.Progress -> withContext(Dispatchers.Main) {
                        ui?.let { views ->
                            views.button.isEnabled = false
                            views.button.isFocusable = false
                            views.button.text = "BAIXANDO ATUALIZAÇÃO"
                            views.progress.visibility = View.VISIBLE
                            views.percent.visibility = View.VISIBLE
                            views.speed.visibility = View.VISIBLE
                            views.progress.progress = p.percent
                            views.percent.text = "${p.percent}%"
                            views.speed.text = "Velocidade: ${formatSpeed(p.speedBytesPerSec)}"
                        }
                        if (systemPill != null) {
                            val speed = formatSpeed(p.speedBytesPerSec)
                            setPillContent(
                                systemPill,
                                R.drawable.ic_download,
                                "Baixando ${p.percent}% • $speed",
                            )
                        }
                    }
                    is DownloadProgress.Done -> withContext(Dispatchers.Main) {
                        ui?.let { views ->
                            views.progress.progress = 100
                            views.percent.text = "100%"
                            views.speed.text = "Download concluído"
                            views.button.text = "ABRINDO INSTALADOR…"
                        }
                        systemPill?.text = "✓  Download concluído"
                        val opened = ApkInstaller.install(this@MainActivity, p.file)
                        if (!opened) {
                            // Permissão "Instalar apps desconhecidos" não concedida.
                            // Guarda o APK para retomar no onResume e oferece retry manual.
                            pendingInstallApk = p.file
                            ui?.let { views ->
                                views.button.isEnabled = true
                                views.button.isFocusable = true
                                views.button.isFocusableInTouchMode = true
                                views.button.text = "INSTALAR APLICATIVO"
                                views.button.setOnClickListener {
                                    if (!ApkInstaller.install(this@MainActivity, p.file)) {
                                        pendingInstallApk = p.file
                                    }
                                }
                                views.speed.visibility = View.VISIBLE
                                views.speed.text = "Se nada acontecer, toque OK novamente"
                                views.button.post { views.button.requestFocus() }
                            }
                            systemPill?.text = "⚠  Autorize a instalação"
                        }
                        systemPill?.postDelayed({ systemPill.text = "✓  Sistema atualizado" }, 5000)
                    }
                    is DownloadProgress.Error -> withContext(Dispatchers.Main) {
                        ui?.let { views ->
                            views.button.isEnabled = true
                            views.button.isFocusable = true
                            views.button.text = "TENTAR NOVAMENTE"
                            views.speed.visibility = View.VISIBLE
                            views.speed.text = "Erro no download"
                        }
                        systemPill?.text = "⚠  Erro no download"
                        Toast.makeText(this@MainActivity, "Erro ao baixar atualização: ${p.message}", Toast.LENGTH_LONG).show()
                        systemPill?.postDelayed({ systemPill.text = if (systemPill.hasFocus()) "🔍  Procurar atualizações" else "🔍" }, 3000)
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
        super.onDestroy()
    }

    private fun showContextMenu(app: ResolveInfo, scale: Float) {
        val root = findViewById<ViewGroup>(android.R.id.content)
        val pm = packageManager
        val pkg = app.activityInfo.packageName
        
        val overlay = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            setBackgroundColor(Color.parseColor("#CC000000"))
            isClickable = true
            isFocusable = true
            setOnClickListener { onBackPressed() }
        }
        activeOverlay = overlay
        
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#1A1A2E"))
                cornerRadius = dp((16 * scale).toInt()).toFloat()
                setStroke(dp(1), Color.parseColor("#33FFFFFF"))
            }
            val w = dp((320 * scale).toInt())
            layoutParams = FrameLayout.LayoutParams(w, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER)
            val p = dp((24 * scale).toInt())
            setPadding(p, p, p, p)
            isClickable = true
        }
        
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { 
                bottomMargin = dp((20 * scale).toInt()) 
            }
        }
        
        val icon = ImageView(this).apply {
            layoutParams = LinearLayout.LayoutParams(dp((48 * scale).toInt()), dp((48 * scale).toInt()))
            setImageDrawable(app.loadIcon(pm))
        }
        
        val nameLabel = TextView(this).apply {
            text = app.loadLabel(pm)
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f * scale)
            setTypeface(null, android.graphics.Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { 
                marginStart = dp((12 * scale).toInt()) 
            }
        }
        
        header.addView(icon)
        header.addView(nameLabel)
        card.addView(header)
        
        val isFav = LauncherSettings.getFavorites(this).contains(pkg)
        val options = listOf(
            "Abrir" to { 
                val intent = pm.getLaunchIntentForPackage(pkg)
                if (intent != null) startActivity(intent)
                onBackPressed()
            },
            (if (isFav) "Remover dos favoritos" else "Adicionar aos favoritos") to {
                if (isFav) {
                    LauncherSettings.removeFavorite(this, pkg)
                    Toast.makeText(this, "Removido dos favoritos", Toast.LENGTH_SHORT).show()
                } else {
                    LauncherSettings.addFavorite(this, pkg)
                    Toast.makeText(this, "Adicionado aos favoritos", Toast.LENGTH_SHORT).show()
                }
                onBackPressed()
            },
            "Ocultar app" to {
                LauncherSettings.hideApp(this, pkg)
                Toast.makeText(this, "App ocultado", Toast.LENGTH_SHORT).show()
                onBackPressed() // Fecha menu
                onBackPressed() // Fecha All Apps
                showAllAppsOverlay(scale) // Reabre atualizado
            },
            "Informações do app" to {
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", pkg, null)
                }
                startActivity(intent)
                onBackPressed()
            },
            "Desativar" to {
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", pkg, null)
                }
                startActivity(intent)
                onBackPressed()
            },
            "Desinstalar" to {
                val intent = Intent(Intent.ACTION_DELETE).apply {
                    data = Uri.fromParts("package", pkg, null)
                }
                startActivity(intent)
                onBackPressed()
            }
        )
        
        options.forEach { (label, action) ->
            val btn = TextView(this).apply {
                text = label
                setTextColor(Color.parseColor("#B3FFFFFF"))
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f * scale)
                isFocusable = true
                isClickable = true
                val p2 = dp((12 * scale).toInt())
                setPadding(p2, p2, p2, p2)
                
                val btnBg = GradientDrawable().apply {
                    cornerRadius = dp((8 * scale).toInt()).toFloat()
                }
                background = btnBg
                
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { 
                    bottomMargin = dp((4 * scale).toInt()) 
                }
                
                setOnClickListener { action() }
                setOnFocusChangeListener { v, hasFocus ->
                    if (hasFocus) {
                        btnBg.setColor(Color.parseColor("#33FFFFFF"))
                        setTextColor(Color.WHITE)
                    } else {
                        btnBg.setColor(Color.TRANSPARENT)
                        setTextColor(Color.parseColor("#B3FFFFFF"))
                    }
                }
            }
            card.addView(btn)
        }
        
        overlay.addView(card)
        root.addView(overlay)
        if (card.childCount > 1) card.getChildAt(1).requestFocus()
    }

    private fun showAllAppsOverlay(scale: Float) {
        val intent = Intent(this, AllAppsActivity::class.java)
        startActivity(intent)
    }


    private fun buildDock(scale: Float): View {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { 
                topMargin = dp((16 * scale).toInt())
                bottomMargin = dp((8 * scale).toInt())
                gravity = Gravity.CENTER_HORIZONTAL
            }
            clipChildren = false
            clipToPadding = false
        }
        
        refreshDock(container, scale)
        return container
    }

    private fun refreshDock(container: LinearLayout, scale: Float) {
        container.removeAllViews()
        val pm = packageManager
        val dockApps = LauncherSettings.getDockApps(this)
        
        dockApps.forEach { pkg ->
            try {
                val info = pm.getApplicationInfo(pkg, 0)
                val item = buildDockItem(pkg, pm.getApplicationLabel(info).toString(), pm.getApplicationIcon(info), scale)
                container.addView(item)
            } catch (_: Exception) {}
        }
        
        // Botão +
        val addBtn = FrameLayout(this).apply {
            val size = dp((56 * scale).toInt())
            layoutParams = LinearLayout.LayoutParams(size, size).apply {
                leftMargin = dp((8 * scale).toInt())
                gravity = Gravity.CENTER_VERTICAL
            }
            isFocusable = true
            isClickable = true
            val bg = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#1AFFFFFF"))
                setStroke(dp(1), Color.parseColor("#33FFFFFF"))
            }
            background = bg
            
            val icon = ImageView(this@MainActivity).apply {
                setImageResource(R.drawable.ic_add_dock)
                val p = dp((16 * scale).toInt())
                setPadding(p, p, p, p)
                setColorFilter(Color.WHITE)
            }
            addView(icon)
            
            setOnFocusChangeListener { v, hasFocus ->
                if (hasFocus) {
                    bg.setColor(Color.parseColor("#4DFFFFFF"))
                    bg.setStroke(dp(2), Color.WHITE)
                    v.scaleX = 1.15f
                    v.scaleY = 1.15f
                } else {
                    bg.setColor(Color.parseColor("#1AFFFFFF"))
                    bg.setStroke(dp(1), Color.parseColor("#33FFFFFF"))
                    v.scaleX = 1f
                    v.scaleY = 1f
                }
            }
            
            setOnClickListener {
                showAllAppsForDockOverlay(scale)
            }
        }
        container.addView(addBtn)
        
        if (pendingFocusAddDock) {
            addBtn.post { addBtn.requestFocus() }
            pendingFocusAddDock = false
        }
    }

    private fun buildDockItem(packageName: String, label: String, icon: Drawable, scale: Float): View {
        val item = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            val w = dp((80 * scale).toInt())
            layoutParams = LinearLayout.LayoutParams(w, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                rightMargin = dp((8 * scale).toInt())
            }
            isFocusable = true
            isClickable = true
            setPadding(dp((8 * scale).toInt()), dp((8 * scale).toInt()), dp((8 * scale).toInt()), dp((8 * scale).toInt()))
            
            val bg = GradientDrawable().apply {
                cornerRadius = dp((12 * scale).toInt()).toFloat()
                setColor(Color.TRANSPARENT)
            }
            background = bg
            
            val iv = ImageView(this@MainActivity).apply {
                val s = dp((44 * scale).toInt())
                layoutParams = LinearLayout.LayoutParams(s, s)
                setImageDrawable(icon)
            }
            
            val tv = TextView(this@MainActivity).apply {
                text = label
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f * scale)
                gravity = Gravity.CENTER
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { topMargin = dp((4 * scale).toInt()) }
            }
            
            addView(iv)
            addView(tv)
            
            setOnFocusChangeListener { v, hasFocus ->
                if (hasFocus) {
                    bg.setColor(Color.parseColor("#33FFFFFF"))
                    bg.setStroke(dp(2), Color.WHITE)
                    v.scaleX = 1.1f
                    v.scaleY = 1.1f
                } else {
                    bg.setColor(Color.TRANSPARENT)
                    bg.setStroke(0, Color.TRANSPARENT)
                    v.scaleX = 1f
                    v.scaleY = 1f
                }
            }
            
            setOnClickListener {
                try {
                    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
                    if (launchIntent != null) {
                        startActivity(launchIntent)
                    }
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Erro ao abrir: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
            
            setOnLongClickListener {
                AlertDialog.Builder(this@MainActivity, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                    .setTitle("Remover do dock?")
                    .setMessage("Deseja remover $label da barra de acesso rápido?")
                    .setPositiveButton("Remover") { _, _ ->
                        LauncherSettings.removeFromDock(this@MainActivity, packageName)
                        setContentView(buildRoot())
                    }
                    .setNegativeButton("Cancelar", null)
                    .show()
                true
            }
        }
        return item
    }

    private fun showAllAppsForDockOverlay(scale: Float) {
        val root = findViewById<ViewGroup>(android.R.id.content)
        val overlay = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            setBackgroundColor(Color.parseColor("#E6000000"))
            isClickable = true
            isFocusable = true
            descendantFocusability = ViewGroup.FOCUS_AFTER_DESCENDANTS
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        }
        activeOverlay = overlay

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = FrameLayout.LayoutParams(
                (resources.displayMetrics.widthPixels * 0.85f).toInt(),
                (resources.displayMetrics.heightPixels * 0.85f).toInt(),
                Gravity.CENTER
            )
            val bg = GradientDrawable().apply {
                setColor(Color.parseColor("#1A1A1A"))
                cornerRadius = dp(24).toFloat()
                setStroke(dp(1), Color.parseColor("#33FFFFFF"))
            }
            background = bg
            setPadding(dp(32), dp(32), dp(32), dp(32))
            isFocusable = true
            descendantFocusability = ViewGroup.FOCUS_AFTER_DESCENDANTS
        }

        val title = TextView(this).apply {
            id = View.generateViewId()
            text = "Adicionar ao Acesso Rápido"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f * scale)
            setTypeface(null, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            isFocusable = true
            nextFocusUpId = id
            nextFocusLeftId = id
            nextFocusRightId = id
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(32)
            }
        }
        container.addView(title)

        val scrollView = ScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
            isVerticalScrollBarEnabled = false
            isFillViewport = true
            setPadding(dp(24), 0, dp(24), 0)
            clipToPadding = false
        }

        val grid = GridLayout(this).apply {
            columnCount = 5
            layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                gravity = Gravity.CENTER
            }
            useDefaultMargins = true
            alignmentMode = GridLayout.ALIGN_BOUNDS
        }

        val pm = packageManager
        
        // Busca apps de launcher padrão
        val mainIntent = Intent(Intent.ACTION_MAIN, null).apply { addCategory(Intent.CATEGORY_LAUNCHER) }
        val standardApps = pm.queryIntentActivities(mainIntent, 0)
        
        // Busca apps de launcher de TV (Leanback)
        val tvIntent = Intent(Intent.ACTION_MAIN, null).apply { addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER) }
        val tvApps = pm.queryIntentActivities(tvIntent, 0)
        
        // Combina, remove duplicados e transforma em AppInfo
        val allApps = (standardApps + tvApps)
            .distinctBy { it.activityInfo.packageName }
            .map { it.activityInfo.applicationInfo }
            .sortedBy { pm.getApplicationLabel(it).toString().lowercase() }

        allApps.forEach { appInfo ->
            val pkg = appInfo.packageName
            val item = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                isFocusable = true
                isClickable = true
                val itemWidth = dp(110)
                layoutParams = GridLayout.LayoutParams().apply {
                    width = itemWidth
                    height = ViewGroup.LayoutParams.WRAP_CONTENT
                    setMargins(dp(12), dp(12), dp(12), dp(12))
                }
                setPadding(dp(12), dp(16), dp(12), dp(16))
                
                val bg = GradientDrawable().apply {
                    cornerRadius = dp(12).toFloat()
                    setColor(Color.TRANSPARENT)
                }
                background = bg
                
                val icon = ImageView(this@MainActivity).apply {
                    val s = dp(56)
                    layoutParams = LinearLayout.LayoutParams(s, s)
                    setImageDrawable(appInfo.loadIcon(pm))
                }
                
                val name = TextView(this@MainActivity).apply {
                    text = appInfo.loadLabel(pm)
                    setTextColor(Color.WHITE)
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f * scale)
                    gravity = Gravity.CENTER
                    maxLines = 1
                    ellipsize = android.text.TextUtils.TruncateAt.END
                    layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                        topMargin = dp(6)
                    }
                }
                
                addView(icon)
                addView(name)
                
                setOnFocusChangeListener { v, hasFocus ->
                    if (hasFocus) {
                        bg.setColor(Color.parseColor("#33FFFFFF"))
                        bg.setStroke(dp(2), Color.WHITE)
                        v.scaleX = 1.1f
                        v.scaleY = 1.1f
                    } else {
                        bg.setColor(Color.TRANSPARENT)
                        bg.setStroke(0, Color.TRANSPARENT)
                        v.scaleX = 1f
                        v.scaleY = 1f
                    }
                }
                
                setOnClickListener {
                    LauncherSettings.addToDock(this@MainActivity, pkg)
                    root.removeView(overlay)
                    activeOverlay = null
                    pendingFocusAddDock = true
                    setContentView(buildRoot())
                }
            }
            grid.addView(item)
        }

        scrollView.addView(grid)
        container.addView(scrollView)

        val closeBtn = TextView(this).apply {
            text = "VOLTAR"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f * scale)
            gravity = Gravity.CENTER
            isFocusable = true
            isClickable = true
            val bg = GradientDrawable().apply {
                cornerRadius = dp(8).toFloat()
                setColor(Color.parseColor("#33FFFFFF"))
            }
            background = bg
            setPadding(dp(20), dp(10), dp(20), dp(10))
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                gravity = Gravity.END
                topMargin = dp(16)
            }
            
            setOnFocusChangeListener { v, hasFocus ->
                if (hasFocus) {
                    bg.setColor(Color.parseColor("#66FFFFFF"))
                    bg.setStroke(dp(2), Color.WHITE)
                } else {
                    bg.setColor(Color.parseColor("#33FFFFFF"))
                    bg.setStroke(0, Color.TRANSPARENT)
                }
            }
            
            setOnClickListener {
                root.removeView(overlay)
                activeOverlay = null
            }
        }
        container.addView(closeBtn)

        overlay.addView(container)
        root.addView(overlay)
        
        if (grid.childCount > 0) {
            grid.getChildAt(0).requestFocus()
        } else {
            closeBtn.requestFocus()
        }
    }

}
