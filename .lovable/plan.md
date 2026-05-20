# Projeto Android Studio nativo (Kotlin) — TV Apps

Gerar dentro deste repositório uma pasta `android/` com um projeto Android Studio Kotlin pronto para abrir, sincronizar e gerar APK. O app é um launcher de TV Box que baixa e instala APKs nativamente, equivalente em função ao app web atual.

## Resultado para o usuário

1. Baixar a pasta `android/` do projeto.
2. Abrir no Android Studio (Hedgehog ou superior) → "Open" → selecionar `android/`.
3. Aguardar Gradle sync.
4. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)** gera o `app-debug.apk` instalável em qualquer TV Box Android 7+.
5. Sideload do APK na TV Box (via cabo, ADB ou pendrive).

## Estrutura criada

```text
android/
  settings.gradle.kts
  build.gradle.kts
  gradle.properties
  gradle/wrapper/{gradle-wrapper.properties, gradle-wrapper.jar}
  gradlew, gradlew.bat
  app/
    build.gradle.kts
    proguard-rules.pro
    src/main/
      AndroidManifest.xml
      java/com/tvapps/launcher/
        MainActivity.kt          # tela principal Compose
        AppCatalog.kt            # lista hardcoded dos 3 APKs
        DownloadManager.kt       # baixa APK com progresso
        ApkInstaller.kt          # PackageInstaller nativo
        ui/                      # cards, botões DPAD, modal
      res/
        values/{strings.xml, themes.xml, colors.xml}
        drawable/                # ícones
        xml/file_paths.xml       # FileProvider
```

## Funcionalidades nativas

- **UI Jetpack Compose** com tema dark roxo equivalente ao web (background `#1a0d2e`, accent verde).
- **Compose for TV** (`androidx.tv:tv-foundation`, `tv-material`) com foco visual e suporte DPAD nativo — esquerda/direita navegam, OK seleciona, Back fecha modal.
- **Orientação landscape** travada no `AndroidManifest.xml` (`screenOrientation="landscape"`).
- **Download via `OkHttp`** com progresso reportado por `Flow<Int>` para barra Compose.
- **Instalação nativa via `PackageInstaller`** (Android 7+) — sem precisar passar por intent de "abrir arquivo". Em Android 8+ pede permissão `REQUEST_INSTALL_PACKAGES` uma única vez.
- **FileProvider** configurado em `xml/file_paths.xml` para casos onde fallback via `ACTION_VIEW` é necessário (Android 6 e WebView legadas).
- **Catálogo de apps**: lista hardcoded com os três APKs atuais (UniTV, Nexa TV, AllApp) apontando para as mesmas URLs do Supabase Storage que o site usa hoje.

## Permissões no Manifest

- `INTERNET`
- `REQUEST_INSTALL_PACKAGES`
- `FOREGROUND_SERVICE` (para o download continuar com a tela ligada)
- `<uses-feature android:name="android.software.leanback" android:required="false"/>` para aparecer na home da TV
- `<category android:name="android.intent.category.LEANBACK_LAUNCHER"/>` no MainActivity

## Configuração Gradle

- `compileSdk = 34`, `minSdk = 24` (cobre 99% das TV Box), `targetSdk = 34`.
- Kotlin 1.9, AGP 8.4, Compose BOM 2024.06.
- `applicationId = "com.tvapps.launcher"`, `versionName = "1.0"`.
- Build type `debug` assinado com a debug key padrão — APK instala em qualquer device sem configurar keystore.

## O que NÃO muda

- O app web atual (`src/routes/index.tsx`, manifest PWA, etc.) permanece intocado e continua funcionando em paralelo.
- Nenhuma mudança em dependências do projeto web.

## Limitações

- O projeto não é compilado pelo Lovable (não temos JDK/Android SDK no sandbox). Você gera o APK localmente no Android Studio.
- Para mudar a lista de apps, edite `AppCatalog.kt` e recompile.
- Assinatura release/Play Store fica para passo futuro — o APK debug basta para sideload.
