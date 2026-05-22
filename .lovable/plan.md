## Objetivo
Usar a imagem enviada (`ChatGPT_Image_May_22_2026_03_38_13_PM.png`) como banner oficial do app na Android TV, substituindo o `banner.xml` vetorial atual.

## Passos

1. **Copiar a imagem para os recursos Android**
   - Copiar `user-uploads://ChatGPT_Image_...png` para `android/app/src/main/res/drawable/banner.png`, redimensionada para **320x180** (16:9), centralizada, alta qualidade, sem cortes.
   - Também gerar versão maior `drawable-xhdpi/banner.png` (640x360) para TVs de alta densidade, garantindo nitidez.

2. **Remover o banner vetorial antigo**
   - Deletar `android/app/src/main/res/drawable/banner.xml` (senão o Android dá erro de recurso duplicado `banner`).

3. **Confirmar AndroidManifest**
   - O `AndroidManifest.xml` já tem `android:banner="@drawable/banner"` na tag `<application>`. Vou também adicionar o mesmo atributo na `<activity>` MainActivity (recomendado pelo Android TV) para garantir que apareça em launchers que leem o banner da activity LEANBACK_LAUNCHER.

4. **Verificar requisitos Android TV**
   - Manter `<uses-feature android:name="android.software.leanback" android:required="false" />` e a category `LEANBACK_LAUNCHER` (já presentes).
   - Garantir que o nome do app (`@string/app_name`) continue exibido junto do banner.

## Resultado esperado
Após recompilar o APK e instalar na TV Box, a imagem TV.Apps enviada aparecerá como:
- Banner do app na launcher da Android TV
- Banner de destaque/recentes
- Ícone-banner oficial do app

## Detalhes técnicos
- Ferramenta usada para redimensionar: `nix run nixpkgs#imagemagick` (resize 320x180 e 640x360, qualidade alta, sem distorção).
- Arquivos alterados:
  - `+ android/app/src/main/res/drawable/banner.png` (320x180)
  - `+ android/app/src/main/res/drawable-xhdpi/banner.png` (640x360)
  - `- android/app/src/main/res/drawable/banner.xml`
  - `~ android/app/src/main/AndroidManifest.xml` (adicionar `android:banner` na activity)