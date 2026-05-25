# Por que a versão pula de 2 em 2

O endpoint `/api/public/bump-version` **incrementa o contador toda vez que é chamado**. No `android/app/build.gradle.kts`, a chamada está amarrada à propriedade `defaultConfig.versionCode = computedVersionCode`, que é avaliada já na **configuration phase** do Gradle — antes de qualquer task rodar.

Resultado prático: qualquer coisa que faça o Gradle **configurar o projeto** dispara um POST de bump, mesmo sem gerar APK. Cenários comuns que causam o "+2":

1. **Android Studio sync** (ou o IDE rodando em background) configura o projeto → POST → +1. Depois você roda `./gradlew assembleRelease` → nova JVM/daemon configura de novo → POST → +1. Total: salta 2.
2. Rodar `./gradlew clean` e depois `./gradlew assembleRelease` em invocações separadas → 2 fetches.
3. Qualquer `./gradlew tasks`, `./gradlew help`, ou plugin que force reconfiguração também consome um número.

O `by lazy` só evita chamadas duplicadas **dentro da mesma invocação Gradle**, não entre invocações.

# Correção proposta

Tornar o fetch **condicional**: só chamar `bump-version` quando o usuário realmente pediu para montar/empacotar o APK. Para qualquer outra task (sync, `tasks`, `help`, `clean` isolado, etc.) usar um placeholder local que **não** consome número.

Mudanças em `android/app/build.gradle.kts`:

1. Criar helper `shouldBumpVersion()` que inspeciona `gradle.startParameter.taskNames` e retorna `true` somente se alguma task pedida casar com regex tipo `assemble(Release|Debug)`, `bundle(Release|Debug)`, ou `install*`.
2. Em `fetchRemoteVersion()`, se `shouldBumpVersion()` for `false`, retornar um fallback local lido de `android/version.properties` (ex.: `versionBase=2` → `name="2.0-dev"`, `code=1`) **sem** fazer POST.
3. Manter `by lazy` para garantir 1 POST por build mesmo quando `shouldBumpVersion()` for `true` (assemble + finalizer `generateUpdateJson` compartilham o mesmo valor).

Opcional (defesa extra): adicionar no endpoint `bump-version.ts` um cache por `x-build-id` header (uuid gerado no Gradle) com TTL curto, para que retries do mesmo build retornem o mesmo número. Só vale a pena se ainda observarmos saltos depois do fix acima — começo sem isso.

# Verificação

Depois do fix:
- `./gradlew tasks` → não muda a versão no banco.
- Abrir o projeto no Android Studio → não muda.
- `./gradlew assembleRelease` → incrementa exatamente 1.
- `update.json` gerado bate com o `versionName`/`versionCode` do APK.
