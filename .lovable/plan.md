# Corrigir instalação do APK no app nativo

## Diagnóstico

A foto que você mandou é o **modal web de fallback** ("Sim, abrir / Não, agora não"). Ele só aparece quando o site **não detectou** a ponte nativa Android — então caiu no caminho do navegador: baixa via `fetch`, gera um `blob:` URL e clica num `<a target="_blank">`. Dentro de uma WebView, blob URL **não aciona o instalador de APK** — daí o "nada acontece".

No caminho nativo (o correto), esse modal nem deveria aparecer: o Kotlin baixa o APK e ao chegar em 100% abre o instalador do sistema sozinho.

Duas causas possíveis pra ponte não ser detectada:
1. `window.Android.isNative()` foi avaliado antes da WebView injetar a interface (timing de hidratação SSR).
2. WebView mais antiga em algumas TV Box que retorna o booleano de forma estranha.

## O que vou fazer

### 1. Frontend (`src/routes/index.tsx`)
- Trocar a detecção de nativo para **verificar `window.Android?.installApk` direto** (sem depender de `isNative()` retornar `true`). Se a função existe, é nativo. Ponto.
- Re-checar a presença do bridge em `useEffect` (depois da hidratação), guardar em `useState` — assim nunca cai no fallback web por erro de timing.
- Remover o `<a target="_blank">` do `openApk` quando estiver em WebView: usar `window.location.href = blobUrl` (mais compatível) — só usado se mesmo assim ficar no fallback.

### 2. Android — rede de segurança (`MainActivity.kt`)
- Adicionar `webView.setDownloadListener { ... }`. Se por qualquer motivo o site cair no caminho web e disparar um download de `.apk`, o Kotlin **intercepta** e roda o mesmo fluxo de `ApkDownloader` + `ApkInstaller`. Garante que **nunca** fique "nada acontecendo".

### 3. Android — instalador (`ApkInstaller.kt`)
- Quando `canRequestPackageInstalls()` é `false`, hoje só manda pra Configurações silenciosamente. Vou adicionar um `Toast` explicando ("Permita 'Instalar apps desconhecidos' e tente de novo") pra você não ficar sem feedback na primeira vez.

### 4. Documentação
- Atualizar `android/README.md` com a nota: na **primeira instalação** o Android pede permissão "Fontes desconhecidas" — autorize, volte ao app e clique baixar de novo. A partir daí funciona direto.

## Resultado esperado

Depois de recompilar e reinstalar o APK uma vez:
- Clica no card → barra de progresso → ao terminar, **abre direto o instalador do Android** (sem modal "Sim, abrir").
- Se for a primeira vez, abre a tela de permissão; autoriza uma vez e nas próximas vai direto.

## Detalhes técnicos

Arquivos alterados:
- `src/routes/index.tsx` — detecção de bridge + fallback
- `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt` — `setDownloadListener`
- `android/app/src/main/java/com/tvapps/launcher/ApkInstaller.kt` — Toast de permissão
- `android/README.md` — instrução de primeira instalação

Você precisa **recompilar o APK** (mudança em Kotlin). Mudanças só no `src/` web seriam refletidas automaticamente, mas aqui o fix principal é nativo.
