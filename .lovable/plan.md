Adicionar uma seção no `/admin` (web) para alterar a senha de login do app Android.

## Contexto
- A tabela `app_settings` já tem a coluna `login_password` (id="main", default "1555").
- O app Android valida a senha via `verifyLoginPassword` em `src/lib/auth.functions.ts` lendo dessa coluna.
- Hoje não existe UI para mudar essa senha — só dá pra editar direto no banco.

## Mudanças

**1. `src/lib/admin.functions.ts`** — adicionar 2 server functions (ambas protegidas por `requireSupabaseAuth` + `assertAdmin`):
- `getLoginPassword()` → retorna a senha atual (string) lendo de `app_settings` id="main".
- `updateLoginPassword({ password })` → valida com Zod (`min(4).max(50)`) e dá UPDATE em `app_settings`. Se a linha "main" não existir, faz INSERT.

**2. `src/routes/admin.tsx`** — adicionar um card "Senha de login do app TV":
- Mostra a senha atual (com botão olho para esconder/mostrar).
- Campo input + botão "Salvar".
- Toast de sucesso/erro.
- Aviso curto: "Essa é a senha exigida ao abrir o launcher na TV Box."

## Sem mudanças
- Sem migration (coluna já existe).
- Sem mexer no app Android (já consome o endpoint).
- Sem alterar RLS (tabela já é acessada só via `supabaseAdmin` no servidor).