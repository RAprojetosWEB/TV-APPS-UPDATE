## Problema

O botão "Upload direto" não atualiza o card "Versão atual" porque:

1. Em `src/routes/admin.tsx` (linha 1350), o handler chama `uploadLauncherApk` (função do catálogo de apps) para subir o APK, em vez de `uploadLauncherRaw`. Só o `uploadLauncherRaw` tem o bloco que extrai a versão do APK e insere em `app_versions` quando o path termina em `.apk` (linhas 588-633 de `src/lib/admin.functions.ts`).
2. Depois do upload, `handleRawUpload` não chama `load()`, então o estado local `versions` continua igual mesmo se o banco fosse atualizado.

## Mudança

Editar `handleRawUpload` em `src/routes/admin.tsx`:

- Substituir a chamada `uploadApkFn({ data: { path: apkPath, fileBase64: apkB64 } })` por `uploadRawFn({ data: { path: apkPath, contentBase64: apkB64, contentType: "application/vnd.android.package-archive" } })`. Isso faz o servidor extrair `versionName`/`versionCode` do AndroidManifest e gravar em `app_versions` com `is_latest=true`.
- Manter a segunda chamada (subir o `update.json` manual) como está, mas opcional: como o `uploadLauncherRaw` já chama `writeUpdateManifest()` internamente quando recebe um `.apk`, o `update.json` enviado pelo usuário vira redundante. Posso remover esse segundo upload pra evitar sobrescrever o manifesto correto com um possivelmente desatualizado.
- Chamar `await load()` no final do `try` para o card "Versão atual" refletir o novo APK imediatamente.
- Remover o import não-usado de `uploadLauncherApk` se ele ficar órfão (verificar antes).

## Resultado

Clicar em "Upload direto" → escolher só o APK → card "Versão atual" passa a mostrar `2.80 · code 80` (ou o que vier do APK) automaticamente, igual o fluxo "Publicar versão".
