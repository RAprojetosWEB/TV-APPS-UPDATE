package com.tvapps.launcher

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import android.widget.ImageView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.security.MessageDigest

/**
 * Carrega ícones remotos (URL HTTP) em um ImageView, com cache em disco
 * (cacheDir/icon-cache/<sha1>.bin) e cache em memória (LRU 4MB).
 *
 * Estratégia:
 * 1) Aplica o fallback (drawable bundled) imediatamente para evitar flash.
 * 2) Tenta servir do cache em memória.
 * 3) Tenta servir do cache em disco.
 * 4) Faz download via OkHttp; em sucesso grava no disco e atualiza a View
 *    (somente se a tag da View ainda for a URL solicitada — evita race em
 *    listas recicladas).
 *
 * Como o icon_url do servidor inclui um timestamp no path, trocar o ícone
 * no admin gera URL nova → cache-miss automático → redownload.
 */
object RemoteIconLoader {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val http: OkHttpClient by lazy {
        OkHttpClient.Builder().build()
    }
    private val memCache = object : LruCache<String, Bitmap>(4 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap): Int = value.byteCount
    }

    fun loadInto(context: Context, view: ImageView, url: String, fallbackRes: Int) {
        // Fallback imediato + marca a View com a URL pretendida
        view.setImageResource(fallbackRes)
        view.tag = url

        memCache.get(url)?.let {
            view.setImageBitmap(it)
            return
        }

        val appCtx = context.applicationContext
        scope.launch {
            val bmp = loadFromDiskOrNetwork(appCtx, url) ?: return@launch
            memCache.put(url, bmp)
            withContext(Dispatchers.Main) {
                if (view.tag == url) {
                    view.setImageBitmap(bmp)
                }
            }
        }
    }

    private fun loadFromDiskOrNetwork(context: Context, url: String): Bitmap? {
        val file = cacheFile(context, url)
        if (file.exists() && file.length() > 0) {
            decodeFile(file)?.let { return it }
        }
        return downloadToFile(url, file)?.let { decodeFile(it) }
    }

    private fun downloadToFile(url: String, dest: File): File? {
        return try {
            val req = Request.Builder().url(url).build()
            http.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return null
                val body = resp.body ?: return null
                dest.parentFile?.mkdirs()
                val tmp = File(dest.parentFile, dest.name + ".tmp")
                tmp.outputStream().use { out -> body.byteStream().copyTo(out) }
                if (!tmp.renameTo(dest)) {
                    tmp.copyTo(dest, overwrite = true)
                    tmp.delete()
                }
                dest
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun decodeFile(file: File): Bitmap? = try {
        BitmapFactory.decodeFile(file.absolutePath)
    } catch (_: Exception) {
        null
    }

    private fun cacheFile(context: Context, url: String): File {
        val dir = File(context.cacheDir, "icon-cache")
        return File(dir, sha1(url) + ".bin")
    }

    private fun sha1(input: String): String {
        val md = MessageDigest.getInstance("SHA-1")
        val bytes = md.digest(input.toByteArray(Charsets.UTF_8))
        val sb = StringBuilder(bytes.size * 2)
        for (b in bytes) sb.append("%02x".format(b))
        return sb.toString()
    }
}