# Versionamento automático para OTA

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