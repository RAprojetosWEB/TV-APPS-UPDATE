# TV Apps — App Android nativo (Kotlin)

App de TV Box 100% nativo. Tela inicial em Kotlin (sem WebView), com cards
navegáveis por controle remoto. Cada card baixa o APK e abre o instalador
do Android.

## Como gerar o APK

1. Baixe a pasta `android/`.
2. Abra no Android Studio Hedgehog ou superior → "Open" → selecione `android/`.
3. Aguarde o Gradle Sync.
4. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. O APK fica em `android/app/build/outputs/apk/debug/app-debug.apk`.

## Instalar na TV Box

- Copie o APK para um pendrive ou use `adb install app-debug.apk`.
- Primeira vez: o Android pede permissão "Instalar apps desconhecidos".
  Autorize e toque de novo no card.
- Próximas instalações vão direto para o instalador.

## Editar a lista de apps

Abra `android/app/src/main/java/com/tvapps/launcher/AppCatalog.kt`,
altere/adicione itens (nome, descrição, URL do APK) e recompile.

## Estrutura

- `MainActivity.kt` — tela nativa com cards e foco para controle remoto.
- `AppCatalog.kt` — lista de apps disponíveis.
- `ApkDownloader.kt` — download com OkHttp e progresso.
- `ApkInstaller.kt` — abre o instalador nativo via FileProvider.
