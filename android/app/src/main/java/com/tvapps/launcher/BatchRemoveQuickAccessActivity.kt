package com.tvapps.launcher

import android.app.Activity
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView

class BatchRemoveQuickAccessActivity : Activity() {

    private val density by lazy { resources.displayMetrics.density }
    private fun dp(v: Int) = (v * density).toInt()
    private var scaleFactor = 1.0f
    
    private val selectedPackageNames = mutableListOf<String>()
    
    private lateinit var btnCancel: Button
    private lateinit var btnMultiRemove: Button
    private lateinit var selectionCounter: TextView
    private lateinit var recyclerView: RecyclerView

    data class DockAppInfo(
        val packageName: String,
        val label: String,
        val icon: Drawable
    )

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
        
        setContentView(R.layout.activity_batch_remove_quick_access)

        val root = findViewById<View>(R.id.root_layout)
        val gradient = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(Color.parseColor("#1A237E"), Color.parseColor("#0D0D1A"))
        )
        root.background = gradient

        val title = findViewById<TextView>(R.id.title)
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 24f * scaleFactor)

        selectionCounter = findViewById(R.id.selection_counter)
        selectionCounter.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f * scaleFactor)

        recyclerView = findViewById(R.id.apps_grid)
        recyclerView.layoutManager = GridLayoutManager(this, 5)
        recyclerView.setHasFixedSize(true)

        btnMultiRemove = findViewById(R.id.btn_multi_remove)
        setupButton(btnMultiRemove, "#F44336") // Red for Remove
        btnMultiRemove.setOnClickListener {
            if (selectedPackageNames.isNotEmpty()) {
                val currentDock = LauncherSettings.getDockApps(this).toMutableList()
                selectedPackageNames.forEach { pkg ->
                    currentDock.remove(pkg)
                }
                // Salvamos o estado atualizado no SharedPreferences através do LauncherSettings
                // Como LauncherSettings não tem um setDockApps explícito, vou usar o saveDockApps refletido ou remover um a um
                // Na verdade LauncherSettings tem removeFromDock, mas vamos remover um a um para garantir consistência
                selectedPackageNames.forEach { pkg ->
                    LauncherSettings.removeFromDock(this, pkg)
                }
                
                MainActivity.pendingFocusAddDock = true
                finish()
            }
        }

        btnCancel = findViewById(R.id.btn_cancel)
        setupButton(btnCancel, "#33FFFFFF")
        btnCancel.setOnClickListener {
            finish()
        }

        loadDockApps()
        updateSelectionUI()
        
        // Foca no primeiro item da lista automaticamente
        recyclerView.post {
            if (recyclerView.childCount > 0) {
                recyclerView.getChildAt(0).requestFocus()
            }
        }
    }

    private fun setupButton(button: Button, colorStr: String) {
        button.apply {
            val bg = GradientDrawable().apply {
                setColor(Color.parseColor(colorStr))
                cornerRadius = dp(8).toFloat()
            }
            background = bg
            setOnFocusChangeListener { v, hasFocus ->
                val drawable = v.background as? GradientDrawable ?: return@setOnFocusChangeListener
                if (hasFocus) {
                    drawable.setStroke(dp(2), Color.WHITE)
                    v.scaleX = 1.05f
                    v.scaleY = 1.05f
                } else {
                    drawable.setStroke(0, Color.TRANSPARENT)
                    v.scaleX = 1.0f
                    v.scaleY = 1.0f
                }
            }
        }
    }

    private fun updateSelectionUI() {
        selectionCounter.text = "${selectedPackageNames.size} selecionados"
        btnMultiRemove.text = "Remover (${selectedPackageNames.size})"
        btnMultiRemove.isEnabled = selectedPackageNames.isNotEmpty()
        btnMultiRemove.alpha = if (selectedPackageNames.isNotEmpty()) 1.0f else 0.5f
    }

    private fun loadDockApps() {
        val pm = packageManager
        val dockPackages = LauncherSettings.getDockApps(this)
        val apps = mutableListOf<DockAppInfo>()
        
        dockPackages.forEach { pkg ->
            try {
                val info = pm.getApplicationInfo(pkg, 0)
                apps.add(DockAppInfo(
                    pkg,
                    pm.getApplicationLabel(info).toString(),
                    pm.getApplicationIcon(info)
                ))
            } catch (_: Exception) {}
        }

        recyclerView.adapter = DockAppsAdapter(apps)
    }

    private inner class DockAppsAdapter(
        private val apps: List<DockAppInfo>
    ) : RecyclerView.Adapter<DockAppsAdapter.ViewHolder>() {

        inner class ViewHolder(val view: View) : RecyclerView.ViewHolder(view)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val item = LinearLayout(this@BatchRemoveQuickAccessActivity).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                isFocusable = true
                isClickable = true
                
                val p = dp((16 * scaleFactor).toInt())
                setPadding(p, p, p, p)
                
                val bg = GradientDrawable().apply {
                    setColor(Color.parseColor("#1AFFFFFF"))
                    cornerRadius = dp((12 * scaleFactor).toInt()).toFloat()
                    setStroke(dp(1), Color.parseColor("#33FFFFFF"))
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
                    val isSelected = v.tag as? Boolean ?: false
                    
                    if (hasFocus) {
                        background.setColor(Color.parseColor("#33FFFFFF"))
                        background.setStroke(dp(2), if (isSelected) Color.parseColor("#F44336") else Color.parseColor("#80FFFFFF"))
                        v.scaleX = 1.1f
                        v.scaleY = 1.1f
                    } else {
                        background.setColor(Color.parseColor("#1AFFFFFF"))
                        background.setStroke(if (isSelected) dp(2) else dp(1), if (isSelected) Color.parseColor("#F44336") else Color.parseColor("#33FFFFFF"))
                        v.scaleX = 1.0f
                        v.scaleY = 1.0f
                    }
                }
            }

            val iconContainer = FrameLayout(this@BatchRemoveQuickAccessActivity).apply {
                val s = dp((64 * scaleFactor).toInt())
                layoutParams = LinearLayout.LayoutParams(s, s).apply {
                    gravity = Gravity.CENTER
                }
                clipChildren = false
                clipToPadding = false
            }
            val icon = ImageView(this@BatchRemoveQuickAccessActivity).apply {
                val s = dp((56 * scaleFactor).toInt())
                layoutParams = FrameLayout.LayoutParams(s, s).apply {
                    gravity = Gravity.CENTER
                }
            }
            iconContainer.addView(icon)

            val checkmark = TextView(this@BatchRemoveQuickAccessActivity).apply {
                text = "✓"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f * scaleFactor)
                gravity = Gravity.CENTER
                val s = dp(20)
                layoutParams = FrameLayout.LayoutParams(s, s).apply {
                    gravity = Gravity.TOP or Gravity.END
                }
                val bg = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(Color.parseColor("#F44336"))
                }
                background = bg
                visibility = View.GONE
            }
            iconContainer.addView(checkmark)

            val label = TextView(this@BatchRemoveQuickAccessActivity).apply {
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

            item.addView(iconContainer)
            item.addView(label)
            
            return ViewHolder(item)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val app = apps[position]
            val container = holder.view as LinearLayout
            val iconContainer = container.getChildAt(0) as FrameLayout
            val icon = iconContainer.getChildAt(0) as ImageView
            val checkmark = iconContainer.getChildAt(1) as TextView
            val label = container.getChildAt(1) as TextView

            icon.setImageDrawable(app.icon)
            label.text = app.label

            val isSelected = selectedPackageNames.contains(app.packageName)
            container.tag = isSelected
            checkmark.visibility = if (isSelected) View.VISIBLE else View.GONE
            
            val bg = container.background as GradientDrawable
            if (isSelected) {
                bg.setStroke(dp(2), Color.parseColor("#F44336"))
            } else {
                if (container.hasFocus()) {
                    bg.setStroke(dp(2), Color.parseColor("#80FFFFFF"))
                } else {
                    bg.setStroke(dp(1), Color.parseColor("#33FFFFFF"))
                }
            }

            container.setOnClickListener {
                if (selectedPackageNames.contains(app.packageName)) {
                    selectedPackageNames.remove(app.packageName)
                } else {
                    selectedPackageNames.add(app.packageName)
                }
                updateSelectionUI()
                notifyItemChanged(position)
            }
        }

        override fun getItemCount() = apps.size
    }
}