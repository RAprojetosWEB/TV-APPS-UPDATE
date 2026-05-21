package com.tvapps.launcher

import android.content.Context
import java.io.File

/**
 * Limpeza automática do diretório de APKs baixados (context.cacheDir/apks).
 */
object ApkCache {
    private const val DIR = "apks"
    const val DEFAULT_MAX_BYTES: Long = 300L * 1024 * 1024 // 300 MB

    private fun dir(context: Context): File =
        File(context.cacheDir, DIR).apply { mkdirs() }

    private fun safeName(name: String): String =
        name.replace(Regex("[^A-Za-z0-9._-]"), "_")

    fun fileFor(context: Context, appName: String): File =
        File(dir(context), "${safeName(appName)}.apk")

    /** Apaga o APK de um app específico (chamado após instalação confirmada). */
    fun deleteFor(context: Context, appName: String): Boolean {
        val f = fileFor(context, appName)
        return if (f.exists()) f.delete() else false
    }

    /** Apaga APKs cujo app já está instalado e arquivos órfãos do catálogo. */
    fun cleanupInstalled(context: Context, catalog: List<CatalogApp>) {
        val d = dir(context)
        val files = d.listFiles() ?: return
        val validNames = catalog.map { "${safeName(it.name)}.apk" }.toSet()

        for (f in files) {
            // Órfãos: arquivos que não pertencem a nenhum app do catálogo
            if (f.name !in validNames) {
                f.delete()
                continue
            }
        }

        // Apps já instalados: apaga o APK em cache
        for (app in catalog) {
            if (InstalledRegistry.isInstalled(context, app)) {
                deleteFor(context, app.name)
            }
        }
    }

    /** Garante que o cache não ultrapasse o limite, apagando os mais antigos. */
    fun enforceSizeLimit(context: Context, maxBytes: Long = DEFAULT_MAX_BYTES) {
        val d = dir(context)
        val files = (d.listFiles() ?: return).toMutableList()
        var total = files.sumOf { it.length() }
        if (total <= maxBytes) return

        // Mais antigos primeiro
        files.sortBy { it.lastModified() }
        for (f in files) {
            if (total <= maxBytes) break
            val len = f.length()
            if (f.delete()) total -= len
        }
    }
}
