package com.tvapps.launcher

import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
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

class MainActivity : Activity() {

    private val scope: CoroutineScope = MainScope()
    private val cardJobs = mutableMapOf<Int, Job>()
    private val cardViews = mutableListOf<CardViews>()

    private data class CardViews(
        val container: FrameLayout,
        val content: LinearLayout,
        val iconBadge: FrameLayout,
        val iconText: TextView,
        val title: TextView,
        val subtitle: TextView,
        val pill: TextView,
        val progress: ProgressBar,
        val percent: TextView,
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
        setContentView(buildRoot())
    }

    private fun buildRoot(): View {
        val dm = resources.displayMetrics
        val widthDp = dm.widthPixels / dm.density
        val heightDp = dm.heightPixels / dm.density
        
        // Fator de escala base: assumimos que o design ideal foi feito para uma tela de ~1280dp de largura
        // Limitamos para evitar que em telas muito pequenas ou muito grandes fique bizarro
        val scaleFactor = (widthDp / 1280f).coerceIn(0.7f, 1.3f)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = makeRootBackground()
            setPadding(dp((64 * scaleFactor).toInt()), dp((40 * scaleFactor).toInt()), dp((64 * scaleFactor).toInt()), dp((32 * scaleFactor).toInt()))
        }

        // Header "TV.Apps" — ponto em verde, igual à web
        val header = TextView(this).apply {
            val accent = "#5EE6A8"
            val spanned = android.text.SpannableString("TV.Apps")
            spanned.setSpan(
                android.text.style.ForegroundColorSpan(Color.parseColor(accent)),
                2, 3, android.text.Spannable.SPAN_EXCLUSIVE_EXCLUSIVE,
            )
            text = spanned
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 44f * scaleFactor)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        val sub = TextView(this).apply {
            text = "Use as setas do controle e pressione OK para baixar"
            setTextColor(Color.parseColor("#99FFFFFF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f * scaleFactor)
            setPadding(0, dp((8 * scaleFactor).toInt()), 0, 0)
        }
        root.addView(header)
        root.addView(sub)

        // Linha de cards centralizada
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f,
            )
            clipChildren = false
            clipToPadding = false
            setPadding(0, dp((20 * scaleFactor).toInt()), 0, dp((20 * scaleFactor).toInt()))
        }
        
        val cardWidth = (340 * scaleFactor).toInt()
        val cardHeight = (440 * scaleFactor).toInt()
        val cardMargin = (20 * scaleFactor).toInt()

        AppCatalog.apps.forEachIndexed { index, app ->
            val card = buildCard(index, app, cardWidth, cardHeight, cardMargin, scaleFactor)
            row.addView(card.container)
            cardViews.add(card)
        }
        root.addView(row)

        val footer = TextView(this).apply {
            text = "Após o download, permita instalação de fontes desconhecidas"
            setTextColor(Color.parseColor("#66FFFFFF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f * scaleFactor)
            gravity = Gravity.CENTER
        }
        root.addView(footer)

        cardViews.getOrNull(1)?.container?.post {
            cardViews[1].container.requestFocus()
        }
        return root
    }

    private fun makeRootBackground(): LayerDrawable {
        val base = GradientDrawable().apply {
            setColor(Color.parseColor("#15102A"))
        }
        val glowTopLeft = GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            intArrayOf(Color.parseColor("#663B2F66"), Color.TRANSPARENT),
        ).apply { gradientType = GradientDrawable.RADIAL_GRADIENT; gradientRadius = dp(700).toFloat() }
        val glowBottomRight = GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            intArrayOf(Color.TRANSPARENT, Color.parseColor("#552DD4A8")),
        )
        return LayerDrawable(arrayOf(base, glowTopLeft, glowBottomRight))
    }

    private fun buildCard(index: Int, app: CatalogApp): CardViews {
        // Container externo (FrameLayout) recebe o foco e o background com borda
        val container = FrameLayout(this).apply {
            isFocusable = true
            isFocusableInTouchMode = true
            isClickable = true
            background = makeCardBg(false)
            val lp = LinearLayout.LayoutParams(dp(340), dp(440))
            lp.marginStart = dp(20)
            lp.marginEnd = dp(20)
            layoutParams = lp
        }

        // Conteúdo vertical centralizado dentro do card
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(28), dp(28), dp(28), dp(28))
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
        }

        // Badge de ícone (quadrado arredondado, gradiente quando focado)
        val iconBadge = FrameLayout(this).apply {
            background = makeIconBadgeBg(false)
            val lp = LinearLayout.LayoutParams(dp(120), dp(120))
            lp.bottomMargin = dp(24)
            layoutParams = lp
        }
        val iconText = TextView(this).apply {
            text = app.icon
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 56f)
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ).apply { gravity = Gravity.CENTER }
        }
        iconBadge.addView(iconText)

        val title = TextView(this).apply {
            text = app.name
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 26f)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
        }
        val subtitle = TextView(this).apply {
            text = app.description
            setTextColor(Color.parseColor("#99FFFFFF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            gravity = Gravity.CENTER
            setPadding(0, dp(10), 0, dp(20))
        }

        // Pill "BAIXAR APK"
        val pill = TextView(this).apply {
            text = "⬇  BAIXAR APK"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            background = makePillBg(false)
            setPadding(dp(22), dp(12), dp(22), dp(12))
        }

        // Barra de progresso (escondida no estado idle)
        val progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progress = 0
            visibility = View.GONE
            val lp = LinearLayout.LayoutParams(dp(220), dp(8))
            lp.topMargin = dp(14)
            layoutParams = lp
        }
        val percent = TextView(this).apply {
            text = ""
            setTextColor(Color.parseColor("#5EE6A8"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            visibility = View.GONE
            setPadding(0, dp(6), 0, 0)
        }

        content.addView(iconBadge)
        content.addView(title)
        content.addView(subtitle)
        content.addView(pill)
        content.addView(progress)
        content.addView(percent)
        container.addView(content)

        container.setOnFocusChangeListener { v, hasFocus ->
            v.background = makeCardBg(hasFocus)
            iconBadge.background = makeIconBadgeBg(hasFocus)
            pill.background = makePillBg(hasFocus)
            pill.setTextColor(
                if (hasFocus) Color.parseColor("#15102A") else Color.WHITE,
            )
            v.animate().scaleX(if (hasFocus) 1.06f else 1f)
                .scaleY(if (hasFocus) 1.06f else 1f)
                .setDuration(180).start()
        }
        container.setOnClickListener { startDownload(index) }
        return CardViews(container, content, iconBadge, iconText, title, subtitle, pill, progress, percent)
    }

    private fun makeCardBg(focused: Boolean): GradientDrawable {
        val gd = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(Color.parseColor("#2A1F44"), Color.parseColor("#1E1638")),
        )
        gd.cornerRadius = dp(28).toFloat()
        gd.setStroke(
            dp(if (focused) 3 else 2),
            if (focused) Color.parseColor("#5EE6A8") else Color.parseColor("#3F3360"),
        )
        return gd
    }

    private fun makeIconBadgeBg(focused: Boolean): GradientDrawable {
        val gd = if (focused) {
            GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(Color.parseColor("#5EE6A8"), Color.parseColor("#A78BFA")),
            )
        } else {
            GradientDrawable().apply { setColor(Color.parseColor("#38305A")) }
        }
        gd.cornerRadius = dp(20).toFloat()
        return gd
    }

    private fun makePillBg(focused: Boolean): GradientDrawable {
        val gd = GradientDrawable()
        gd.cornerRadius = dp(100).toFloat()
        if (focused) {
            gd.setColor(Color.parseColor("#5EE6A8"))
            gd.setStroke(dp(2), Color.parseColor("#5EE6A8"))
        } else {
            gd.setColor(Color.TRANSPARENT)
            gd.setStroke(dp(2), Color.parseColor("#3F3360"))
        }
        return gd
    }

    private fun startDownload(index: Int) {
        val app = AppCatalog.apps[index]
        val card = cardViews[index]
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
                        card.subtitle.text = "Abrindo instalador…"
                        ApkInstaller.install(this@MainActivity, p.file)
                        card.pill.postDelayed({
                            card.progress.visibility = View.GONE
                            card.percent.visibility = View.GONE
                            card.pill.visibility = View.VISIBLE
                            card.subtitle.text = AppCatalog.apps[index].description
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

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}