## Diagnóstico

Você usou um dos dois botões da seção "OTA do launcher", mas nenhum dos dois roda o parser de versão que criamos antes:

- **Upload direto** → só joga `app-release-latest.apk` + `update.json` no Storage. Nunca insere em `app_versions`, então o card "Versão atual" não muda.
- **Publicar versão** → insere em `app_versions`, mas exige que você digite `versionName` e `versionCode` no formulário.

O parser `extractApkVersion` (em `src/lib/apk-parser.server.ts`) hoje só é chamado pelo upload de APKs dos apps do catálogo (`uploadAppApk`), não pelo launcher.

## Mudança

### 1. `publishLauncherVersion` (`src/lib/admin.functions.ts`)
- Tirar `versionName` e `versionCode` do `inputValidator`.
- No handler: baixar o APK que acabou de ir pro Storage (`tvapps-updates`), passar pelo `extractApkVersion`, e usar o resultado para gravar a linha em `app_versions`.
- Se a extração falhar, devolver erro claro ("APK inválido / não foi possível ler versionCode") em vez de gravar lixo.

### 2. `uploadLauncherRaw` (Upload direto, `src/lib/admin.functions.ts`)
- Depois de subir o APK e o `update.json`, ler o APK que acabou de ir pro Storage, rodar `extractApkVersion` e fazer o mesmo `update is_latest=false` + `insert nova versão` no `app_versions`.
- Resultado: "Upload direto" passa a se comportar como um publish completo (mantendo a vantagem de também atualizar o `update.json` físico do bucket).

### 3. `PublishVersionForm` (`src/routes/admin.tsx`)
- Remover os campos `versionName` e `versionCode` e a validação manual.
- Manter só "Arquivo APK" + "Changelog (opcional)".
- Botão "Publicar" continua chamando `uploadApkFn` e depois `publishLauncherVersion`, mas agora só com `apkStoragePath`, `apkSizeMb` e `changelog`.
- Mostrar a versão detectada ao lado do nome do arquivo assim que o usuário escolher o APK (rodar o parser no browser via `fflate`, que já é dependência).

### 4. Sem mudança no banco
A tabela `app_versions` e o índice único `app_versions_one_latest_per_target` que adicionamos antes continuam servindo. O índice agora também passa a ser uma rede de segurança real: se algum dia a lógica de "desmarcar latest" voltar a falhar, o `insert` quebra em vez de bagunçar a UI.

## Resultado para você

- Clicar em **Publicar versão** → escolhe o `app-release-latest.apk` que você mandou → a tela já mostra `4.2026.05.24.1048 · code 79630515` ANTES de você apertar Publicar. Aperta Publicar e o card "Versão atual" passa a mostrar essa versão.
- Clicar em **Upload direto** → mesma coisa, só que também substitui o `app-release-latest.apk` físico do bucket (que é o que a TV baixa).
