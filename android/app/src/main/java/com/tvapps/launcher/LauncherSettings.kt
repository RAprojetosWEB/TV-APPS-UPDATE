package com.tvapps.launcher

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray

object LauncherSettings {
    private const val PREFS_NAME = "launcher_settings"
    private const val KEY_FAVORITES = "favorites"
    private const val KEY_HIDDEN_APPS = "hidden_apps"

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun getFavorites(context: Context): Set<String> {
        val json = getPrefs(context).getString(KEY_FAVORITES, "[]") ?: "[]"
        val array = JSONArray(json)
        val set = mutableSetOf<String>()
        for (i in 0 until array.length()) {
            set.add(array.getString(i))
        }
        return set
    }

    fun addFavorite(context: Context, packageName: String) {
        val favorites = getFavorites(context).toMutableSet()
        if (favorites.add(packageName)) {
            saveFavorites(context, favorites)
        }
    }

    fun removeFavorite(context: Context, packageName: String) {
        val favorites = getFavorites(context).toMutableSet()
        if (favorites.remove(packageName)) {
            saveFavorites(context, favorites)
        }
    }

    private fun saveFavorites(context: Context, favorites: Set<String>) {
        val array = JSONArray()
        favorites.forEach { array.put(it) }
        getPrefs(context).edit().putString(KEY_FAVORITES, array.toString()).apply()
    }

    fun getHiddenApps(context: Context): Set<String> {
        val json = getPrefs(context).getString(KEY_HIDDEN_APPS, "[]") ?: "[]"
        val array = JSONArray(json)
        val set = mutableSetOf<String>()
        for (i in 0 until array.length()) {
            set.add(array.getString(i))
        }
        return set
    }

    fun hideApp(context: Context, packageName: String) {
        val hidden = getHiddenApps(context).toMutableSet()
        if (hidden.add(packageName)) {
            saveHiddenApps(context, hidden)
        }
    }

    fun unhideApp(context: Context, packageName: String) {
        val hidden = getHiddenApps(context).toMutableSet()
        if (hidden.remove(packageName)) {
            saveHiddenApps(context, hidden)
        }
    }

    private fun saveHiddenApps(context: Context, hidden: Set<String>) {
        val array = JSONArray()
        hidden.forEach { array.put(it) }
        getPrefs(context).edit().putString(KEY_HIDDEN_APPS, array.toString()).apply()
    }
}
