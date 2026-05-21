Corrigir o botão "Procurar Atualização" no Android para que o rótulo permaneça sempre visível.

### Problema

O botão é criado corretamente na barra superior, mas a verificação automática (`checkOtaUpdate`) que dispara ao abrir o app sobrescreve o texto da pílula com mensagens de status ("✓ Sistema atualizado", "⚠ Sem conexão", "⬇ Atualização disponível"). Resultado: o usuário nunca vê o rótulo "Procurar Atualização" — ele aparece como uma pílula de status passiva e parece que o botão não existe.

### Solução

Manter o texto da pílula fixo como **"⟳ Procurar Atualização"** em todos os estados, mudando apenas a cor para indicar o status:

- **Verde** quando o sistema está atualizado ou após verificação bem-sucedida
- **Vermelho** quando não conseguiu conectar
- **Verde + diálogo** quando existe atualização disponível (continua disparando o pop-up de confirmação no clique manual)

Os feedbacks ricos ("Você já está na versão mais recente", "Falha ao verificar") seguem aparecendo via Toast quando o usuário clica manualmente, mas não poluem mais o rótulo do botão.

### Arquivo alterado

- `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt` — função `checkOtaUpdate()`
