package com.tvapps.launcher.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Tv
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.collectAsState
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tvapps.launcher.AppCatalog
import com.tvapps.launcher.AppEntry

private val BgColor = Color(0xFF1A0D2E)
private val CardColor = Color(0xFF2A1A4A)
private val CardFocusedColor = Color(0xFF3A2660)
private val AccentColor = Color(0xFF22C55E)
private val AccentFocusColor = Color(0xFF16A34A)
private val TextColor = Color(0xFFF5F3FF)
private val MutedColor = Color(0xFFB8A8D1)
private val ErrorColor = Color(0xFFEF4444)

@Composable
fun HomeScreen(vm: HomeViewModel = viewModel()) {
    val context = LocalContext.current
    val states by vm.states.collectAsState()
    val modalIndex by vm.modalIndex.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BgColor)
            .padding(horizontal = 48.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        Header()

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            horizontalArrangement = Arrangement.spacedBy(24.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AppCatalog.apps.forEachIndexed { index, app ->
                AppCard(
                    app = app,
                    state = states[index],
                    autoFocus = index == 1 && modalIndex == null,
                    onClick = { vm.startDownload(context, index) },
                    modifier = Modifier.weight(1f),
                )
            }
        }

        Footer()
    }

    modalIndex?.let { idx ->
        val s = states[idx]
        if (s is AppState.Done) {
            InstallModal(
                appName = AppCatalog.apps[idx].name,
                onYes = {
                    vm.install(context, idx)
                },
                onNo = { vm.dismissModal(idx) },
            )
        }
    }
}

@Composable
private fun Header() {
    Column {
        Text(
            text = "TV Apps",
            color = TextColor,
            fontSize = 36.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = "Central de Apps para sua TV Box",
            color = MutedColor,
            fontSize = 18.sp,
        )
    }
}

@Composable
private fun Footer() {
    Text(
        text = "Use as setas do controle ◀ ▶ e pressione OK para baixar e instalar.",
        color = MutedColor,
        fontSize = 14.sp,
    )
}

@Composable
private fun AppCard(
    app: AppEntry,
    state: AppState,
    autoFocus: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var focused by remember { mutableStateOf(false) }
    val requester = remember { FocusRequester() }

    LaunchedEffect(autoFocus) {
        if (autoFocus) {
            try { requester.requestFocus() } catch (_: Throwable) {}
        }
    }

    val icon: ImageVector = when (app.packageHint) {
        "unitv" -> Icons.Filled.PlayArrow
        "nexa_tv" -> Icons.Filled.Tv
        else -> Icons.Filled.Download
    }

    Column(
        modifier = modifier
            .fillMaxHeight(0.8f)
            .clip(RoundedCornerShape(20.dp))
            .background(if (focused) CardFocusedColor else CardColor)
            .padding(28.dp)
            .focusRequester(requester)
            .onFocusChanged { focused = it.isFocused }
            .focusable()
            .onKeyEvent { ev ->
                if (ev.type == KeyEventType.KeyDown &&
                    (ev.key == Key.Enter || ev.key == Key.NumPadEnter || ev.key == Key.DirectionCenter)
                ) {
                    if (state is AppState.Idle || state is AppState.Error) {
                        onClick(); true
                    } else false
                } else false
            },
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = AccentColor,
            modifier = Modifier.size(64.dp),
        )
        Text(app.name, color = TextColor, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text(app.description, color = MutedColor, fontSize = 14.sp)

        Spacer(Modifier.weight(1f))

        when (state) {
            is AppState.Idle -> StatusPill("Baixar", Icons.Filled.Download, AccentColor)
            is AppState.Downloading -> {
                Text("${state.percent}%", color = TextColor, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                ProgressBar(state.percent)
            }
            is AppState.Done -> StatusPill("Pronto", Icons.Filled.CheckCircle, AccentColor)
            is AppState.Error -> StatusPill(state.message, Icons.Filled.ErrorOutline, ErrorColor)
        }
    }
}

@Composable
private fun StatusPill(label: String, icon: ImageVector, color: Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(imageVector = icon, contentDescription = null, tint = color, modifier = Modifier.size(22.dp))
        Text(label, color = color, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ProgressBar(percent: Int) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(10.dp)
            .clip(RoundedCornerShape(5.dp))
            .background(Color(0xFF1A0D2E))
    ) {
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .fillMaxWidth(percent / 100f)
                .background(AccentColor)
        )
    }
}

@Composable
private fun InstallModal(
    appName: String,
    onYes: () -> Unit,
    onNo: () -> Unit,
) {
    val yesRequester = remember { FocusRequester() }
    val noRequester = remember { FocusRequester() }
    var yesFocused by remember { mutableStateOf(true) }
    var noFocused by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try { yesRequester.requestFocus() } catch (_: Throwable) {}
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xCC000000)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .clip(RoundedCornerShape(24.dp))
                .background(CardColor)
                .padding(40.dp)
                .width(520.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(
                imageVector = Icons.Filled.CheckCircle,
                contentDescription = null,
                tint = AccentColor,
                modifier = Modifier.size(64.dp),
            )
            Text("Download concluído", color = TextColor, fontSize = 24.sp, fontWeight = FontWeight.Bold)
            Text("Deseja instalar $appName agora?", color = MutedColor, fontSize = 16.sp)

            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.padding(top = 12.dp),
            ) {
                ModalButton(
                    label = "Sim, instalar",
                    focused = yesFocused,
                    activeColor = AccentColor,
                    focusedColor = AccentFocusColor,
                    requester = yesRequester,
                    onFocus = { yesFocused = it; if (it) noFocused = false },
                    onLeft = null,
                    onRight = { noRequester.requestFocus() },
                    onConfirm = onYes,
                )
                ModalButton(
                    label = "Não, agora não",
                    focused = noFocused,
                    activeColor = Color(0xFF4B3A6E),
                    focusedColor = Color(0xFF6B509E),
                    requester = noRequester,
                    onFocus = { noFocused = it; if (it) yesFocused = false },
                    onLeft = { yesRequester.requestFocus() },
                    onRight = null,
                    onConfirm = onNo,
                )
            }
        }
    }
}

@Composable
private fun ModalButton(
    label: String,
    focused: Boolean,
    activeColor: Color,
    focusedColor: Color,
    requester: FocusRequester,
    onFocus: (Boolean) -> Unit,
    onLeft: (() -> Unit)?,
    onRight: (() -> Unit)?,
    onConfirm: () -> Unit,
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(if (focused) focusedColor else activeColor)
            .padding(horizontal = 28.dp, vertical = 16.dp)
            .focusRequester(requester)
            .onFocusChanged { onFocus(it.isFocused) }
            .focusable()
            .onKeyEvent { ev ->
                if (ev.type != KeyEventType.KeyDown) return@onKeyEvent false
                when (ev.key) {
                    Key.Enter, Key.NumPadEnter, Key.DirectionCenter -> { onConfirm(); true }
                    Key.DirectionLeft -> { onLeft?.invoke(); onLeft != null }
                    Key.DirectionRight -> { onRight?.invoke(); onRight != null }
                    Key.Back, Key.Escape -> { onConfirm.let {}; false }
                    else -> false
                }
            },
    ) {
        Text(label, color = TextColor, fontSize = 18.sp, fontWeight = FontWeight.Bold)
    }
}