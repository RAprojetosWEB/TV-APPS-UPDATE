## Problema

Depois que o APK baixa 100% e o usuário libera "fontes desconhecidas", **raramente** o modal fica preso em **INSTALAR APLICATIVO** sem reabrir o instalador. Acontece de vez em quando, não sempre.

## Por que é raro

O código já tem retomada automática no `onResume` (linha 286 do `MainActivity.kt`) que reabre o instalador quando o usuário volta das configurações. Funciona na maioria das vezes. As falhas pontuais geralmente vêm de:

- a TV box demorar um instante para reconhecer que a permissão foi concedida;
- o `onResume` disparar antes do sistema atualizar o status da permissão;
- alguma TV box exigir um clique manual extra.

Como é raro, a correção precisa ser **defensiva e barata**, sem mexer no fluxo principal que já funciona.

## Plano de correção (mínimo necessário)

1. **Retry com pequeno atraso no `onResume`**
   - Quando voltar das configurações com `pendingInstallApk` definido, tentar instalar imediatamente E também repetir após ~500ms.
   - Cobre o caso da permissão ainda não ter "propagado" no momento exato do retorno.

2. **Manter o botão "INSTALAR APLICATIVO" sempre clicável como fallback**
   - O botão já existe no modal (linhas 1963–1972). Garantir que ele continue focado e funcional mesmo depois do retry automático falhar.
   - Adicionar um texto auxiliar pequeno tipo "Se nada acontecer, toque OK novamente" para o usuário não ficar perdido.

3. **Reforço no `ApkInstaller`**
   - Adicionar `FLAG_ACTIVITY_CLEAR_TOP` junto com as flags atuais para evitar conflito quando o instalador do sistema já estiver em memória.
   - Pequena melhoria, não muda o comportamento padrão.

## O que NÃO vamos fazer

- Não refatorar todo o fluxo OTA (já funciona em ~95% dos casos).
- Não mexer no design do modal.
- Não tocar no servidor / update.json.

## Resultado esperado

A janela de falha rara deve fechar: na maioria absoluta das vezes a retomada automática vai funcionar, e quando não funcionar o usuário tem o botão claramente disponível para tentar manualmente.