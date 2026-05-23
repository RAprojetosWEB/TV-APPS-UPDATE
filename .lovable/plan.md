## Problema

Ao clicar em "Atualizar agora", o app chama `ApkInstaller.install()`. Se a permissão "Instalar apps desconhecidos" não está concedida, o método mostra um toast, abre a tela de Configurações e **retorna sem instalar**. Quando o usuário concede a permissão e volta para o app:

- O botão fica travado em "ABRINDO INSTALADOR…"
- Nada acontece, porque ninguém reexecuta a instalação
- O usuário precisaria clicar de novo, mas o botão está desabilitado

## Solução

Guardar o APK pendente quando a permissão é negada e reexecutar a instalação automaticamente no `onResume()` assim que a permissão estiver disponível.

### Mudanças

**1. `ApkInstaller.kt`** — fazer `install()` retornar `Boolean` (true = instalador aberto, false = foi para a tela de permissão). Assim o chamador sabe se precisa rastrear retry.

**2. `MainActivity.kt`**
- Adicionar campo `private var pendingInstallApk: File? = null`
- No `startLauncherUpdate` (linha ~1723, branch `DownloadProgress.Done`): chamar `ApkInstaller.install(...)`. 
  - Se retornar `false` (foi para Configurações): salvar `pendingInstallApk = p.file`, mudar texto do botão para "TOQUE PARA INSTALAR" e reabilitar (`isEnabled = true`, `isFocusable = true`), com `setOnClickListener` que reexecuta `ApkInstaller.install` com o arquivo salvo.
  - Se `true`: manter comportamento atual.
- O mesmo tratamento nas outras 2 chamadas a `ApkInstaller.install` (linhas 1221 e 1249) — quando voltar sem permissão, mostrar feedback no card e armazenar o APK pendente.
- No `onResume()` (linha 261): se `pendingInstallApk != null` e `packageManager.canRequestPackageInstalls()` for `true`, chamar `ApkInstaller.install(this, pendingInstallApk!!)` e limpar o campo. Isso dispara o instalador automaticamente assim que o usuário voltar das Configurações com a permissão concedida — exatamente o comportamento pedido ("ao fechar a tela de permissão … já ir direto para o instalador").

### Observação

É código Kotlin nativo — só terá efeito após rebuild/reinstalação do APK no Android. Não aparece no preview web.