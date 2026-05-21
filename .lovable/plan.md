# Trocar package name para `com.rastream.platformtv`

Sim, dá pra trocar. É uma operação mecânica em ~10 arquivos, mas tem **um detalhe importante** que você precisa saber antes.

## ⚠ Aviso importante antes de aceitar

Trocar o package name faz o Android **enxergar como um app totalmente novo**. Consequências:

- Quem já tem o `com.tvapps.launcher` instalado **não recebe esta atualização via OTA** — o sistema OTA compara dentro do mesmo package. Eles continuariam com a versão antiga pra sempre.
- A solução é **desinstalar a versão antiga e instalar a nova** manualmente nesses aparelhos (uma vez só).
- Os apps em si (catálogo, dados, login) começam do zero porque o Android trata como instalação limpa.

Se você ainda não distribuiu o APK pra ninguém (ou só pra você mesmo testando), o impacto é zero. Se já tem usuários reais, vale considerar manter o package atual.

## O que muda

### Arquivos editados
- `android/app/build.gradle.kts` — `namespace` e `applicationId` viram `com.rastream.platformtv`.
- `android/app/src/main/AndroidManifest.xml` — nada a editar (usa `${applicationId}` para o FileProvider, então acompanha sozinho).
- 8 arquivos `.kt` em `android/app/src/main/java/com/tvapps/launcher/` — a declaração `package com.tvapps.launcher` no topo de cada um vira `package com.rastream.platformtv`.

### Pastas movidas
```text
android/app/src/main/java/com/tvapps/launcher/   →   android/app/src/main/java/com/rastream/platformtv/
```
Os 8 arquivos (`MainActivity.kt`, `AppCatalog.kt`, `ApkCache.kt`, `ApkDownloader.kt`, `ApkInstaller.kt`, `InstalledRegistry.kt`, `PackageInstallReceiver.kt`, `StatusInfo.kt`) mudam de pasta e ganham o novo `package` no topo. A pasta antiga `com/tvapps/launcher/` é apagada.

## Detalhes técnicos
- O FileProvider no manifesto usa `${applicationId}.fileprovider`, então o authority também vira `com.rastream.platformtv.fileprovider` automaticamente — nada a ajustar.
- O sistema de versionamento automático (timestamp + `update.json`) continua igual.
- O `update.json` no Supabase continua o mesmo, mas o APK novo terá outro `applicationId`. Recomendo subir o APK novo num **novo nome** (ex.: `platformtv-latest.apk`) só pra não confundir clientes antigos que ainda estão no `tvapps-latest.apk`. Posso ajustar isso junto se quiser.

## Fora de escopo
- Mudar o nome visível do app (label "TV.Apps"), o ícone, ou o esquema de cores. Só o identificador interno muda.
- Migrar dados de usuários do package antigo pro novo (não há API Android pra isso — é instalação limpa).

Tornar o ciclo "compilar → enviar APK → clientes detectam atualização" totalmente automático, sem precisar editar versão manualmente.

## Fluxo final para você

```text
./gradlew assembleRelease
        │
        ▼
build/outputs/apk/release/tvapps-latest.apk      ← sempre mesmo nome
build/outputs/apk/release/update.json            ← gerado junto, pronto pra subir
        │
        ▼
Upload dos 2 arquivos no bucket tvapps-updates (substitui os antigos)
        │
        ▼
Apps instalados veem "⬆ Atualização disponível" automaticamente
```

Você nunca mais edita `versionCode` / `versionName` à mão.

## O que muda

### 1. Versão automática na build (Gradle)

Em `android/app/build.gradle.kts`:

- `versionCode` passa a ser um **timestamp** no formato `yyMMddHHmm` (ex.: `2605211830`) — sempre cresce a cada build, garantindo que toda compilação seja vista como "mais nova".
- `versionName` é derivado automaticamente: base `2.x` + timestamp, ex.: `2.5.202605211830`. Você não mexe.
- O APK final é renomeado para `tvapps-latest.apk` (em vez de `app-release.apk`) via `applicationVariants.all { ... outputFileName = "tvapps-latest.apk" }`.

### 2. `update.json` gerado automaticamente

Uma task Gradle `generateUpdateJson` roda depois do `assembleRelease` e cria, ao lado do APK:

```json
{
  "versionCode": 2605211830,
  "versionName": "2.5.202605211830",
  "apkUrl": "https://bunvyxogwpwiojzczgwl.supabase.co/storage/v1/object/public/tvapps-updates/tvapps-latest.apk"
}
```

Você sobe os dois arquivos no bucket `tvapps-updates`, sempre com o mesmo nome (substitui os antigos). Nada de renomear APK por versão.

### 3. Comparação OTA por `versionCode` (mais robusta)

Hoje a comparação no `MainActivity.kt` e em `src/lib/app-version.ts` é feita por `versionName` (string `"2.4"` vs `"2.5"`). Com versionName virando algo como `2.5.202605211830`, comparação por string quebra.

Mudança:
- OTA lê `versionCode` do `update.json` e compara com `packageManager.getPackageInfo(packageName, 0).longVersionCode` (Android) ou com a constante `APP_VERSION_CODE` (web).
- `versionName` continua aparecendo na UI (é o que o usuário vê), mas a decisão "tem update?" usa `versionCode`.
- Retrocompatível: se `versionCode` não vier no JSON, cai no comportamento atual (compara `versionName`).

### 4. Sincronização web ↔ Android

`src/lib/app-version.ts` ganha `APP_VERSION_CODE` além de `APP_VERSION`. Ambos são gravados automaticamente pela task Gradle (ou por um script Node no `prebuild` web) lendo de um arquivo único `android/version.properties`. Fonte única de verdade.

## Detalhes técnicos

**Arquivos alterados**
- `android/app/build.gradle.kts` — versionCode/Name dinâmicos, rename do APK, task `generateUpdateJson`.
- `android/version.properties` (novo) — guarda `versionBase=2` (e opcionalmente `lastVersionCode` para histórico).
- `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt` — checagem OTA passa a comparar `versionCode` (Long) em vez de `versionName` (String).
- `src/lib/app-version.ts` — adiciona `APP_VERSION_CODE` e helper `isUpdateAvailable(remote)`.
- `scripts/sync-version.mjs` (novo, opcional) — propaga a versão para o lado web antes do build.

**Esquema do `update.json` (novo, retrocompatível)**
```json
{
  "versionCode": 2605211830,
  "versionName": "2.5.202605211830",
  "apkUrl": ".../tvapps-latest.apk",
  "changelog": "opcional",
  "forceUpdate": false
}
```

**Comparação Android (pseudo)**
```text
localCode  = packageManager.getPackageInfo(packageName, 0).longVersionCode
remoteCode = json.optLong("versionCode", -1)
hasUpdate  = remoteCode > 0 && remoteCode > localCode
```

**Compatibilidade**
- `versionCode` como `yyMMddHHmm` cabe em Int até ~2031; para garantir, usamos `longVersionCode` na leitura.
- Funciona em Android TV, TV Box, Mi Box e celulares — API padrão do PackageManager (API 24+).
- Puro Gradle + Kotlin, não exige Capacitor.

## Fora de escopo
- Upload automático do APK pro Supabase (continua manual, como você pediu).
- CI/CD. Tudo roda na sua build local.