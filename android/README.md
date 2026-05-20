# TV Apps — Projeto Android nativo

App nativo Kotlin/Jetpack Compose (com suporte Android TV / Leanback) que
lista os APKs do catálogo, baixa via OkHttp com barra de progresso e
instala usando o `PackageInstaller` do sistema.

## Como gerar o APK

### Opção A — Android Studio (recomendado)

1. Instale o **Android Studio Hedgehog (2023.1.1) ou superior**.
2. Abra o Android Studio → **Open** → selecione a pasta `android/` deste repositório.
3. Aguarde o Gradle Sync terminar (baixa dependências automaticamente).
4. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. Clique em **locate** no popup — o APK estará em
   `android/app/build/outputs/apk/debug/app-debug.apk`.

### Opção B — Linha de comando

Requer JDK 17 instalado.

```bash
cd android
./gradlew assembleDebug          # Linux/macOS
gradlew.bat assembleDebug        # Windows
```

APK final: `app/build/outputs/apk/debug/app-debug.apk`.

## Como instalar na TV Box

1. Copie `app-debug.apk` para um pendrive ou envie via ADB:
   ```bash
   adb install -r app-debug.apk
   ```
2. Abra **TV Apps** na home da TV (aparece como Leanback launcher).
3. Use as setas ◀ ▶ do controle, **OK** baixa o app.
4. Ao terminar, o modal pergunta se deseja instalar — confirme.
5. Na primeira vez o Android pede permissão "Instalar apps desconhecidos"
   (Configurações → Apps → TV Apps → Fontes desconhecidas) — autorize uma vez.

## Editar a lista de apps

Abra `app/src/main/java/com/tvapps/launcher/AppCatalog.kt` e altere a lista
`apps`. Recompile e reinstale o APK.

## Estrutura

```
app/src/main/
  AndroidManifest.xml
  java/com/tvapps/launcher/
    MainActivity.kt        # entry point Compose
    AppCatalog.kt          # lista de apps
    ApkDownloader.kt       # download OkHttp + progresso
    ApkInstaller.kt        # FileProvider + intent de instalação
    ui/
      HomeScreen.kt        # cards, modal, DPAD
      HomeViewModel.kt     # estado dos downloads
  res/values/              # strings, cores, tema
  res/xml/file_paths.xml   # rotas FileProvider
```

## Configuração

- Min SDK 24 (Android 7.0 — cobre essencialmente toda TV Box atual)
- Target SDK 34, Compile SDK 34
- Kotlin 1.9.23, AGP 8.4.0, Compose BOM 2024.06.00
- Orientação travada em **landscape** no `AndroidManifest.xml`

## Próximos passos opcionais

- Gerar APK release assinado com keystore próprio (Build → Generate Signed Bundle / APK).
- Publicar no Google Play (precisa Bundle `.aab` + conta de desenvolvedor).
- Configurar atualizações OTA do próprio launcher (fora do escopo atual).