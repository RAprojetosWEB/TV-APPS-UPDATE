# Seleção única (APK + update.json) no Upload direto

## Objetivo
Um único clique abre o seletor de arquivos, o usuário marca os dois (APK e update.json) na mesma janela e clica em **Enviar** — igual ao fluxo de upload do Google Drive/Cloud.

## Mudanças (apenas `src/routes/admin.tsx`, dialog "Upload direto")

1. **Substituir os 2 inputs separados por 1 único** `<input type="file" multiple accept=".apk,application/vnd.android.package-archive,application/json,.json">`.

2. **Detecção automática** ao selecionar:
   - arquivo terminado em `.apk` → state `apk`
   - arquivo terminado em `.json` → state `json`
   - Se vier mais de um do mesmo tipo, fica com o último; se faltar algum, mostra aviso "Selecione 1 APK e 1 update.json".

3. **UI nova do dialog** (mais limpa):
   - Um único botão grande **"Escolher arquivos (APK + update.json)"** centralizado.
   - Abaixo, duas linhas compactas mostrando o que foi detectado:
     - `APK: app-release.apk` (ou "—" cinza se ainda vazio)
     - `JSON: update.json` (ou "—" cinza se ainda vazio)
   - Cada linha com ícone de check verde quando preenchida.
   - Dica em texto pequeno: "Segure Ctrl/Cmd para marcar os dois na janela do sistema."

4. **Botão Enviar** continua desabilitado até `apk && json` estarem presentes. Lógica de `onUpload(apk, json)` **inalterada**.

5. Remover os 2 botões/labels antigos ("Escolher APK" e "Escolher update.json") e seus inputs.

## Fora de escopo
- Nenhuma mudança em server functions, Storage, ou no fluxo de form com histórico.
- Sem mudança de tokens visuais (continua usando `admin-btn-ghost`, `admin-label`, `--admin-*`).
