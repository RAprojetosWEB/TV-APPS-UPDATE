## Problema

A tela de login nativa do APK (em `MainActivity.kt`, linha 562) compara a senha digitada com o literal `"1555"` cravado no código. Ela **nunca** consulta o banco. Por isso:

- A senha antiga (`1555`) continua entrando — é a hardcoded.
- Qualquer senha definida no admin web (hoje `1111`) é rejeitada — o APK não a conhece.

O painel admin e o `verifyLoginPassword` do servidor já funcionam corretamente; só a tela nativa do APK estava fora do circuito.

## Solução

Fazer a tela de login nativa do APK consultar o servidor. Como o login Kotlin não usa o bundle React, vou expor um endpoint público HTTP simples para o APK consumir, e usar `"1555"` apenas como fallback se a TV estiver offline (mesma estratégia já usada no `LoginGate.tsx`).

### 1. Novo endpoint público no app TanStack

Criar `src/routes/api/public/verify-launcher-password.ts`:

- `POST /api/public/verify-launcher-password`
- Body JSON: `{ "password": "..." }` (validado com Zod, 1–200 chars)
- Lê `app_settings.login_password` via `supabaseAdmin` (mesma lógica do `verifyLoginPassword`)
- Retorna `{ "ok": true | false }`
- Sem dados sensíveis no corpo (não devolve a senha), apenas o booleano

Pode ficar em `/api/public/*` porque é um check de senha que precisa ser chamado sem sessão Supabase (o APK não tem usuário logado no Supabase Auth). O endpoint não vaza nada e não escreve nada.

### 2. Tela de login nativa consulta o endpoint

Em `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt`:

- Adicionar uma função `verifyPasswordAgainstServer(password: String): Boolean` que faz `POST` ao endpoint usando `HttpURLConnection` (já é usado no app para OTA, sem dependências novas), com timeout curto (~5s).
- A URL base já é conhecida pelo APK (a mesma usada para OTA / catálogo remoto). Vou reaproveitar a constante existente.
- Substituir o bloco `setOnClickListener` da linha 561–569:
  - Mostrar um estado de "Verificando…" no botão durante a checagem.
  - Rodar a chamada em uma coroutine/`Thread` (não na main thread).
  - Se o servidor responder `ok=true` → entra normalmente.
  - Se responder `ok=false` → "Senha incorreta" (toast atual).
  - Se a chamada falhar (timeout, sem rede) → **fallback**: aceita `"1555"` como hoje. Isso garante que o usuário consiga entrar mesmo se a TV estiver offline, exatamente como o `LoginGate.tsx` web faz com `FALLBACK_PASSWORD`.

### 3. Sem alterações no banco

A tabela `app_settings` e a coluna `login_password` já existem e já são atualizadas pelo admin. Nada de migração.

### Detalhes técnicos

- **Endpoint**: `src/routes/api/public/verify-launcher-password.ts`, usando `createFileRoute` com `server.handlers.POST` e `supabaseAdmin`. Sem CORS especial (chamada server-to-server pelo APK).
- **URL base no APK**: reutilizar a base usada para OTA/catálogo (procurar a constante existente em `RemoteCatalog.kt` / `MainActivity.kt`) — assim a senha sempre consulta o mesmo ambiente do qual o APK está sendo atualizado.
- **Fallback `"1555"`**: mantido só para offline. Quando a TV estiver online, a senha hardcoded **não** será mais aceita se o admin tiver definido outra — porque o servidor responde `ok=false` e nem cai no catch.

## Resultado esperado

- Trocar a senha no admin web e em poucos segundos a TV (online) passa a aceitar apenas a nova senha.
- A senha antiga `1555` deixa de funcionar quando a TV tem internet.
- Se a TV estiver sem internet, `1555` ainda funciona como chave de emergência (igual ao comportamento do web).
