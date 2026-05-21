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
        
        // 1. Verificar candidatos diretos (aprendido ou placeholder)
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

        // 2. Opção B: Heurística - procurar por nome ou label nos pacotes instalados
        // Isso resolve quando o app já estava instalado de outra fonte
        try {
            val installedApps = pm.getInstalledPackages(0)
            val searchTerms = listOfNotNull(
                app.name.lowercase(),
                app.packageName.lowercase(),
                app.packageName.substringAfterLast(".").lowercase().takeIf { it.length > 3 }
            ).distinct()

            for (pkgInfo in installedApps) {
                val pkgName = pkgInfo.packageName.lowercase()
                
                // 1. Verificar pelo nome do pacote
                var match = searchTerms.any { term -> pkgName.contains(term) }
                
                // 2. Verificar pelo label do aplicativo (nome que o usuário vê)
                if (!match) {
                    val label = try {
                        pm.getApplicationLabel(pkgInfo.applicationInfo).toString().lowercase()
                    } catch (_: Exception) { "" }
                    
                    if (label.isNotEmpty() && label.contains(app.name.lowercase())) {
                        match = true
                    }
                }

                if (match) {
                    // Aprender esse pacote para futuras verificações rápidas
                    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        .edit()
                        .putString(app.name, pkgInfo.packageName)
                        .apply()
                    return true
                }
            }
        } catch (_: Exception) {
        }

        return false
    }
}
