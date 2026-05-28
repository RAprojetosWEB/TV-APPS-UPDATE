package com.tvapps.launcher

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView

class AddToQuickAccessActivity : Activity() {

    private val density by lazy { resources.displayMetrics.density }
    private fun dp(v: Int) = (v * density).toInt()
    private var scaleFactor = 1.0f

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Fullscreen
        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )
        
        val dm = resources.displayMetrics
        val widthDp = dm.widthPixels / dm.density
        scaleFactor = (widthDp / 1280f).coerceIn(0.85f, 1.1f)
        
        setContentView(R.layout.activity_add_to_quick_access)

        val title = findViewById<TextView>(R.id.title)
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 24f * scaleFactor)

        val recyclerView = findViewById<RecyclerView>(R.id.apps_grid)
        recyclerView.layoutManager = GridLayoutManager(this, 5)
        recyclerView.setHasFixedSize(true)

        val btnCancel = findViewById<Button>(R.id.btn_cancel)
        btnCancel.setOnClickListener {
            finish()
        }
        btnCancel.setOnFocusChangeListener { v, hasFocus ->
            if (hasFocus) {
                v.setBackgroundColor(Color.parseColor("#4DFFFFFF"))
            } else {
                v.setBackgroundColor(Color.parseColor("#33FFFFFF"))
            }
        }

        loadApps(recyclerView)
        
        // Foca no primeiro item da lista automaticamente
        recyclerView.post {
            if (recyclerView.childCount > 0) {
                recyclerView.getChildAt(0).requestFocus()
            }
        }
    }

    private fun loadApps(recyclerView: RecyclerView) {
        val pm = packageManager
        
        // Busca apps de launcher padrão
        val mainIntent = Intent(Intent.ACTION_MAIN, null).apply { addCategory(Intent.CATEGORY_LAUNCHER) }
        val standardApps = pm.queryIntentActivities(mainIntent, 0)
        
        // Busca apps de launcher de TV (Leanback)
        val tvIntent = Intent(Intent.ACTION_MAIN, null).apply { addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER) }
        val tvApps = pm.queryIntentActivities(tvIntent, 0)
        
        // Combina e remove duplicados
        val allApps = (standardApps + tvApps)
            .distinctBy { it.activityInfo.packageName }
            .sortedBy { it.loadLabel(pm).toString().lowercase() }

        recyclerView.adapter = AppsAdapter(allApps, pm)
    }

    private inner class AppsAdapter(
        private val apps: List<ResolveInfo>,
        private val pm: PackageManager
    ) : RecyclerView.Adapter<AppsAdapter.ViewHolder>() {

        inner class ViewHolder(val view: View) : RecyclerView.ViewHolder(view)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val item = LinearLayout(this@AddToQuickAccessActivity).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                isFocusable = true
                isClickable = true
                
                val p = dp((16 * scaleFactor).toInt())
                setPadding(p, p, p, p)
                
                val bg = GradientDrawable().apply {
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
                        background.setColor(Color.parseColor("#33FFFFFF"))
                        background.setStroke(dp(2), Color.WHITE)
                        v.scaleX = 1.1f
                        v.scaleY = 1.1f
                    } else {
                        background.setColor(Color.TRANSPARENT)
                        background.setStroke(0, Color.TRANSPARENT)
                        v.scaleX = 1.0f
                        v.scaleY = 1.0f
                    }
                }
            }

            val icon = ImageView(this@AddToQuickAccessActivity).apply {
                val s = dp((56 * scaleFactor).toInt())
                layoutParams = LinearLayout.LayoutParams(s, s)
            }

            val label = TextView(this@AddToQuickAccessActivity).apply {
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f * scaleFactor)
                gravity = Gravity.CENTER
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { topMargin = dp((6 * scaleFactor).toInt()) }
            }

            item.addView(icon)
            item.addView(label)
            
            return ViewHolder(item)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val app = apps[position]
            val container = holder.view as LinearLayout
            val icon = container.getChildAt(0) as ImageView
            val label = container.getChildAt(1) as TextView

            icon.setImageDrawable(app.loadIcon(pm))
            label.text = app.loadLabel(pm)

            container.setOnClickListener {
                LauncherSettings.addToDock(this@AddToQuickAccessActivity, app.activityInfo.packageName)
                finish()
            }
        }

        override fun getItemCount() = apps.size
    }
}
