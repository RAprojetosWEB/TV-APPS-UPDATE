# Plano de Compilação (Atualizado)

## Estado Atual
- Package Name revertido para `com.tvapps.launcher` para manter compatibilidade com usuários existentes.
- Estrutura de pastas restaurada em `android/app/src/main/java/com/tvapps/launcher/`.
- Configurado versionamento automático baseado em timestamp no `build.gradle.kts`.
- Geração automática de `update.json` após o build.
- Nome do APK de saída padronizado para `app-release-latest.apk`.

## Próximos Passos recomendados
1. Gerar a build com `./gradlew assembleRelease`.
2. O APK estará em `android/app/build/outputs/apk/release/app-release-latest.apk`.
3. O arquivo `update.json` correspondente estará na mesma pasta.
4. Fazer upload de ambos para o bucket do Supabase.
