# Projeto Android 100% nativo, sem WebView

O problema atual é claro: o APK ainda carrega o site dentro de uma WebView, então visualmente e tecnicamente continua parecendo web. Vou substituir isso por uma tela Android nativa em Kotlin, com cards, foco por controle remoto, download, progresso e instalação de APK direto pelo sistema Android.

## Objetivo

Gerar um ZIP novo com a pasta `android/` contendo um projeto Android Studio pronto para abrir, sincronizar e gerar APK, sem depender do site publicado para funcionar.

## O que muda

### 1. Remover a WebView da experiência principal

- `MainActivity.kt` deixa de carregar `https://sideload-hero.lovable.app`.
- A tela inicial será construída nativamente em Kotlin.
- O app Android funcionará mesmo se o site web estiver fora do ar.

### 2. Criar catálogo nativo de apps

Adicionar `AppCatalog.kt` com a lista fixa dos apps:

- UniTV
- Nexa TV
- AllApp

Cada item terá nome, descrição e URL direta do APK. Para mudar a lista depois, você edita esse arquivo no Android Studio e recompila.

### 3. Criar UI nativa para TV Box

A tela Android terá:

- layout landscape fullscreen;
- cards grandes navegáveis por controle remoto;
- destaque visual no card focado;
- botão/ação por OK/Enter;
- barra de progresso nativa durante download;
- mensagens nativas de erro/sucesso.

### 4. Manter instalação nativa de APK

Reaproveitar `ApkDownloader.kt` e `ApkInstaller.kt`:

- clica no app;
- baixa o APK com OkHttp;
- mostra progresso;
- ao terminar, abre o instalador Android;
- na primeira vez, abre a tela para autorizar "Instalar apps desconhecidos".

### 5. Limpar dependências web do Android

- Remover `androidx.webkit` se não for mais usado.
- Remover `WebAppBridge.kt` ou deixar fora do fluxo principal.
- O projeto web atual em `src/` permanece intocado.

### 6. Atualizar README e gerar ZIP

Atualizar `android/README.md` explicando:

1. abrir `android/` no Android Studio;
2. aguardar Gradle sync;
3. gerar APK debug;
4. instalar na TV Box;
5. editar `AppCatalog.kt` para trocar apps/links.

Depois disso, gerar um novo arquivo `tv-apps-android-native.zip` para baixar direto aqui.

## Resultado esperado

Ao instalar o APK na TV Box:

- abre uma tela Android nativa, não um site;
- o controle remoto navega entre os apps;
- OK baixa e instala o APK;
- não aparece modal web;
- não depende do Lovable preview/publicado para rodar.

## Arquivos Android que serão alterados/criados

- `android/app/build.gradle.kts`
- `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt`
- `android/app/src/main/java/com/tvapps/launcher/AppCatalog.kt`
- `android/app/src/main/java/com/tvapps/launcher/ApkDownloader.kt` se precisar ajuste pequeno
- `android/app/src/main/java/com/tvapps/launcher/ApkInstaller.kt` se precisar ajuste pequeno
- `android/app/src/main/java/com/tvapps/launcher/WebAppBridge.kt` será removido ou deixado sem uso
- `android/README.md`

## O que não muda

- O app web em `src/` continua como está.
- Nenhuma dependência do projeto web será alterada.
- O APK ainda será gerado por você localmente no Android Studio, porque o sandbox não compila Android.
