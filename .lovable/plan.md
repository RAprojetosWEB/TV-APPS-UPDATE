## Problema

Na tela principal existem dois indicadores de Wi‑Fi lado a lado:

- um `ImageView` dedicado (`netIcon`) com o nível real do sinal;
- uma pílula de texto (`wifi`) com ícone + texto `Wi‑Fi`.

Isso cria a duplicação mostrada na imagem.

## Solução proposta

1. Manter apenas a pílula `Wi‑Fi`, porque ela já combina ícone e texto no mesmo botão visual.
2. Fazer o `NetworkMonitor` atualizar essa pílula diretamente:
   - Wi‑Fi conectado: ícone de nível do sinal + texto `Wi‑Fi` em verde;
   - Wi‑Fi sem internet: ícone de alerta + texto `Sem internet` em vermelho;
   - sem rede: ícone desligado + texto `Sem rede` em vermelho;
   - Ethernet: ícone Ethernet + texto `Ethernet`.
3. Remover o `ImageView` separado (`netIcon`) da barra superior para eliminar o Wi‑Fi duplicado.
4. Remover o callback antigo `registerNetworkCallback/updateWifi`, já que ele vira redundante e poderia voltar a causar conflito com o `NetworkMonitor`.
5. Preservar a correção anterior: quando a tela de login ou principal abrir, o último estado conhecido continua sendo aplicado imediatamente.

## Resultado esperado

- Na barra superior aparece apenas um indicador de rede.
- O estado continua correto no login e na tela principal.
- Nenhuma mudança em cards, senha, downloads ou layout geral.