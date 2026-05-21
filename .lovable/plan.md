# Padronizar layout em qualquer TV / celular / TV Box

## Problema
Hoje os cards têm tamanho fixo em `dp` (340×440) e o ícone tem fonte fixa (56sp). Em telas menores ou com densidade diferente (celular, MiBox), os 3 cards não cabem lado a lado → aparecem cortados e os ícones parecem gigantes em relação ao card visível. No MXQ cabe porque a resolução bate certo.

A solução é tornar o layout **responsivo à largura real da tela**, em vez de usar tamanhos fixos.

## Mudança em `MainActivity.kt`

1. Medir a largura útil da tela em runtime (`resources.displayMetrics.widthPixels` menos paddings laterais).
2. Calcular o tamanho do card dinamicamente:
   - `cardWidth = (larguraUtil - 2 * gap) / 3`
   - limitar entre um mínimo (ex.: 220dp) e um máximo (ex.: 360dp)
   - `cardHeight = cardWidth * 1.3` (mantém proporção)
3. Escalar proporcionalmente:
   - badge do ícone = `cardWidth * 0.38`
   - fonte do emoji = `cardWidth * 0.18` (em px → sp)
   - título = `cardWidth * 0.08`
   - subtítulo = `cardWidth * 0.05`
   - pill horizontal padding = `cardWidth * 0.07`
4. Trocar paddings fixos do root (`64dp`) por padding proporcional (`8%` da largura), e reduzir margens entre cards em telas pequenas.
5. Garantir que a `Row` use `MATCH_PARENT` e `gravity = CENTER`, e que cada card use o tamanho calculado em vez de `dp(340)`/`dp(440)`.
6. Header (`TV.Apps` 44sp) também passa a escalar: `min(44, larguraDp * 0.05)`.

Resultado esperado: em qualquer tela (celular pequeno, MiBox 720p, MXQ 1080p, TV 4K) os 3 cards aparecem inteiros, centralizados, com proporção visual idêntica.

## Arquivos
- `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt`

## Depois
Gerar novo `tv-apps-android-native.zip` em `/mnt/documents/`.
