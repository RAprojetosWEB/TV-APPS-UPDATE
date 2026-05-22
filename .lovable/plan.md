# Login Android com visual de card (igual à web)

## Objetivo
Reproduzir no APK Android o mesmo "card flutuante" da tela de login da versão
web: caixa centralizada com fundo escuro translúcido, bordas arredondadas,
borda sutil e glow verde ao redor.

## O que muda

Arquivo: `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt`,
função `buildLoginScreen()`.

Hoje o `container` (LinearLayout vertical com logo, título, senha, ENTRAR e
ícones) é colocado direto sobre o fundo da tela, sem moldura. Vamos
envolver esse container em um "card":

- Fundo preto translúcido (~40% de opacidade), igual ao `bg-black/40` da web.
- Cantos arredondados generosos (~24dp).
- Borda fina branca translúcida (~10% de opacidade).
- Glow verde externo discreto (sombra/elevation tingida de verde).
- Padding interno generoso (~40dp) em todos os lados.
- Largura máxima parecida com a web (~420dp), centralizado na tela.

Os elementos internos (logo TV.Apps, "Bem-vindo", subtítulo, campo de senha,
botão ENTRAR, ícones ⚙️ 📶) e o rodapé "Acesso restrito..." continuam como
estão — só ganham a moldura ao redor.

## Detalhes técnicos

- Criar um `FrameLayout` (ou `LinearLayout`) novo, `cardWrapper`, com:
  - `background` = `GradientDrawable` com `setColor(#66000000)`,
    `cornerRadius = 24dp`, `setStroke(1dp, #1AFFFFFF)`.
  - `elevation` + `outlineSpotShadowColor` verde (API 28+) para simular o
    glow; fallback: segundo `GradientDrawable` por trás com blur leve via
    `LayerDrawable` (mais simples e compatível).
  - Largura: `min(420dp, screenWidth - 48dp)`.
  - Padding interno: 40dp.
- Mover o `container` atual para dentro desse `cardWrapper`.
- Adicionar `cardWrapper` ao `root` no lugar onde hoje vai o `container`.
- O `updateOverlay` (atualização obrigatória) e o `footerNotice` continuam
  como filhos diretos do `root`, por cima/embaixo do card.

## Fora do escopo

- Não mexer no conteúdo do card (textos, ícones, foco, navegação DPAD,
  lógica de senha, fluxo OTA).
- Não alterar a versão web (`src/components/LoginGate.tsx`).
- Não alterar versionCode/Name nem build scripts.

