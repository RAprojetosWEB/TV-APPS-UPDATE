# Corrigir o erro "blob" e simplificar o fluxo de download

## O que a foto está mostrando

Dois sintomas ao mesmo tempo:
1. O **modal web** ("Sim, abrir / Não, agora não") apareceu — ou seja, o site executou o caminho do navegador, não o caminho nativo.
2. O **toast vermelho** "Erro no download: Expected URL scheme 'http' or 'https' but was 'blob'" — esse erro vem do código **Kotlin novo**, prova que o APK foi recompilado e o `setDownloadListener` está ativo. Ele tentou interceptar o download que o navegador disparou, mas o navegador entregou um `blob:` (não um `http://`), e o `ApkDownloader` só sabe lidar com URL http/https.

Ou seja: o `setDownloadListener` está funcionando, mas a estratégia de "baixar via fetch e clicar num `<a download>`" no fallback web bate de frente com ele. Os dois caminhos se atropelam.

E o motivo do site cair no fallback web em vez do nativo é provavelmente um detalhe da WebView: o `typeof window.Android.installApk === "function"` pode retornar `"object"` em algumas WebViews (métodos de `addJavascriptInterface` não são funções JS "puras"). Aí a detecção falha mesmo a ponte existindo.

## Estratégia (mais simples e robusta)

Em vez de tentar fazer dois caminhos (nativo bonito + fallback web com blob), vou **deixar um único caminho funcionar bem em todo lugar**:

- **No app nativo**: a ponte `window.Android.installApk(...)` é usada quando detectada. Se a detecção falhar, o `setDownloadListener` do Kotlin ainda intercepta a navegação para o `.apk` e roda o mesmo fluxo nativo. Dos dois jeitos dá certo.
- **No navegador comum**: clicar no card faz `window.location.href = url do .apk`. O Chrome reconhece o tipo e baixa direto. Sem blob, sem `<a download>`, sem modal "Sim, abrir".

## O que vou alterar

### 1. `src/routes/index.tsx`
- Trocar a detecção para algo que funciona mesmo quando `typeof` mente:
  `!!window.Android && "installApk" in window.Android`.
- **Remover o fallback do blob inteiro**: nada de `fetch` + `URL.createObjectURL` + `<a download>`. No não-nativo, simplesmente navegar para a URL do APK (`window.location.href = app.url`).
- **Remover o modal "Sim, abrir / Não, agora não"** — ele só existia por causa do fluxo blob. Sem blob, não precisa.
- Adicionar um pequeno **indicador de debug** no rodapé mostrando se a ponte nativa foi detectada (`Native: sim / não` + versão). Assim na próxima vez você me manda foto e eu sei na hora se o problema é detecção ou outra coisa.

### 2. Kotlin — já está bom
- `setDownloadListener` continua igual. Agora ele sempre vai receber URLs `http(s)`, que é o que o `ApkDownloader` aceita. O erro "blob" não vai mais acontecer.
- Como medida extra, adicionar uma checagem `if (url.startsWith("blob:")) return` só pra não vazar toast feio caso algo escape no futuro.

## Resultado esperado

Depois de publicar (web) + recompilar o APK uma vez (por causa da micro-mudança em Kotlin, opcional):
- Clica no card → barra de progresso nativa → instalador abre sozinho. Sem modal, sem toast de erro.
- Se algo travar a detecção da ponte, o `setDownloadListener` salva o dia silenciosamente (mesmo fluxo nativo).

## Detalhes técnicos

Arquivos alterados:
- `src/routes/index.tsx` — detecção robusta, fallback simples por navegação direta, remoção do modal + blob, indicador de debug.
- `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt` — early return se url começa com `blob:` no `setDownloadListener` (cosmético).

A mudança principal é **web**. Se você só clicar em Publish, já resolve o erro da foto (o modal/blob somem). A alteração em Kotlin é opcional e só evita um toast feio em casos extremos.