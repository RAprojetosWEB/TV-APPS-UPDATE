package com.tvapps.launcher

import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
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

class MainActivity : Activity() {

    private val scope: CoroutineScope = MainScope()
    private val cardJobs = mutableMapOf<Int, Job>()
    private val cardViews = mutableListOf<CardViews>()

    private data class CardViews(
        val container: LinearLayout,
        val title: TextView,
        val subtitle: TextView,
        val status: TextView,
        val progress: ProgressBar,
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
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(Color.parseColor("#1A0D2E"), Color.parseColor("#0B1020")),
            )
            setPadding(dp(40), dp(32), dp(40), dp(32))
        }
        val header = TextView(this).apply {
            text = "TV Apps"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 34f)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        val sub = TextView(this).apply {
            text = "Selecione um app para baixar e instalar"
            setTextColor(Color.parseColor("#C9C5E0"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setPadding(0, dp(4), 0, dp(24))
        }
        root.addView(header)
        root.addView(sub)

        val scroll = ScrollView(this).apply {
            isFillViewport = true
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f,
            )
        }
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        AppCatalog.apps.forEachIndexed { index, app ->
            val card = buildCard(index, app)
            row.addView(card.container)
            cardViews.add(card)
        }
        scroll.addView(row)
        root.addView(scroll)

        cardViews.firstOrNull()?.container?.post {
            cardViews.first().container.requestFocus()
        }
        return root
    }

    private fun buildCard(index: Int, app: CatalogApp): CardViews {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            isFocusable = true
            isFocusableInTouchMode = true
            isClickable = true
            background = makeCardBg(false)
            val lp = LinearLayout.LayoutParams(dp(260), dp(280))
            lp.marginEnd = dp(20)
            layoutParams = lp
            setPadding(dp(20), dp(20), dp(20), dp(20))
        }
        val title = TextView(this).apply {
            text = app.name
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        val subtitle = TextView(this).apply {
            text = app.description
            setTextColor(Color.parseColor("#B8B3D6"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            setPadding(0, dp(6), 0, dp(16))
        }
        val progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progress = 0
            visibility = View.GONE
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(10),
            )
        }
        val status = TextView(this).apply {
            text = "Pressione OK para instalar"
            setTextColor(Color.parseColor("#9FE9C8"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setPadding(0, dp(10), 0, 0)
        }
        container.addView(title)
        container.addView(subtitle)
        container.addView(View(this).apply {
            layoutParams = LinearLayout.LayoutParams(0, 0, 1f)
        })
        container.addView(progress)
        container.addView(status)

        container.setOnFocusChangeListener { v, hasFocus ->
            v.background = makeCardBg(hasFocus)
            v.animate().scaleX(if (hasFocus) 1.05f else 1f)
                .scaleY(if (hasFocus) 1.05f else 1f)
                .setDuration(120).start()
        }
        container.setOnClickListener { startDownload(index) }
        return CardViews(container, title, subtitle, status, progress)
    }

    private fun makeCardBg(focused: Boolean): GradientDrawable {
        val gd = GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            if (focused)
                intArrayOf(Color.parseColor("#7C3AED"), Color.parseColor("#2DD4A8"))
            else
                intArrayOf(Color.parseColor("#2A1B4E"), Color.parseColor("#161029")),
        )
        gd.cornerRadius = dp(18).toFloat()
        gd.setStroke(
            dp(if (focused) 3 else 1),
            if (focused) Color.parseColor("#A5F3FC") else Color.parseColor("#3B2F66"),
        )
        return gd
    }

    private fun startDownload(index: Int) {
        val app = AppCatalog.apps[index]
        val card = cardViews[index]
        if (cardJobs[index]?.isActive == true) return

        card.progress.visibility = View.VISIBLE
        card.progress.progress = 0
        card.status.text = "Baixando 0%"
        card.status.setTextColor(Color.parseColor("#FDE68A"))

        cardJobs[index] = scope.launch {
            ApkDownloader.download(this@MainActivity, app.url, app.name).collect { p ->
                when (p) {
                    is DownloadProgress.Progress -> withContext(Dispatchers.Main) {
                        card.progress.progress = p.percent
                        card.status.text = "Baixando ${p.percent}%"
                    }
                    is DownloadProgress.Done -> withContext(Dispatchers.Main) {
                        card.progress.progress = 100
                        card.status.text = "Abrindo instalador…"
                        card.status.setTextColor(Color.parseColor("#9FE9C8"))
                        ApkInstaller.install(this@MainActivity, p.file)
                        card.status.postDelayed({
                            card.progress.visibility = View.GONE
                            card.status.text = "Pressione OK para instalar"
                        }, 2500)
                    }
                    is DownloadProgress.Error -> withContext(Dispatchers.Main) {
                        card.progress.visibility = View.GONE
                        card.status.text = "Erro: ${p.message}"
                        card.status.setTextColor(Color.parseColor("#FCA5A5"))
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