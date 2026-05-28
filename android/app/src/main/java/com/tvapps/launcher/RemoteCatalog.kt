package com.tvapps.launcher

import android.content.Context
import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Busca o catálogo de apps no endpoint público da web e cacheia localmente.
 *
 * Estratégia:
 *  - Ao abrir o app, carregamos imediatamente o cache (se houver) para zero delay visual.
 *  - Em paralelo, fazemos um GET para refrescar (timeout curto).
 *  - Se a resposta vier antes do build dos cards, usamos ela; senão, usamos o cache.
 *  - Sem cache + sem rede → fallback para `AppCatalog.apps` original (hardcoded).
 */
object RemoteCatalog {
    private const val TAG = "RemoteCatalog"
    private const val ENDPOINT = "https://tv-apps-update.lovable.app/api/public/catalog"
    private const val PREFS = "remote_catalog"
    private const val KEY_PAYLOAD = "payload"
    private const val KEY_TIMESTAMP = "timestamp"
    private const val CACHE_TTL_MS = 5L * 60_000L // 5 minutos
    private const val FETCH_TIMEOUT_MS = 4000

    /** Retorna a lista vinda do cache (mesmo expirado), ou null se nunca foi salvo. */
    fun loadCached(context: Context): List<CatalogApp>? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val payload = prefs.getString(KEY_PAYLOAD, null) ?: return null
        return runCatching { parse(payload) }.getOrNull()
    }

    /** True se o cache existe e está dentro do TTL. */
    fun isFresh(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val ts = prefs.getLong(KEY_TIMESTAMP, 0L)
        return ts > 0L && System.currentTimeMillis() - ts < CACHE_TTL_MS
    }

    /**
     * Faz GET no endpoint e retorna a lista parseada, ou null em caso de erro/timeout.
     * Bloqueante — chame em background thread.
     */
    fun fetchSync(context: Context): List<CatalogApp>? {
        return try {
            val conn = (URL(ENDPOINT).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = FETCH_TIMEOUT_MS
                readTimeout = FETCH_TIMEOUT_MS
                setRequestProperty("Accept", "application/json")
            }
            val code = conn.responseCode
            if (code !in 200..299) {
                Log.w(TAG, "Catalog HTTP $code")
                conn.disconnect()
                return null
            }
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            conn.disconnect()
            // Persiste cache
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(KEY_PAYLOAD, body)
                .putLong(KEY_TIMESTAMP, System.currentTimeMillis())
                .apply()
            parse(body)
        } catch (e: Exception) {
            Log.w(TAG, "fetchSync failed: ${e.message}")
            null
        }
    }

    private fun parse(body: String): List<CatalogApp> {
        val obj = JSONObject(body)
        val arr = obj.optJSONArray("apps") ?: return emptyList()
        val out = mutableListOf<CatalogApp>()
        for (i in 0 until arr.length()) {
            val a = arr.getJSONObject(i)
            val name = a.optString("name", "")
            val pkg = a.optString("package_name", "")
            if (name.isBlank() || pkg.isBlank()) continue
            out.add(
                CatalogApp(
                    name = name,
                    description = a.optString("description", ""),
                    url = a.optString("apk_url", ""),
                    icon = "▶",
                    packageName = pkg,
                    iconRes = iconResFor(pkg, name),
                    iconUrl = a.optString("icon_url", null).takeIf { !it.isNullOrBlank() }
                        ?: a.optString("logo_url", null).takeIf { !it.isNullOrBlank() },
                    isBlocked = a.optBoolean("is_blocked", false),
                    blockReason = a.optString("block_reason", null).takeIf { !it.isNullOrBlank() },
                )
            )
        }
        return out
    }

    private fun iconResFor(packageName: String, name: String): Int {
        // Mantém os drawables locais como fallback visual para os 3 apps originais.
        return when {
            packageName.contains("unitv", ignoreCase = true) ||
                name.equals("UniTV", ignoreCase = true) -> R.drawable.ic_unitv
            packageName.contains("nexa", ignoreCase = true) ||
                name.equals("Nexa TV", ignoreCase = true) -> R.drawable.ic_nexa
            packageName.contains("alphaplay", ignoreCase = true) ||
                name.equals("AlphaPlay", ignoreCase = true) -> R.drawable.ic_alphaplay
            else -> R.drawable.ic_unitv
        }
    }
}