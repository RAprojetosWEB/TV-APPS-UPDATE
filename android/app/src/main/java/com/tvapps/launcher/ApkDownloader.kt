package com.tvapps.launcher

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit

sealed class DownloadProgress {
    data class Progress(val percent: Int) : DownloadProgress()
    data class Done(val file: File) : DownloadProgress()
    data class Error(val message: String) : DownloadProgress()
}

object ApkDownloader {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    fun download(context: Context, url: String, fileNameHint: String): Flow<DownloadProgress> = flow {
        try {
            val dir = File(context.cacheDir, "apks").apply { mkdirs() }
            val safeName = fileNameHint.replace(Regex("[^A-Za-z0-9._-]"), "_")
            val outFile = File(dir, "$safeName.apk")

            // Inteligente: se o arquivo já existir, não baixa novamente
            if (outFile.exists() && outFile.length() > 0) {
                emit(DownloadProgress.Done(outFile))
                return@flow
            }

            emit(DownloadProgress.Progress(0))
            val request = Request.Builder().url(url).build()
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                emit(DownloadProgress.Error("HTTP ${response.code}"))
                return@flow
            }
            val body = response.body ?: run {
                emit(DownloadProgress.Error("Resposta vazia"))
                return@flow
            }
            val total = body.contentLength().coerceAtLeast(1L)
            
            if (outFile.exists()) outFile.delete()

            body.byteStream().use { input ->
                outFile.outputStream().use { output ->
                    val buf = ByteArray(64 * 1024)
                    var read: Int
                    var downloaded = 0L
                    var lastPercent = -1
                    while (true) {
                        read = input.read(buf)
                        if (read == -1) break
                        output.write(buf, 0, read)
                        downloaded += read
                        val percent = ((downloaded * 100) / total).toInt().coerceIn(0, 100)
                        if (percent != lastPercent) {
                            lastPercent = percent
                            emit(DownloadProgress.Progress(percent))
                        }
                    }
                }
            }
            emit(DownloadProgress.Done(outFile))
        } catch (e: Exception) {
            emit(DownloadProgress.Error(e.message ?: "Erro desconhecido"))
        }
    }.flowOn(Dispatchers.IO)
}