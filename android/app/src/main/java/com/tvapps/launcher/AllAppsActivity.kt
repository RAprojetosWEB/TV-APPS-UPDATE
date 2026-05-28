package com.tvapps.launcher

import android.app.Activity
import android.content.Context
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
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView

class AllAppsActivity : Activity() {

    private val density by lazy { resources.displayMetrics.density }
    private fun dp(v: Int) = (v * density).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Fullscreen as requested
        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )
        
        val scale = 1.0f // Standard scale for the new activity
        
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#0d0820")) // Opaque background
            val p = dp(40)
            setPadding(p, p, p, p)
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
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f)
            setTypeface(null, android.graphics.Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }

        val closeBtn = makeStatusPill("Fechar", "#FFFFFF", scale).apply {
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
                    bg.setColor(Color.parseColor("#1AFFFFFF"))
                    bg.setStroke(dp(1), Color.parseColor("#33FFFFFF"))
                }
            }
        }

        topRow.addView(title)
        topRow.addView(closeBtn)
        root.addView(topRow)

        val recyclerView = RecyclerView(this).apply {
            id = View.generateViewId()
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
            ).apply { topMargin = dp(24) }
            layoutManager = GridLayoutManager(this@AllAppsActivity, 6)
        }
        
        root.addView(recyclerView)
        setContentView(root)

        loadApps(recyclerView)
    }

    private fun loadApps(recyclerView: RecyclerView) {
        val pm = packageManager
        val intent = Intent(Intent.ACTION_MAIN, null).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }
        
        // Use user's requested query
        val apps = pm.queryIntentActivities(intent, 0)
        
        // Also consider TV launcher apps as before if relevant, 
        // but user specifically gave a snippet, so I'll follow it closely.
        // However, usually on TV we want LEANBACK_LAUNCHER too.
        // Let's include both to be safe and avoid regression.
        val tvIntent = Intent(Intent.ACTION_MAIN, null).apply { 
            addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER) 
        }
        val tvApps = pm.queryIntentActivities(tvIntent, 0)
        
        val combinedApps = (apps + tvApps).distinctBy { it.activityInfo.packageName }
        val hidden = LauncherSettings.getHiddenApps(this)
        val filteredApps = combinedApps.filter { !hidden.contains(it.activityInfo.packageName) }
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
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }
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
                val p = dp(16)
                setPadding(p, p, p, p)
                
                val bg = GradientDrawable().apply {
                    cornerRadius = dp(12).toFloat()
                }
                background = bg
                
                layoutParams = RecyclerView.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )

                setOnFocusChangeListener { v, hasFocus ->
                    val background = (v.background as? GradientDrawable) ?: return@setOnFocusChangeListener
                    if (hasFocus) {
                        background.setColor(Color.parseColor("#33FFFFFF"))
                        background.setStroke(dp(2), Color.parseColor("#FFFFFF"))
                        v.scaleX = 1.05f
                        v.scaleY = 1.05f
                    } else {
                        background.setColor(Color.TRANSPARENT)
                        background.setStroke(0, Color.TRANSPARENT)
                        v.scaleX = 1.0f
                        v.scaleY = 1.0f
                    }
                }
            }

            val icon = ImageView(this@AllAppsActivity).apply {
                layoutParams = LinearLayout.LayoutParams(dp(64), dp(64))
            }

            val label = TextView(this@AllAppsActivity).apply {
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                gravity = Gravity.CENTER
                maxLines = 2
                ellipsize = android.text.TextUtils.TruncateAt.END
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { topMargin = dp(8) }
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
                val launchIntent = pm.getLaunchIntentForPackage(app.activityInfo.packageName)
                if (launchIntent != null) {
                    startActivity(launchIntent)
                }
            }
        }

        override fun getItemCount() = apps.size
    }
}
