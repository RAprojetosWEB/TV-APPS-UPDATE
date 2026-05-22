## Objetivo

Ao clicar em **ATUALIZAR AGORA** na tela de atualização, iniciar o download imediatamente, sem mostrar a caixa de diálogo cinza "Nova Atualização / Baixar Agora / Mais Tarde".

## Alteração

Em `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt`:

1. **Linha 568-570** (clique do botão ATUALIZAR AGORA na tela bloqueante de OTA): trocar `showOtaConfirmDialog(remoteVersion, downloadUrl)` por chamada direta a `startLauncherUpdate(downloadUrl)`, mantendo a validação de URL vazia (mostrar Toast se inválida).

2. **Linha 1402** (verificação manual de update via pill "Procurar atualizações"): também trocar `showOtaConfirmDialog(...)` por `startLauncherUpdate(downloadUrl)` para manter comportamento consistente — clicar = baixa direto.

3. A função `showOtaConfirmDialog` fica sem uso e pode ser removida, junto com o import `android.app.AlertDialog` se não houver mais usos (há outro uso em `showAlreadyInstalledDialog`, então o import permanece).

## Resultado

Clicar em ATUALIZAR AGORA (ou na pill de procurar atualizações quando há update) começa o download na hora, com o progresso aparecendo na pill de status ("Baixando: X%"), e ao terminar abre o instalador do APK automaticamente.
