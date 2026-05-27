## O que está acontecendo

O dispositivo está conectado normalmente, mas o app mostra o ícone de Wi-Fi como desconectado porque os ícones da tela de login e da tela principal são criados depois que o monitor de rede já detectou o estado real.

Como a rede não mudou de novo, o monitor não manda outro aviso, então o ícone novo fica parado no desenho errado.

## Correção

1. Guardar na `MainActivity` o último estado de rede conhecido.
2. Sempre que `applyNetworkState(...)` receber um estado novo, atualizar esse valor guardado.
3. Quando o ícone Wi-Fi do login for criado, aplicar imediatamente o último estado conhecido nele.
4. Quando o ícone Wi-Fi da tela principal for criado, aplicar imediatamente o último estado conhecido nele.

## Resultado esperado

- Ao entrar no login, o ícone já aparece com o estado correto do Wi-Fi.
- Depois de colocar a senha e entrar na tela principal, o ícone continua correto.
- Nenhum botão, posição, layout ou elemento novo será adicionado.
- A mudança é só no comportamento do desenho do ícone.