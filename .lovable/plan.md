# App Web para TV Box — 3 botões de download de APK

App web em tela cheia, layout 16:9, navegável por controle remoto (DPAD), com 3 botões grandes centralizados. Cada botão abre o link direto do APK correspondente — o usuário baixa e instala manualmente na TV Box. Depois pode ser empacotado com Capacitor no Android Studio para virar APK nativo.

## O que vou construir

- Página única (`src/routes/index.tsx`) ocupando 100vw x 100vh, fundo escuro, layout horizontal.
- Título no topo + 3 cards/botões grandes lado a lado, centralizados.
- Cada botão mostra: ícone, nome do app, e ao receber foco fica com borda destacada + escala maior (essencial para DPAD).
- Navegação por teclado/DPAD: setas ← → movem o foco entre os 3 botões, Enter/OK abre o link do APK em nova aba (`window.open`).
- Foco inicial automático no botão do meio ao carregar.
- 3 URLs de APK configuradas em uma constante no topo do arquivo — fácil de substituir.
- Design moderno: tipografia bold, gradientes sutis, sombras, cores de destaque vibrantes no foco.

## Tecnicamente

- Stack atual (TanStack Start + Tailwind v4 + shadcn) — sem dependências novas.
- Tokens de cor adicionados em `src/styles.css` (fundo dark, accent neon para foco).
- Componente `TVButton` com `ref` + `tabIndex={0}` + handler `onKeyDown` para Enter/Space.
- Hook simples gerencia índice focado e chama `.focus()` no elemento certo quando muda.
- Meta viewport e CSS garantem fullscreen 16:9.

## Como usar depois

1. Substituir as 3 URLs no topo de `src/routes/index.tsx` (constante `APPS`).
2. Para virar APK nativo: rodar `npx cap init` + `npx cap add android` + `npx cap sync` em um clone local, abrir no Android Studio, build → APK. (Faço só a parte web aqui.)

## Limitação confirmada

Os botões apenas **abrem o link** do APK. Instalação automática não é possível em WebView/Capacitor sem plugin Kotlin customizado.
