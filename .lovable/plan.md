# Plano — Opções 1 e 3 do ambiente Android

## Objetivo

Deixar o launcher nativo realmente útil para o usuário:

1. **Detectar app já instalado de forma confiável** + mostrar isso claramente no card.
2. **Limpar o cache de APKs automaticamente** depois da instalação e quando ele crescer demais.

---

## Opção 1 — Detectar app já instalado

Hoje a lógica existe (`isAppInstalled` + troca do texto do botão para "▶ ABRIR APP"), mas:

- Os `packageName` no `AppCatalog.kt` são placeholders (`com.unitv.app`, `com.nexa.tv`, `com.alphaplay.app`), então o `PackageManager` nunca encontra o app instalado.
- O único sinal visual é a troca do texto do botão — fácil de não perceber.

### O que muda

**a) Descobrir o packageName real automaticamente, sem precisar editar código a cada APK**

Em vez de depender de uma string fixa, ler o `packageName` direto do arquivo `.apk` baixado e guardar em `SharedPreferences` por nome de catálogo:

- Quando um APK é baixado, usar `PackageManager.getPackageArchiveInfo(apkPath, 0)` para extrair o `packageName` real.
- Salvar em `SharedPreferences` (`installedApps`) com a chave sendo o `CatalogApp.name`.
- Na hora de checar "está instalado?", primeiro tentar a string do catálogo, e se falhar, tentar o `packageName` salvo do APK anterior.

Resultado: na **primeira instalação** o launcher aprende o package real e a partir daí detecta corretamente, sem o usuário precisar fornecer nada.

**b) Indicador visual de "Instalado" no card**

- Adicionar um pequeno "chip" verde no topo direito do card com o texto **"INSTALADO"** quando o app é detectado.
- Manter a troca do botão para "▶ ABRIR APP".
- Atualizar esse estado também no `onResume()` da Activity, para refletir desinstalações feitas pelo usuário.

---

## Opção 3 — Limpeza automática do cache de APKs

Hoje cada APK fica permanentemente em `context.cacheDir/apks/` e nunca é apagado. Três APKs grandes podem ocupar centenas de MB no TV Box.

### Regras de limpeza

1. **Após instalação bem-sucedida** (quando o card detecta que o app passou a estar instalado no `onResume`): apagar o `.apk` correspondente em `cacheDir/apks/`.
2. **Limite total de cache de 300 MB**: no `onCreate`, varrer `cacheDir/apks/`, e se passar de 300 MB, apagar os arquivos mais antigos (por `lastModified`) até voltar abaixo do limite. Apps já instalados são apagados primeiro.
3. **Arquivos órfãos** (apks de nomes que não estão mais no catálogo): apagar também na varredura inicial.

### Onde isso vive

Novo objeto utilitário **`ApkCache.kt`** com:

- `fun cleanupInstalled(context, catalog)` — apaga APKs cujo app já está instalado.
- `fun enforceSizeLimit(context, maxBytes = 300L * 1024 * 1024)` — aplica limite total.
- `fun deleteFor(context, appName)` — apaga o APK de um app específico (chamado após instalação confirmada).

Chamadas:

- `MainActivity.onCreate` → `ApkCache.cleanupInstalled` + `ApkCache.enforceSizeLimit`
- `MainActivity.onResume` → reavaliar instalação de cada card e chamar `ApkCache.deleteFor` para os que foram recém-instalados.

---

## Detalhes técnicos

### Arquivos novos
- `android/app/src/main/java/com/tvapps/launcher/ApkCache.kt`
- `android/app/src/main/java/com/tvapps/launcher/InstalledRegistry.kt` (wrapper de `SharedPreferences` para o mapa `catalogName → packageName`)

### Arquivos alterados
- `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt`
  - Função `refreshInstalledState(card, app)` que aplica botão + chip "INSTALADO".
  - Sobrescrever `onResume()` para revalidar todos os cards e disparar limpeza pontual.
  - Após `ApkInstaller.install(...)`, agendar revalidação (já existe `postDelayed` de 2500 ms — usar essa janela).
  - Adicionar o chip "INSTALADO" no `buildCard` (overlay no `container` via `FrameLayout.LayoutParams` com `gravity = TOP|END`).
- `android/app/src/main/java/com/tvapps/launcher/ApkDownloader.kt`
  - Após gravar o arquivo, chamar `InstalledRegistry.learnFromApk(context, fileNameHint, file)` para extrair e salvar o `packageName` real.

### Sem alterações em
- `AppCatalog.kt` (continua com os placeholders — eles deixam de importar, pois a detecção passa a usar o registry).
- `ApkInstaller.kt`.
- Build/Gradle, permissões do `AndroidManifest` (não precisa de nada novo: `QUERY_ALL_PACKAGES` não é necessário se já estamos consultando packages específicos via `getPackageInfo` que o app conhece após a instalação).

---

## Como o usuário percebe

- Abre o launcher → cards aparecem normalmente.
- Instala "UniTV" → no fim do fluxo o card mostra chip verde **"INSTALADO"** e o botão vira **"▶ ABRIR APP"**.
- Sai do app e volta → o estado continua correto. Se desinstalou pelas configurações, o chip some.
- Cache não cresce indefinidamente: APKs já instalados somem do `cacheDir`, e o total fica abaixo de 300 MB.
