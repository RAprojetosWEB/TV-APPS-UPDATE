package com.rastream.platformtv

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Busca geolocalização aproximada por IP + clima atual (sem chave) via Open-Meteo.
 */
object StatusInfo {
    data class Weather(val tempC: Int, val emoji: String)

    private val client = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .build()

    // Fallback: São Paulo
    private const val FALLBACK_LAT = -23.55
    private const val FALLBACK_LON = -46.63

    suspend fun fetchWeather(): Weather? = withContext(Dispatchers.IO) {
        try {
            val (lat, lon) = fetchGeoIp() ?: (FALLBACK_LAT to FALLBACK_LON)
            val url = "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&current=temperature_2m,weather_code"
            val res = client.newCall(Request.Builder().url(url).build()).execute()
            res.use {
                if (!it.isSuccessful) return@withContext null
                val body = it.body?.string() ?: return@withContext null
                val json = JSONObject(body)
                val current = json.optJSONObject("current") ?: return@withContext null
                val temp = current.optDouble("temperature_2m", Double.NaN)
                val code = current.optInt("weather_code", -1)
                if (temp.isNaN()) return@withContext null
                Weather(temp.toInt(), emojiFor(code))
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun fetchGeoIp(): Pair<Double, Double>? {
        return try {
            val res = client.newCall(Request.Builder().url("https://ipapi.co/json/").build()).execute()
            res.use {
                if (!it.isSuccessful) return null
                val body = it.body?.string() ?: return null
                val json = JSONObject(body)
                val lat = json.optDouble("latitude", Double.NaN)
                val lon = json.optDouble("longitude", Double.NaN)
                if (lat.isNaN() || lon.isNaN()) null else lat to lon
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun emojiFor(code: Int): String = when (code) {
        0 -> "☀"
        1, 2 -> "🌤"
        3 -> "🌥"
        45, 48 -> "🌫"
        in 51..57 -> "🌦"
        in 61..67 -> "🌧"
        in 71..77 -> "❄"
        in 80..82 -> "🌧"
        in 85..86 -> "❄"
        in 95..99 -> "⛈"
        else -> "🌥"
    }
}
