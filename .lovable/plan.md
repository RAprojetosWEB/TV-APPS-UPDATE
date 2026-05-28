Vou corrigir diretamente na interface nativa Android, que é a que aparece na TV.

O que será feito:
- Parar de mexer na barra web/React para esse caso, porque ela não é a tela real da launcher Android.
- Alterar `MainActivity.kt`, na função que monta a barra superior nativa.
- Fazer cada botão começar compacto com só o ícone/valor curto.
- Ao receber foco pelo controle remoto, trocar o conteúdo da própria pílula para o texto completo:
  - Atualização
  - Todos os aplicativos
  - Configurações
  - Configurar hora
  - Configurar data
  - Configurar clima
  - Wi‑Fi
- Ao perder foco, voltar para o conteúdo compacto.
- Remover a dependência do tooltip como “texto escondido”, porque isso não é expansão real do botão.

Detalhe técnico:
- Hoje vários botões só mudam borda/cor e chamam tooltip; o texto da pílula continua vazio ou curto.
- Vou criar uma lógica única de foco para `TextView` nativo: guardar ícone + texto compacto + texto expandido e alternar com animação/realce no `setOnFocusChangeListener`.
- Também vou corrigir Wi‑Fi para expandir como “Wi‑Fi”, sem mostrar “Wi‑Fi conectado” quando o pedido é o rótulo fixo.