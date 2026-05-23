Vou corrigir apenas o app Android.

Plano:
1. Usar o ícone que já foi substituído em `src/assets/unitv.png` como fonte do novo UniTV.
2. Substituir `android/app/src/main/res/drawable/ic_unitv.png` por esse mesmo PNG.
3. Manter `AppCatalog.kt` como está, porque ele já aponta para `R.drawable.ic_unitv`.
4. Não mexer na versão web, nem em `src/routes/index.tsx`, nem em outros cards.