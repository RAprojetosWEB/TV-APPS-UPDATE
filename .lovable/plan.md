## Problema

As bolinhas animadas aparecem na **splash nativa do Android**, renderizada em `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt` (linhas 215-253), e não no componente React `LoginGate.tsx` que eu vinha editando. Por isso as alterações anteriores não tiveram efeito visual no app Android.

## Correção

Em `MainActivity.kt`, na função que monta a splash:

1. Remover o bloco `val dotsRow = LinearLayout(...)` (linhas 215-223).
2. Remover a função local `fun makeDot(delayMs: Long): View { ... }` (linhas 224-246).
3. Remover as três chamadas `dotsRow.addView(makeDot(...))` (linhas 247-249).
4. Remover `column.addView(dotsRow)` (linha 253).

Mantém o título e o subtítulo "A maneira mais fácil de baixar apps" intactos. Nenhuma outra alteração.

## Observação

Como é código nativo Android, o efeito só será visível após rebuild/reinstall do APK — não aparece no preview web.