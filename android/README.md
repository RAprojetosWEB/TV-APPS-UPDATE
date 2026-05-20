# TV Apps — Projeto Android nativo (pronto pra Android Studio)

Launcher Kotlin para Android TV / TV Box. Carrega o site publicado no Lovable
(`https://sideload-hero.lovable.app`) dentro de uma WebView e instala APKs
nativamente via `PackageInstaller` — algo que o navegador comum não faz.

Mudanças visuais (botões, cores, lista de apps) são feitas no Lovable e
aparecem sozinhas na TV na próxima abertura — **sem recompilar**.

## Passo a passo — gerar o APK

1. Baixe a pasta `android/` deste projeto (botão de download do Lovable
   ou clone do GitHub).
2. Instale o **Android Studio Hedgehog (2023.1.1) ou superior**.
3. No Android Studio: **File → Open** → selecione a pasta `android/`.
4. Aguarde o **Gradle Sync** terminar (baixa SDK e dependências sozinho —
   na primeira vez leva alguns minutos).
5. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
6. No popup final clique em **locate**. O APK fica em:
   `android/app/build/outputs/apk/debug/app-debug.apk`.

### Alternativa: linha de comando (JDK 17)

```bash
cd android
./gradlew assembleDebug          # Linux/macOS
gradlew.bat assembleDebug        # Windows
```

## Instalar na TV Box

- **Via pendrive**: copie `app-debug.apk`, plugue na TV, abra um gerenciador
  de arquivos, toque no APK e instale.
- **Via ADB** (recomendado):
  ```bash
  adb connect <ip-da-tv>:5555
  adb install -r app-debug.apk
  ```

O app aparece na home como **TV Apps** (Leanback launcher).

## Primeira instalação de um APK pelo app

1. Abra **TV Apps**, navegue com ◀ ▶, pressione **OK** num card.
2. Aparece a barra de progresso. Ao chegar em 100%, o Android pede
   permissão **"Instalar apps desconhecidos"** (só na primeira vez).
3. Aceite, volte ao app e clique de novo. A partir daí, qualquer download
   abre o instalador direto, sem perguntar.

## Como funciona (resumo técnico)

- `MainActivity.kt` cria a WebView, injeta `window.Android` (a ponte JS)
  e instala um `setDownloadListener` que intercepta qualquer download `.apk`
  como rede de segurança.
- `WebAppBridge.kt` recebe `installApk(url, name)` do site, valida que o
  host está na `allowedHosts` e dispara o download.
- `ApkDownloader.kt` baixa via OkHttp emitindo progresso.
- `ApkInstaller.kt` usa `FileProvider` + intent `ACTION_VIEW` com MIME
  `application/vnd.android.package-archive` para abrir o instalador do
  sistema. Se faltar permissão, mostra um `Toast` e leva o usuário
  pras Configurações.

## Configurações importantes

- `MainActivity.SITE_URL` — domínio do site carregado. Troque aqui se
  publicar em domínio próprio.
- `WebAppBridge.allowedHosts` — hosts de onde o app aceita baixar APK.
  Mantenha curta por segurança.
- Min SDK 24 (Android 7.0). Target/Compile SDK 34. Kotlin 1.9.23, AGP 8.4.0.
- Orientação travada em landscape via `AndroidManifest.xml`.

## Editar a lista de apps

A lista é definida no site (`src/routes/index.tsx`, array `APPS`). Edite
pelo Lovable e publique — **não precisa recompilar o APK**.

## Próximos passos opcionais

- Gerar APK release assinado: **Build → Generate Signed Bundle / APK**
  com keystore próprio.
- Publicar no Google Play: precisa Bundle `.aab` + conta de desenvolvedor.