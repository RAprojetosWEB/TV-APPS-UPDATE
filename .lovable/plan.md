# Projeto Android Studio nativo (Kotlin + Compose) — TV Apps

Criar uma nova pasta `android/` com um projeto Android Studio Kotlin pronto para abrir, sincronizar e gerar APK. O app é um launcher de TV Box que baixa e instala APKs **nativamente** (sem WebView), equivalente em função ao app web atual.

## Importante: substituição da pasta `android/` atual

Já existe uma pasta `android/` neste repositório com uma abordagem **diferente** (WebView que carrega o site Lovable + ponte JS↔Kotlin). O plano aqui é **substituí-la** por um app 100% nativo em Jetpack Compose for TV, sem WebView. Se quiser manter as duas versões lado a lado, me avise antes de aprovar — posso colocar a nova em `android-native/`.

O app web (`src/routes/index.tsx`, manifest PWA, etc.) **não é tocado** e continua funcionando em paralelo.

## Resultado para o usuário

1. Baixar a pasta `android/` do projeto.
2. Abrir no Android Studio (Hedgehog ou superior) → "Open" → selecionar `android/`.
3. Aguardar o Gradle sync.
4. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)** gera o `app-debug.apk` instalável em qualquer TV Box Android 7+.
5. Sideload do APK na TV Box (cabo, ADB ou pendrive).

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
- **Compose for TV** (`androidx.tv:tv-foundation`, `tv-material`) com foco visual e DPAD nativo — esquerda/direita navegam, OK seleciona, Back fecha modal.
- **Orientação landscape** travada no `AndroidManifest.xml` (`screenOrientation="landscape"`).
- **Download via OkHttp** com progresso reportado por `Flow<Int>` para barra Compose.
- **Instalação nativa via `PackageInstaller`** (Android 7+) — sem precisar passar por intent de "abrir arquivo". Em Android 8+ pede `REQUEST_INSTALL_PACKAGES` uma única vez.
- **FileProvider** configurado em `xml/file_paths.xml` para fallback via `ACTION_VIEW` (Android 6 / WebViews legadas).
- **Catálogo de apps**: lista hardcoded com os três APKs atuais (UniTV, Nexa TV, AllApp) apontando para as mesmas URLs do Supabase Storage que o site usa hoje.

## Permissões no Manifest

- `INTERNET`
- `REQUEST_INSTALL_PACKAGES`
- `FOREGROUND_SERVICE` (download continua com a tela ligada)
- `uses-feature leanback required=false` para aparecer na home da TV
- `category LEANBACK_LAUNCHER` no MainActivity

## Configuração Gradle

- `compileSdk = 34`, `minSdk = 24`, `targetSdk = 34`
- Kotlin 1.9, AGP 8.4, Compose BOM 2024.06
- `applicationId = "com.tvapps.launcher"`, `versionName = "1.0"`
- Build type `debug` assinado com a debug key padrão — instala em qualquer device sem configurar keystore

## O que NÃO muda

- O app web atual (`src/routes/index.tsx`, manifest PWA, etc.) permanece intocado.
- Nenhuma mudança em dependências do projeto web.

## Limitações

- O projeto **não é compilado pelo Lovable** (não temos JDK/Android SDK no sandbox). Você gera o APK localmente no Android Studio.
- Para mudar a lista de apps, edite `AppCatalog.kt` e recompile.
- Assinatura release/Play Store fica para passo futuro — o APK debug basta para sideload.

## Detalhes técnicos

- O `gradle-wrapper.jar` é binário; vou baixá-lo do mirror oficial Gradle (8.7) durante a geração, já que o sandbox não tem JDK mas tem `curl`.
- O `PackageInstaller` usa `Session.openWrite` + `commit` com `PendingIntent` de status, evitando `ACTION_VIEW` quando possível.
- `DownloadManager.kt` é um wrapper simples sobre OkHttp `ResponseBody.source()` emitindo `Flow<DownloadProgress>` (sealed class: `Progress(percent)`, `Done(file)`, `Error(msg)`).
- Cards focáveis usam `Modifier.focusable() + onFocusChanged` com escala/borda animada — padrão visual de launcher Android TV.
