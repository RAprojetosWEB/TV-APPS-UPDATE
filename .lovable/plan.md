## Backup completo v2

Hoje o `.zip` já tem `apps`, `app_versions`, `app_settings` e os dois buckets de storage. Vou expandir para incluir tudo que é razoável guardar.

### O que entra no zip (novo conteúdo em **negrito**)

```
backup-YYYY-MM-DD-HHMM.zip
├── manifest.json
├── README.txt
├── db/
│   ├── apps.json
│   ├── app_versions.json
│   ├── app_settings.json
│   ├── **user_roles.json**        # quem é admin etc.
│   └── **auth_users.json**        # id, email, created_at, last_sign_in_at, metadata
├── **schema/**
│   ├── **schema.sql**             # CREATE TABLE, RLS, functions, triggers (via pg_dump --schema-only)
│   └── **storage_buckets.json**   # config dos buckets (public/privado, limites)
├── storage/
│   ├── tvapps-updates/...
│   └── app-icons/...
└── **secrets/**
    └── **names.txt**              # só os NOMES dos secrets, nunca os valores
```

### Como funciona

Tudo numa server function `createBackup` em `src/lib/admin.functions.ts`, protegida por `requireSupabaseAuth` + checagem de role `admin` (como já está).

1. **Usuários auth**: `supabaseAdmin.auth.admin.listUsers()` paginado. Salvo apenas: `id`, `email`, `phone`, `created_at`, `last_sign_in_at`, `email_confirmed_at`, `user_metadata`, `app_metadata`. **Senhas (hash) não são exportadas** — o Supabase não expõe o hash via API, então restaurar usuários precisa de e-mail de reset ou senha nova.
2. **user_roles**: `supabaseAdmin.from('user_roles').select('*')`.
3. **Schema SQL**: como `pg_dump` não roda em Worker, vou montar via queries no `information_schema` + `pg_catalog`:
   - `CREATE TABLE` de cada tabela do schema `public`
   - políticas RLS (`pg_policies`)
   - funções (`has_role`, `update_updated_at_column`)
   - enums (`app_role`)
   - triggers
   
   Gera um arquivo `schema.sql` legível e (em maior parte) executável.
4. **Buckets**: `supabaseAdmin.storage.listBuckets()` → salva config como JSON.
5. **Secrets**: lista apenas nomes via env (`LOVABLE_API_KEY`, `SUPABASE_*`). Valores **nunca** entram no zip.
6. **README.txt** atualizado explicando cada pasta e o caveat dos usuários.

Continua usando `fflate` num único `.zip`.

### O que NÃO entra (e por quê)

- **Hashes de senha** — Supabase não expõe via API.
- **Valores de secrets** — risco de vazamento se o zip cair em mãos erradas.
- **Logs / histórico OTA** — não há tabela própria; o que existe é só `app_versions` (já incluído).
- **Restore dos novos itens** — o restore atual cobre apps/versions/settings + storage. Posso estender pra também restaurar `user_roles` e re-criar usuários (sem senha — mandando convite por e-mail) numa próxima iteração, se quiser. Schema SQL fica como referência, não é executado automaticamente no restore (pra evitar quebrar o banco vivo).

### Arquivos alterados

- `src/lib/admin.functions.ts` — expande `createBackup` com as novas seções; sem mudar a assinatura/retorno (continua `{ filename, dataBase64 }`).
- `.lovable/plan.md` — atualizar a descrição.

Sem mudanças no UI (`src/routes/admin.tsx`): o botão "Backup completo" continua o mesmo, só baixa um zip mais gordo.

Confirma que pode seguir assim?
