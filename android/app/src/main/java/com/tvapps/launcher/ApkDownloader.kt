package com.tvapps.launcher

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import kotlin.math.roundToInt
import java.util.concurrent.TimeUnit

sealed class DownloadProgress {
    data class Progress(
        val percent: Int,
        val downloadedBytes: Long,
        val totalBytes: Long,
        val speedBytesPerSec: Long,
        val etaSeconds: Long,
    ) : DownloadProgress()
    data class Done(val file: File) : DownloadProgress()
    data class Error(val message: String) : DownloadProgress()
}

object ApkDownloader {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private fun estimateUnknownSizePercent(downloadedBytes: Long): Int {
        if (downloadedBytes <= 0L) return 0
        val downloadedMb = downloadedBytes / 1024.0 / 1024.0
        return ((downloadedMb * 100.0) / (downloadedMb + 20.0))
            .roundToInt()
            .coerceIn(1, 95)
    }

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

            emit(DownloadProgress.Progress(0, 0L, 0L, 0L, -1L))
            // Força resposta não-comprimida: gzip faz contentLength() devolver -1
            // e quebra o cálculo de progresso em hosts fora do Lovable Cloud.
            val request = Request.Builder()
                .url(url)
                .header("Accept-Encoding", "identity")
                .build()
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                emit(DownloadProgress.Error("HTTP ${response.code}"))
                return@flow
            }
            val body = response.body ?: run {
                emit(DownloadProgress.Error("Resposta vazia"))
                return@flow
            }
            // total <= 0 significa "tamanho desconhecido" (chunked / sem Content-Length).
            // Como Android TV nem sempre desenha bem barra indeterminada horizontal customizada,
            // usamos uma porcentagem visual aproximada até 95%; no final emitimos 100%.
            val total = body.contentLength()
            val knownTotal = total > 0L

            if (outFile.exists()) outFile.delete()

            body.byteStream().use { input ->
                outFile.outputStream().use { output ->
                    val buf = ByteArray(64 * 1024)
                    var read: Int
                    var downloaded = 0L
                    var lastPercent = -1
                    val startNs = System.nanoTime()
                    var windowStartNs = startNs
                    var windowStartBytes = 0L
                    var lastEmitNs = 0L
                    var smoothedBps = 0L
                    while (true) {
                        read = input.read(buf)
                        if (read == -1) break
                        output.write(buf, 0, read)
                        downloaded += read
                        val percent = if (knownTotal)
                            ((downloaded * 100) / total).toInt().coerceIn(0, 100)
                        else estimateUnknownSizePercent(downloaded)
                        val nowNs = System.nanoTime()
                        val windowMs = (nowNs - windowStartNs) / 1_000_000L
                        val emitMs = (nowNs - lastEmitNs) / 1_000_000L
                        // Recalcula velocidade a cada ~500ms
                        if (windowMs >= 500L) {
                            val deltaBytes = downloaded - windowStartBytes
                            val instBps = (deltaBytes * 1000L) / windowMs.coerceAtLeast(1L)
                            // EMA leve pra estabilizar
                            smoothedBps = if (smoothedBps == 0L) instBps
                                else (smoothedBps * 7 + instBps * 3) / 10
                            windowStartNs = nowNs
                            windowStartBytes = downloaded
                        }
                        if (percent != lastPercent || emitMs >= 250L) {
                            lastPercent = percent
                            lastEmitNs = nowNs
                            val eta = if (knownTotal && smoothedBps > 0)
                                ((total - downloaded).coerceAtLeast(0L)) / smoothedBps
                            else -1L
                            emit(
                                DownloadProgress.Progress(
                                    percent = percent,
                                    downloadedBytes = downloaded,
                                    totalBytes = if (knownTotal) total else 0L,
                                    speedBytesPerSec = smoothedBps,
                                    etaSeconds = eta,
                                )
                            )
                        }
                    }
                }
            }
            // Aprende o packageName real a partir do APK baixado
            InstalledRegistry.learnFromApk(context, fileNameHint, outFile)
            emit(DownloadProgress.Done(outFile))
        } catch (e: Exception) {
            emit(DownloadProgress.Error(e.message ?: "Erro desconhecido"))
        }
    }.flowOn(Dispatchers.IO)
}