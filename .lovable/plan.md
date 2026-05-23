Plano para corrigir os cards:

1. Adicionar uma referência para o contêiner dos cards
- Criar um `carouselRef` apontando para a faixa `.tv-card-carousel`.
- Usar essa referência só quando houver mais de 3 cards.

2. Trocar `scrollIntoView` por rolagem manual
- Quando o foco mudar para outro card, calcular a posição do card dentro da faixa.
- Aplicar `carouselRef.current.scrollTo({ left, behavior: 'smooth' })`.
- Assim o card focado fica visível/centralizado, sem depender do `scrollIntoView`, que costuma falhar em WebView de TV.

3. Ajustar o JSX da faixa
- Passar `ref={carouselRef}` no elemento que contém os cards.
- Manter a navegação atual por seta direita/esquerda, sem mudar instalação, admin ou dados.

4. Pequeno ajuste de CSS se necessário
- Manter `overflow-x: auto` na faixa.
- Evitar que o pai bloqueie a rolagem horizontal da faixa, preservando a tela fixa por fora.

Resultado esperado:
- Com 4 cards, a tela principal continua fixa.
- Ao apertar direita/esquerda, o foco muda de card e a faixa desliza junto para mostrar o card focado.