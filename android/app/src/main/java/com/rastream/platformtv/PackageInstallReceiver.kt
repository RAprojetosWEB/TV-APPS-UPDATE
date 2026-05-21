package com.rastream.platformtv

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.widget.Toast

/**
 * Receiver para detectar quando um aplicativo do catálogo é instalado ou atualizado.
 * Ao detectar, remove o arquivo APK correspondente do cache e exibe um feedback.
 */
class PackageInstallReceiver(private val onPackageInstalled: (String) -> Unit) : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        val data = intent.dataString // package:com.example.app
        
        if ((action == Intent.ACTION_PACKAGE_ADDED || action == Intent.ACTION_PACKAGE_REPLACED) && data != null) {
            val packageName = data.removePrefix("package:")
            onPackageInstalled(packageName)
        }
    }

    companion object {
        fun register(context: Context, receiver: PackageInstallReceiver) {
            val filter = IntentFilter().apply {
                addAction(Intent.ACTION_PACKAGE_ADDED)
                addAction(Intent.ACTION_PACKAGE_REPLACED)
                addDataScheme("package")
            }
            context.registerReceiver(receiver, filter)
        }

        fun unregister(context: Context, receiver: PackageInstallReceiver) {
            try {
                context.unregisterReceiver(receiver)
            } catch (_: Exception) {
            }
        }
    }
}
