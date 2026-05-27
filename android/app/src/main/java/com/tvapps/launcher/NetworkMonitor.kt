package com.tvapps.launcher

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.Looper

/**
 * Monitora o estado da rede em tempo real (sem polling) usando
 * ConnectivityManager.registerDefaultNetworkCallback.
 *
 * Compatível com Android TV, TV Box e Fire TV (API 21+).
 */
class NetworkMonitor(private val context: Context) {

    enum class State {
        OFFLINE,
        WIFI_LEVEL_1,
        WIFI_LEVEL_2,
        WIFI_LEVEL_3,
        WIFI_LEVEL_4,
        WIFI_NO_INTERNET,
        ETHERNET,
        ETHERNET_NO_INTERNET,
    }

    fun interface Listener {
        fun onChanged(state: State)
    }

    private val main = Handler(Looper.getMainLooper())
    private val cm: ConnectivityManager? =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
    private val wifi: WifiManager? = context.applicationContext
        .getSystemService(Context.WIFI_SERVICE) as? WifiManager

    private var callback: ConnectivityManager.NetworkCallback? = null
    private var listener: Listener? = null
    private var lastState: State? = null

    fun start(listener: Listener) {
        this.listener = listener
        val manager = cm
        if (manager == null) {
            emit(State.OFFLINE)
            return
        }
        if (callback != null) return

        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                // Estado é recalculado em onCapabilitiesChanged
            }

            override fun onLost(network: Network) {
                emit(State.OFFLINE)
            }

            override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                emit(computeState(caps))
            }
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                manager.registerDefaultNetworkCallback(cb)
            } else {
                val req = NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build()
                manager.registerNetworkCallback(req, cb)
            }
            callback = cb
            // Estado inicial conservador até a primeira capability chegar
            emit(currentState())
        } catch (_: Throwable) {
            // Algumas ROMs (TV boxes MXQ/genéricas) podem rejeitar o callback
            callback = null
            emit(State.OFFLINE)
        }
    }

    fun stop() {
        val cb = callback ?: run {
            listener = null
            return
        }
        try { cm?.unregisterNetworkCallback(cb) } catch (_: Throwable) {}
        callback = null
        listener = null
        lastState = null
    }

    private fun currentState(): State {
        val manager = cm ?: return State.OFFLINE
        val net = manager.activeNetwork ?: return State.OFFLINE
        val caps = manager.getNetworkCapabilities(net) ?: return State.OFFLINE
        return computeState(caps)
    }

    private fun computeState(caps: NetworkCapabilities): State {
        val validated = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        return when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) ->
                if (validated) State.ETHERNET else State.ETHERNET_NO_INTERNET

            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> {
                if (!validated) State.WIFI_NO_INTERNET
                else wifiLevelState(caps)
            }

            // Celular ou outros transportes → online genérico se validado
            validated -> State.WIFI_LEVEL_4
            else -> State.OFFLINE
        }
    }

    private fun wifiLevelState(caps: NetworkCapabilities): State {
        val rssi: Int? = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                caps.signalStrength.takeIf { it != Int.MIN_VALUE }
            } else null
        } catch (_: Throwable) { null } ?: try {
            @Suppress("DEPRECATION")
            wifi?.connectionInfo?.rssi
        } catch (_: Throwable) { null }

        val r = rssi ?: return State.WIFI_LEVEL_4
        val level = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                wifi?.calculateSignalLevel(r) ?: legacyLevel(r)
            } else legacyLevel(r)
        } catch (_: Throwable) {
            legacyLevel(r)
        }
        return when (level.coerceIn(0, 4)) {
            0, 1 -> State.WIFI_LEVEL_1
            2 -> State.WIFI_LEVEL_2
            3 -> State.WIFI_LEVEL_3
            else -> State.WIFI_LEVEL_4
        }
    }

    private fun legacyLevel(rssi: Int): Int {
        @Suppress("DEPRECATION")
        return WifiManager.calculateSignalLevel(rssi, 5)
    }

    private fun emit(state: State) {
        if (state == lastState) return
        lastState = state
        main.post { listener?.onChanged(state) }
    }
}
