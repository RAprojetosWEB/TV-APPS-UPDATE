# Projeto Android Studio pronto + correções nativas

O projeto `android/` já existe no repositório. Vou deixá-lo **100% pronto pra abrir no Android Studio, sincronizar e gerar APK**, e ao mesmo tempo aplicar todas as correções para o download e instalação funcionarem nativamente (sem mais o modal "Sim, abrir / Não, agora não").

## O que você vai fazer (passos finais, só seu)

1. Baixar a pasta `android/` deste projeto (botão de download do Lovable / GitHub).
2. Abrir no Android Studio Hedgehog ou superior → "Open" → selecionar `android/`.
3. Esperar o Gradle Sync terminar (baixa SDKs automaticamente).
4. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. Instalar o APK gerado (`android/app/build/outputs/apk/debug/app-debug.apk`) na TV Box via pendrive ou `adb install`.

Pronto — a partir daí qualquer mudança visual feita no Lovable é refletida automaticamente na TV Box (a WebView carrega `https://sideload-hero.lovable.app`), **sem recompilar**.

## Mudanças que vou aplicar agora

### 1. Wrapper Gradle (`android/gradle/wrapper/gradle-wrapper.jar` + scripts)
Garantir que o `gradle-wrapper.jar` está presente e os scripts `gradlew` / `gradlew.bat` são executáveis — sem isso o Android Studio reclama no primeiro sync.

### 2. Frontend (`src/routes/index.tsx`)
- Detectar nativo via `typeof window.Android?.installApk === "function"` (não depende de `isNative()` resolver na hidratação SSR).
- Re-checar a ponte num `useEffect` e guardar em `useState` — nunca mais cai no fallback web por erro de timing.
- No fallback web (navegador comum), substituir o `<a target="_blank">` por `window.location.href = blobUrl` — mais compatível com WebView caso ainda assim caia ali.

### 3. Android — `MainActivity.kt`
Adicionar `webView.setDownloadListener { url, _, _, mime, _ -> ... }`. Se o site disparar download de `.apk` por qualquer motivo, o Kotlin intercepta e roda `ApkDownloader` + `ApkInstaller` — rede de segurança que garante que **nunca** fique "nada acontecendo".

### 4. Android — `WebAppBridge.kt`
Ampliar a allowlist de hosts (`apyjsxxuuptelmiwnzwq.supabase.co`, e o host do próprio site) e logar quando uma URL for rejeitada, para você ver `adb logcat` se algo vier de fonte diferente.

### 5. Android — `ApkInstaller.kt`
Quando `canRequestPackageInstalls()` for `false`, mostrar um `Toast` em português ("Autorize 'Instalar apps desconhecidos' e toque de novo no app") antes de abrir as Configurações — feedback claro na primeira instalação.

### 6. `android/README.md`
Reescrever em formato passo-a-passo (abrir no Android Studio → sync → Build APK → instalar → primeira permissão de Fontes desconhecidas → uso normal).

## Resultado esperado

Depois de compilar e instalar **uma vez** na TV Box:
- Clica no card → barra de progresso → ao chegar em 100%, **abre direto o instalador do sistema** (sem modal web).
- Primeira vez: Android pede a permissão de Fontes desconhecidas, você autoriza, e nas próximas instalações vai direto.
- Edições visuais feitas depois no Lovable aparecem sozinhas na TV Box ao reabrir o app.

## Arquivos alterados

- `src/routes/index.tsx`
- `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt`
- `android/app/src/main/java/com/tvapps/launcher/WebAppBridge.kt`
- `android/app/src/main/java/com/tvapps/launcher/ApkInstaller.kt`
- `android/gradle/wrapper/gradle-wrapper.jar` (garantir presença)
- `android/README.md`
