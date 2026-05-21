package com.tvapps.launcher

import android.content.Context
import android.content.pm.PackageManager
import java.io.File

/**
 * Mapeia o nome do app no catálogo -> packageName real, aprendido a partir
 * do APK baixado. Persistido em SharedPreferences.
 */
object InstalledRegistry {
    private const val PREFS = "installedApps"

    fun learnFromApk(context: Context, catalogName: String, apk: File) {
        try {
            val info = context.packageManager.getPackageArchiveInfo(apk.absolutePath, 0)
                ?: return
            val pkg = info.packageName ?: return
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(catalogName, pkg)
                .apply()
        } catch (_: Exception) {
        }
    }

    fun getLearnedPackage(context: Context, catalogName: String): String? {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(catalogName, null)
    }

    /**
     * Resolve o packageName "efetivo" do app: usa o aprendido se existir,
     * senão cai para o placeholder do catálogo.
     */
    fun resolvePackage(context: Context, app: CatalogApp): String {
        return getLearnedPackage(context, app.name) ?: app.packageName
    }

    fun isInstalled(context: Context, app: CatalogApp): Boolean {
        val pm = context.packageManager
        val candidates = listOfNotNull(
            getLearnedPackage(context, app.name),
            app.packageName,
        ).distinct()
        for (pkg in candidates) {
            try {
                pm.getPackageInfo(pkg, 0)
                return true
            } catch (_: PackageManager.NameNotFoundException) {
            }
        }
        return false
    }
}
