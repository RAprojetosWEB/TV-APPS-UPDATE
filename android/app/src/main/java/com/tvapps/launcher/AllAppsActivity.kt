package com.tvapps.launcher

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView

class AllAppsActivity : Activity() {

    private val density by lazy { resources.displayMetrics.density }
    private fun dp(v: Int) = (v * density).toInt()
    private var scaleFactor = 1.0f

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Fullscreen as requested
        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )
        
        val dm = resources.displayMetrics
        val widthDp = dm.widthPixels / dm.density
        scaleFactor = (widthDp / 1280f).coerceIn(0.85f, 1.1f)
        
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#0D0D1A")) // Dark background
            val p = dp((40 * scaleFactor).toInt())
            setPadding(p, p, p, p)
            clipChildren = false
            clipToPadding = false
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        val topRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }

        val title = TextView(this).apply {
            text = "Todos os aplicativos"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f * scaleFactor)
            setTypeface(null, android.graphics.Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }

        val closeBtn = makeStatusPill("Fechar", "#FFFFFF", scaleFactor).apply {
            isFocusable = true
            isClickable = true
            setOnClickListener { 
                finish()
            }
            setOnFocusChangeListener { v, hasFocus ->
                val bg = (v.background as? GradientDrawable) ?: return@setOnFocusChangeListener
                if (hasFocus) {
                    bg.setColor(Color.parseColor("#33FFFFFF"))
                    bg.setStroke(dp(2), Color.parseColor("#FFFFFF"))
                } else {
                    bg.setColor(Color.TRANSPARENT)
                    bg.setStroke(dp(2), Color.parseColor("#FFFFFF"))
                }
            }
        }

        topRow.addView(title)
        topRow.addView(closeBtn)
        root.addView(topRow)

        val recyclerView = RecyclerView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
            ).apply { topMargin = dp((24 * scaleFactor).toInt()) }
            layoutManager = GridLayoutManager(this@AllAppsActivity, 6)
            clipChildren = false
            clipToPadding = false
            // Melhora performance
            setHasFixedSize(true)
        }
        
        root.addView(recyclerView)
        setContentView(root)

        loadApps(recyclerView)
        
        // Foca no primeiro item da lista após um pequeno delay para garantir que o layout aconteceu
        recyclerView.post {
            if (recyclerView.childCount > 0) {
                recyclerView.getChildAt(0).requestFocus()
            } else {
                closeBtn.requestFocus()
            }
        }
    }

    private fun loadApps(recyclerView: RecyclerView) {
        val pm = packageManager
        
        // 1. Busca apps com a intent correta solicitada pelo usuário
        val intent = Intent(Intent.ACTION_MAIN, null).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }
        val standardApps = pm.queryIntentActivities(intent, 0)
        
        // 2. Busca também apps de TV (Leanback) para garantir que apareçam
        val tvIntent = Intent(Intent.ACTION_MAIN, null).apply { 
            addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER) 
        }
        val tvApps = pm.queryIntentActivities(tvIntent, 0)
        
        // Combina e remove duplicados
        val combinedApps = (standardApps + tvApps).distinctBy { it.activityInfo.packageName }
        
        // Filtra apps ocultos
        val hidden = LauncherSettings.getHiddenApps(this)
        val filteredApps = combinedApps.filter { !hidden.contains(it.activityInfo.packageName) }
        
        // Ordena por nome
        val sortedApps = filteredApps.sortedBy { it.loadLabel(pm).toString().lowercase() }

        recyclerView.adapter = AllAppsAdapter(sortedApps, pm)
    }

    private fun makeStatusPill(text: String, accentHex: String, scale: Float): TextView {
        return TextView(this).apply {
            this.text = text
            setTextColor(Color.parseColor(accentHex))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f * scale)
            setTypeface(null, android.graphics.Typeface.BOLD)
            val bg = GradientDrawable().apply {
                setColor(Color.TRANSPARENT)
                cornerRadius = dp((12 * scale).toInt()).toFloat()
                setStroke(dp(2), Color.parseColor(accentHex))
            }
            background = bg
            val px = dp((14 * scale).toInt())
            val py = dp((10 * scale).toInt())
            setPadding(px, py, px, py)
            
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }
    }

    private fun showAppOptions(app: ResolveInfo) {
        val packageName = app.activityInfo.packageName
        val appName = app.loadLabel(packageManager).toString()
        
        val options = arrayOf(
            "Abrir",
            "Informações do aplicativo",
            "Desinstalar"
        )
        
        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle(appName)
            .setItems(options) { dialog, which ->
                when (which) {
                    0 -> { // Abrir
                        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
                        if (launchIntent != null) startActivity(launchIntent)
                    }
                    1 -> { // Informações
                        val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                            data = Uri.fromParts("package", packageName, null)
                        }
                        startActivity(intent)
                    }
                    2 -> { // Desinstalar
                        val intent = Intent(Intent.ACTION_DELETE).apply {
                            data = Uri.fromParts("package", packageName, null)
                        }
                        startActivity(intent)
                    }
                }
                dialog.dismiss()
            }
            .show()
    }

    private inner class AllAppsAdapter(
        private val apps: List<ResolveInfo>,
        private val pm: PackageManager
    ) : RecyclerView.Adapter<AllAppsAdapter.ViewHolder>() {

        inner class ViewHolder(val view: View) : RecyclerView.ViewHolder(view)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val item = LinearLayout(this@AllAppsActivity).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                isFocusable = true
                isClickable = true
                val p = dp((16 * scaleFactor).toInt())
                setPadding(p, p, p, p)
                
                val bg = GradientDrawable().apply {
                    setColor(Color.parseColor("#1A1A2E"))
                    cornerRadius = dp((12 * scaleFactor).toInt()).toFloat()
                }
                background = bg
                
                val m = dp((12 * scaleFactor).toInt())
                layoutParams = RecyclerView.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    setMargins(m, m, m, m)
                }

                setOnFocusChangeListener { v, hasFocus ->
                    val background = (v.background as? GradientDrawable) ?: return@setOnFocusChangeListener
                    if (hasFocus) {
                        background.setColor(Color.parseColor("#2A2A4A"))
                        background.setStroke(dp(2), Color.parseColor("#FFFFFF"))
                        v.scaleX = 1.05f
                        v.scaleY = 1.05f
                    } else {
                        background.setColor(Color.parseColor("#1A1A2E"))
                        background.setStroke(0, Color.TRANSPARENT)
                        v.scaleX = 1.0f
                        v.scaleY = 1.0f
                    }
                }
            }

            val iconContainer = FrameLayout(this@AllAppsActivity).apply {
                val s = dp((72 * scaleFactor).toInt())
                layoutParams = LinearLayout.LayoutParams(s, s).apply {
                    gravity = Gravity.CENTER
                }
                clipChildren = false
                clipToPadding = false
            }
            val icon = ImageView(this@AllAppsActivity).apply {
                val s = dp((64 * scaleFactor).toInt())
                layoutParams = FrameLayout.LayoutParams(s, s).apply {
                    gravity = Gravity.CENTER
                }
            }
            iconContainer.addView(icon)

            val label = TextView(this@AllAppsActivity).apply {
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f * scaleFactor)
                gravity = Gravity.CENTER
                maxLines = 2
                ellipsize = android.text.TextUtils.TruncateAt.END
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { topMargin = dp((8 * scaleFactor).toInt()) }
            }

            item.addView(iconContainer)
            item.addView(label)
            
            return ViewHolder(item)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val app = apps[position]
            val container = holder.view as LinearLayout
            val iconContainer = container.getChildAt(0) as FrameLayout
            val icon = iconContainer.getChildAt(0) as ImageView
            val label = container.getChildAt(1) as TextView

            icon.setImageDrawable(app.loadIcon(pm))
            label.text = app.loadLabel(pm)

            container.setOnClickListener {
                val launchIntent = pm.getLaunchIntentForPackage(app.activityInfo.packageName)
                if (launchIntent != null) {
                    startActivity(launchIntent)
                }
            }

            container.setOnLongClickListener {
                showAppOptions(app)
                true
            }
        }

        override fun getItemCount() = apps.size
    }
}
