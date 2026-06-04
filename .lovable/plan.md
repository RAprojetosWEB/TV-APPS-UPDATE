## Diagnóstico

O bug está em `android/app/src/main/java/com/tvapps/launcher/ApkDownloader.kt`. A barra não aparece (na verdade pula direto pra 100% ou fica em estado inválido) quando o APK é baixado de um storage que **não retorna o header `Content-Length`** — caso típico de:

- Servidores que enviam a resposta com `Transfer-Encoding: chunked` (sem `Content-Length`).
- Servidores que aplicam **gzip** na resposta (OkHttp por padrão manda `Accept-Encoding: gzip`; quando o servidor comprime, o `Content-Length` da resposta decodificada vira `-1`).
- CDNs/redirects que removem o header.

No Lovable Cloud (Supabase Storage) o header sempre vem certinho, então funciona. Em outros hosts, não.

### Por que isso quebra a UI

No código atual:

```kotlin
val total = body.contentLength().coerceAtLeast(1L)
...
val percent = ((downloaded * 100) / total).toInt().coerceIn(0, 100)
```

Quando `contentLength()` devolve `-1`, `coerceAtLeast(1L)` força `total = 1`. Resultado:

- Já no primeiro chunk lido (64 KB), `percent = (65536 * 100) / 1 = enorme`, clampado para `100`.
- A barra "salta" pra 100% instantaneamente e o usuário não vê progresso nenhum, embora o download continue acontecendo até o fim.
- A velocidade até é calculada, mas a UI provavelmente já some / fica travada em 100% (dependendo da tela que escuta o `Flow`).

## Correção proposta

Alterar **apenas** `ApkDownloader.kt` (sem mexer em UI, OTA modal, etc.) para:

1. **Forçar resposta sem compressão**: adicionar `header("Accept-Encoding", "identity")` no `Request`, garantindo que o servidor não devolva gzip e que `Content-Length` venha cru sempre que o servidor sabe o tamanho.
2. **Detectar tamanho desconhecido**: tratar `contentLength() <= 0` como *unknown* (não forçar para 1).
3. **Emitir progresso "indeterminado" quando o tamanho for desconhecido**:
   - Manter o cálculo de velocidade e bytes baixados (já funciona, não depende do total).
   - Emitir `percent = -1` (sentinela) e `totalBytes = 0` para sinalizar "indeterminado".
   - ETA continua `-1` (já é o comportamento atual quando não dá pra calcular).
4. **Garantir emissão periódica**: hoje só emite quando `percent` muda ou a janela de 250 ms passa; manter essa lógica para o caso indeterminado também, para a UI animar.

## Mudança na UI (mínima, no mesmo arquivo de modal já existente)

O `OtaUpdateModal.tsx` é só pra OTA (vem do `update.json`, que aponta pro Supabase — sempre tem Content-Length, então não muda nada lá).

O download dos APKs do catálogo é renderizado dentro do `MainActivity.kt` (Kotlin), que consome o `Flow<DownloadProgress>`. Precisa de um pequeno ajuste lá: quando `progress.percent < 0` ou `progress.totalBytes <= 0`, trocar a barra determinada (`ProgressBar` horizontal com `progress`) por **modo indeterminado** (`isIndeterminate = true`) e exibir apenas "Baixado: X MB · Y MB/s" sem o "%".

## Arquivos a alterar

1. `android/app/src/main/java/com/tvapps/launcher/ApkDownloader.kt`
   - Adicionar `Accept-Encoding: identity` no `Request`.
   - Trocar `body.contentLength().coerceAtLeast(1L)` por detecção real de "desconhecido".
   - Emitir `percent = -1` e `totalBytes = 0` no caso indeterminado, mantendo velocidade e bytes baixados.

2. `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt` (só o trecho que consome o `DownloadProgress.Progress`)
   - Se `totalBytes <= 0L`, colocar a `ProgressBar` em `isIndeterminate = true` e esconder o texto de "%".
   - Caso contrário, comportamento atual (barra determinada com %).

## Por que isso resolve

- Quando o servidor envia `Content-Length` → continua tudo igual (caso Supabase).
- Quando não envia (storages externos, gzip, chunked) → o usuário **vê** a barra animando (modo indeterminado) + velocidade real + bytes baixados, em vez de uma barra travada/invisível.
- Forçar `identity` aumenta a chance de obter `Content-Length` correto em muitos servidores, então a maioria dos casos passa a ter barra determinada de verdade.

## Fora do escopo

- Não mexer no fluxo OTA (`OtaUpdateModal.tsx`, `useOtaUpdate.ts`, `update.json`) — não é o caso reportado.
- Não tocar no admin web nem em rotas server.
- Sem mudança de versionCode/versionName (ajuste puramente local, mas vai entrar no próximo bump automático do Gradle como qualquer outro build).
