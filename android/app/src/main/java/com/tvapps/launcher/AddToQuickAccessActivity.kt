package com.tvapps.launcher

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
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

class AddToQuickAccessActivity : Activity() {

    private val density by lazy { resources.displayMetrics.density }
    private fun dp(v: Int) = (v * density).toInt()
    private var scaleFactor = 1.0f
    
    private var isMultiSelectMode = false
    private val selectedApps = mutableListOf<ResolveInfo>()
    
    private lateinit var btnCancel: Button
    private lateinit var btnMultiAdd: Button
    private lateinit var btnMultiUninstall: Button
    private lateinit var selectionCounter: TextView
    private lateinit var recyclerView: RecyclerView

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

        btnMultiAdd = findViewById(R.id.btn_multi_add)
        setupButton(btnMultiAdd, "#4CAF50") // Green for Add
        btnMultiAdd.setOnClickListener {
            val packageNames = selectedApps.map { it.activityInfo.packageName }
            LauncherSettings.addMultipleToDock(this, packageNames)
            MainActivity.pendingFocusAddDock = true
            finish()
        }
        
        btnMultiUninstall = findViewById(R.id.btn_multi_uninstall)
        setupButton(btnMultiUninstall, "#F44336") // Red for Uninstall
        btnMultiUninstall.setOnClickListener {
            val appsToUninstall = selectedApps.toList()
            appsToUninstall.forEach { app ->
                uninstallApp(app.activityInfo.packageName)
            }
            // Saímos do modo de seleção após disparar as desinstalações
            exitMultiSelectMode()
        }

        btnCancel = findViewById(R.id.btn_cancel)
        setupButton(btnCancel, "#1A237E")
        btnCancel.setOnClickListener {
            if (isMultiSelectMode) {
                exitMultiSelectMode()
            } else {
                finish()
            }
        }

        loadApps()
        
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

    override fun onBackPressed() {
        if (isMultiSelectMode) {
            exitMultiSelectMode()
        } else {
            super.onBackPressed()
        }
    }

    private fun enterMultiSelectMode(initialApp: ResolveInfo) {
        isMultiSelectMode = true
        selectedApps.clear()
        selectedApps.add(initialApp)
        updateMultiSelectUI()
        recyclerView.adapter?.notifyDataSetChanged()
    }

    private fun exitMultiSelectMode() {
        isMultiSelectMode = false
        selectedApps.clear()
        updateMultiSelectUI()
        recyclerView.adapter?.notifyDataSetChanged()
    }

    private fun updateMultiSelectUI() {
        if (isMultiSelectMode) {
            selectionCounter.visibility = View.VISIBLE
            selectionCounter.text = "${selectedApps.size} selecionados"
            btnMultiAdd.visibility = View.VISIBLE
            btnMultiAdd.text = "Adicionar (${selectedApps.size})"
            btnCancel.text = "Cancelar"
        } else {
            selectionCounter.visibility = View.GONE
            btnMultiAdd.visibility = View.GONE
            btnCancel.text = "Voltar"
        }
    }

    private fun loadApps() {
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
                    setColor(Color.parseColor("#1AFFFFFF")) // White 10% opacity
                    cornerRadius = dp((12 * scaleFactor).toInt()).toFloat()
                    setStroke(dp(1), Color.parseColor("#33FFFFFF")) // Subtle border
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
                        background.setStroke(dp(2), if (isSelected) Color.parseColor("#4CAF50") else Color.parseColor("#80FFFFFF"))
                        v.scaleX = 1.1f
                        v.scaleY = 1.1f
                    } else {
                        background.setColor(Color.parseColor("#1AFFFFFF"))
                        background.setStroke(if (isSelected) dp(2) else dp(1), if (isSelected) Color.parseColor("#4CAF50") else Color.parseColor("#33FFFFFF"))
                        v.scaleX = 1.0f
                        v.scaleY = 1.0f
                    }
                }
            }

            val iconContainer = FrameLayout(this@AddToQuickAccessActivity).apply {
                val s = dp((64 * scaleFactor).toInt())
                layoutParams = LinearLayout.LayoutParams(s, s).apply {
                    gravity = Gravity.CENTER
                }
                clipChildren = false
                clipToPadding = false
            }
            val icon = ImageView(this@AddToQuickAccessActivity).apply {
                val s = dp((56 * scaleFactor).toInt())
                layoutParams = FrameLayout.LayoutParams(s, s).apply {
                    gravity = Gravity.CENTER
                }
            }
            iconContainer.addView(icon)

            // Checkmark overlay
            val checkmark = TextView(this@AddToQuickAccessActivity).apply {
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
                    setColor(Color.parseColor("#4CAF50"))
                }
                background = bg
                visibility = View.GONE
            }
            iconContainer.addView(checkmark)

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

            icon.setImageDrawable(app.loadIcon(pm))
            label.text = app.loadLabel(pm)

            val isSelected = selectedApps.contains(app)
            container.tag = isSelected
            checkmark.visibility = if (isSelected) View.VISIBLE else View.GONE
            
            val bg = container.background as GradientDrawable
            if (isSelected) {
                bg.setStroke(dp(2), Color.parseColor("#4CAF50"))
            } else {
                if (container.hasFocus()) {
                    bg.setStroke(dp(2), Color.parseColor("#80FFFFFF"))
                } else {
                    bg.setStroke(dp(1), Color.parseColor("#33FFFFFF"))
                }
            }

            container.setOnClickListener {
                if (isMultiSelectMode) {
                    if (selectedApps.contains(app)) {
                        selectedApps.remove(app)
                        if (selectedApps.isEmpty()) {
                            exitMultiSelectMode()
                        } else {
                            updateMultiSelectUI()
                            notifyItemChanged(position)
                        }
                    } else {
                        selectedApps.add(app)
                        updateMultiSelectUI()
                        notifyItemChanged(position)
                    }
                } else {
                    LauncherSettings.addToDock(this@AddToQuickAccessActivity, app.activityInfo.packageName)
                    MainActivity.pendingFocusAddDock = true
                    finish()
                }
            }

            container.setOnLongClickListener {
                if (!isMultiSelectMode) {
                    enterMultiSelectMode(app)
                    true
                } else {
                    false
                }
            }
        }

        override fun getItemCount() = apps.size
    }
}