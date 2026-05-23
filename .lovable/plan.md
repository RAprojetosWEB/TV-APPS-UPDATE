## O que muda

Na tela de login do Android, deixar **bem mais óbvio** quando o botão "ENTRAR" está selecionado (foco via controle remoto).

## Comportamento hoje
Quando o foco vai pro botão "ENTRAR", o fundo muda levemente (via `makePillBg(true)`) e o texto fica escuro. Mas o botão **não cresce** — fica do mesmo tamanho — então é difícil perceber que ele foi selecionado.

## Como vai ficar

No `setOnFocusChangeListener` do `loginButton` (MainActivity.kt, linhas 456-459):

- **Quando ganha foco:**
  - Cresce ~15% (`scaleX/Y = 1.15`) com animação suave de 180ms
  - Fundo verde vibrante (`#2dd4a8` — o mesmo verde da marca)
  - Texto escuro (`#15102A`)
  - Sombra/glow verde ao redor (`elevation` + `setShadowLayer` no texto)
- **Quando perde foco:**
  - Volta ao tamanho normal (`scaleX/Y = 1.0`)
  - Fundo translúcido original
  - Texto branco
  - Sem sombra

## Arquivo alterado
Apenas `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt` (bloco do `loginButton`, ~10 linhas). Nada muda no site/preview web.