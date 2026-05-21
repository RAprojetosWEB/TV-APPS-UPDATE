# Centralizar cards na tela (Android nativo)

## Problema
Os cards (UniTV, Nexa TV, AllApp) aparecem alinhados à esquerda da tela da TV. O usuário quer eles centralizados.

## Mudança
Editar `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt`:

1. No `ScrollView`, definir `gravity = Gravity.CENTER` para centralizar verticalmente o conteúdo.
2. No `LinearLayout` horizontal (`row`) que contém os cards:
   - `gravity = Gravity.CENTER` (horizontal + vertical).
   - `layoutParams` com `width = MATCH_PARENT` para a centralização ocupar toda a largura.
3. Substituir `marginEnd` por `marginStart`/`marginEnd = dp(10)` em cada card, para espaçamento simétrico.
4. Header ("TV Apps" + subtítulo) continua alinhado à esquerda.

Depois gerar novo `tv-apps-android-native.zip` em `/mnt/documents/`.

## Arquivos
- `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt`

## Resultado
Cards centralizados horizontalmente na tela da TV.
