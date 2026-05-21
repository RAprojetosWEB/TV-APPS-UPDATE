# Replicar UI da web no APK Android (TV.Apps)

Objetivo: a tela inicial do APK nativo (`MainActivity.kt`) deve ficar visualmente idêntica à imagem de referência da web — mesmo cabeçalho, mesma barra de status no topo direito, mesmos cards com ícones reais e mesmo rodapé.

**Regra combinada:** a partir de agora **toda alteração pedida é aplicada só no Android nativo** (`android/`). Os arquivos da web em `src/` ficam intocados.

## O que muda visualmente

**Cabeçalho (esquerda):**
- Título "TV.Apps" com o ponto verde neon (#5EE6A8) — já existe.
- Subtítulo trocado para **"Central de Downloads Automática"**.

**Barra de status (direita do cabeçalho, mesma linha):**
- Pill "⟳ Verificando sistema..." (borda laranja translúcida). Liga ao OTA: se houver update vira "⬇ Atualização disponível" (verde); se atualizado, "✓ Sistema atualizado".
- Pill "🕐 08:25" — relógio ao vivo (HH:mm), atualiza a cada minuto.
- Pill "📅 Qui, 21 De Mai." — data em pt-BR, capitalizada.
- Pill "🌥 24°C" — clima atual via Open-Meteo (sem chave), localização aproximada por IP (ipapi.co), fallback São Paulo. Atualiza a cada 30 min.
- Pill "📶 Wi-Fi" — estado da rede via `ConnectivityManager`. Verde online / vermelho offline.

**Cards (3 apps):**
- Ícones PNG reais (UniTV, Nexa TV, AlphaPlay) dentro do badge arredondado — `ImageView` no lugar do emoji.
- Nome "ALPHAPLAY" vira "AlphaPlay".
- Descrições atualizadas para bater com a referência:
  - UniTV → "Mais de 400 canais, filmes e séries"
  - Nexa TV → "Mais de 300 canais"
  - AlphaPlay → "Mais de 300 canais, filmes e séries"
- Botão passa de "⬇ QUERO INSTALAR" para **"⬇ INSTALAR"** (igual à web). "▶ ABRIR APP" e chip "INSTALADO" continuam funcionando.
- Borda neon verde no card focado — mantém.

**Rodapé:**
- Texto trocado para: **"Após o download, abra o arquivo APK e permita instalação de fontes desconhecidas"**.

**Fundo:**
- Gradiente mais escuro (#0A0D1A central) com glow verde discreto no canto inferior, batendo com a referência.

## Arquivos tocados

- `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt` — novo `buildTopBar()`, helpers `makeStatusPill()` e `bindStatusPills()` (relógio/data/clima/rede/OTA), `buildCard()` usa `ImageView`, novos textos, fundo ajustado.
- `android/app/src/main/java/com/tvapps/launcher/AppCatalog.kt` — adiciona `iconRes: Int`, atualiza nome "AlphaPlay" e descrições.
- `android/app/src/main/java/com/tvapps/launcher/StatusInfo.kt` (novo) — coroutines para clima e geolocalização por IP.
- `android/app/src/main/res/drawable/ic_unitv.png`, `ic_nexa.png`, `ic_alphaplay.png` — novos PNGs.
- `android/app/src/main/AndroidManifest.xml` — adiciona `ACCESS_NETWORK_STATE` se faltar.

Não toca em: `ApkDownloader.kt`, `ApkInstaller.kt`, `InstalledRegistry.kt`, `ApkCache.kt`, gradle, nenhum arquivo de `src/`.

## Ícones PNG

Vou gerar 3 ícones placeholder estilizados (igual ao estilo da web) e colocar direto em `res/drawable/`. Se você já tem os ícones oficiais dos 3 apps em PNG, manda que eu troco — fica melhor que os gerados.

## Detalhes técnicos

- Relógio/data: `Handler.postDelayed(60s)` + `SimpleDateFormat` com `Locale("pt","BR")`.
- Clima: `GET https://api.open-meteo.com/v1/forecast?latitude=X&longitude=Y&current=temperature_2m,weather_code` → mapeia `weather_code` para emoji.
- Geo IP: `GET https://ipapi.co/json/` → lat/long, fallback -23.55/-46.63.
- Rede: `ConnectivityManager.registerDefaultNetworkCallback` em `onResume`/unregister em `onPause`.
- OTA: GET no `update.json` do bucket `tvapps-updates`, compara com `BuildConfig.VERSION_NAME`.
