# Corrigir erro de build MainActivity.kt:192

Trocar `background = Color.parseColor("#E60A0D1A")` por `setBackgroundColor(Color.parseColor("#E60A0D1A"))` no bloco `updateOverlay`.

Isso resolve o erro Kotlin "Type mismatch: inferred type is Int but Drawable! was expected" e libera o `./gradlew assembleRelease`.
