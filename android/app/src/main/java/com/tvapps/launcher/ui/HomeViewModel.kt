package com.tvapps.launcher.ui

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tvapps.launcher.ApkDownloader
import com.tvapps.launcher.ApkInstaller
import com.tvapps.launcher.AppCatalog
import com.tvapps.launcher.DownloadProgress
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File

sealed class AppState {
    object Idle : AppState()
    data class Downloading(val percent: Int) : AppState()
    data class Done(val file: File) : AppState()
    data class Error(val message: String) : AppState()
}

class HomeViewModel : ViewModel() {
    private val _states = MutableStateFlow<List<AppState>>(
        List(AppCatalog.apps.size) { AppState.Idle }
    )
    val states: StateFlow<List<AppState>> = _states.asStateFlow()

    private val _modalIndex = MutableStateFlow<Int?>(null)
    val modalIndex: StateFlow<Int?> = _modalIndex.asStateFlow()

    fun startDownload(context: Context, index: Int) {
        val app = AppCatalog.apps[index]
        update(index, AppState.Downloading(0))
        viewModelScope.launch {
            ApkDownloader.download(context, app).collect { p ->
                when (p) {
                    is DownloadProgress.Progress -> update(index, AppState.Downloading(p.percent))
                    is DownloadProgress.Done -> {
                        update(index, AppState.Done(p.file))
                        _modalIndex.value = index
                    }
                    is DownloadProgress.Error -> update(index, AppState.Error(p.message))
                }
            }
        }
    }

    fun install(context: Context, index: Int) {
        val s = _states.value[index]
        if (s is AppState.Done) {
            ApkInstaller.install(context, s.file)
        }
        _modalIndex.value = null
        update(index, AppState.Idle)
    }

    fun dismissModal(index: Int) {
        _modalIndex.value = null
        update(index, AppState.Idle)
    }

    private fun update(index: Int, state: AppState) {
        _states.value = _states.value.toMutableList().also { it[index] = state }
    }
}