
# Sistema de bloqueio de apps com painel admin

## Decisões confirmadas

- **Card bloqueado:** neutro na mesma posição (cadeado cinza, sem nome/logo/descrição)
- **Email admin:** `contato.ra.recargas@gmail.com`
- **Bônus incluído:** editar nome, descrição, ícone e URL do APK direto pelo painel (sem recompilar)
- **Motivo:** opcional — se vazio, mostra só "Em manutenção"

---

## Como vai funcionar

### Painel web (`/admin`)
Você acessa `https://sideload-hero.lovable.app/admin`, faz login com seu email, e vê uma tela tipo:

```
┌─────────────────────────────────────────────────┐
│  Painel TV.Apps                       [Sair]    │
├─────────────────────────────────────────────────┤
│                                                  │
│  🟣 UniTV                          [●━━] ATIVO  │
│     Mais de 400 canais, filmes...   [Editar]    │
│                                                  │
│  🟣 Nexa TV                        [━━●] BLOQ.  │
│     Motivo: Em manutenção           [Editar]    │
│                                                  │
│  🟣 AlphaPlay                      [●━━] ATIVO  │
│     Mais de 300 canais...           [Editar]    │
│                                                  │
│  [+ Adicionar novo app]                          │
└─────────────────────────────────────────────────┘
```

Clica no switch → digita motivo (opcional) → salva. Pronto.

### TV Box (Android)
A cada abertura do app, busca a lista atualizada do servidor (~1s). Apps liberados mostram normal. Apps bloqueados viram:

```
┌──────────────────┐
│      🔒          │
│  Indisponível    │
│ Em manutenção    │
│   (sem botão)    │
└──────────────────┘
```

Não dá foco no controle, não tem botão de download/abrir, não mostra nome/logo/descrição do app original.

---

## O que será construído

### 1. Banco de dados (Lovable Cloud)
Adicionar à tabela `apps` existente:
- `is_blocked` (boolean, padrão `false`)
- `block_reason` (texto, opcional)
- `icon_url` (texto — URL do logo no Storage)
- `apk_url` (texto — URL do APK)
- `display_order` (número — pra ordenar os cards)
- `is_active` (boolean — pra esconder app totalmente se quiser)

Criar tabela `user_roles` com role `admin` (padrão de segurança). Função `has_role()` security definer.

Migrar os 3 apps atuais (UniTV, Nexa, AlphaPlay) pro banco com os dados que já estão hardcoded no `AppCatalog.kt`.

Subir os 3 ícones atuais pro Storage bucket público.

### 2. Autenticação
- Habilitar email/senha no Lovable Cloud
- **Auto-confirm desabilitado** (você confirma o email antes de logar pela 1ª vez)
- Apenas seu email `contato.ra.recargas@gmail.com` terá role `admin`
- Signup público bloqueado (ninguém consegue criar conta)

### 3. Endpoint público pra TV (`/api/public/catalog`)
- Server route que retorna JSON com a lista de apps (id, nome, descrição, logo, apk, blocked, reason)
- Bypassa auth (a TV não tem login)
- Cache de 30s no servidor

### 4. Painel admin web
Páginas TanStack Router:
- `/login` — email + senha
- `/admin` — lista de apps com switches (protegida, só role admin)
- `/admin/app/$id` — editar nome, descrição, icon, URL do APK
- `/admin/new` — adicionar novo app

Server functions com `requireSupabaseAuth` + checagem de role admin.

### 5. App Android (Kotlin)
- Substituir `AppCatalog.kt` hardcoded por `RemoteCatalog.kt` que busca do endpoint
- Cache local de 5 minutos (se servidor cair, usa o último)
- Adicionar layout `card_blocked` no `MainActivity.kt`:
  - Cadeado cinza (vetor)
  - Texto "Indisponível"
  - Texto do motivo (se houver)
  - Sem botão, sem foco
- Manter posição original do card

---

## Fluxo completo (visual)

```
┌────────────┐        ┌──────────────┐       ┌────────────┐
│ Você abre  │        │ Lovable      │       │ TV Box     │
│ /admin     │        │ Cloud (DB)   │       │ Android    │
│ no celular │        │              │       │            │
└─────┬──────┘        └──────┬───────┘       └──────┬─────┘
      │ toggle Nexa = ON     │                       │
      ├─────────────────────>│                       │
      │                      │                       │
      │                      │  GET /api/public/     │
      │                      │  catalog (a cada      │
      │                      │  abertura)            │
      │                      │<──────────────────────┤
      │                      │                       │
      │                      │  {nexa: blocked:true} │
      │                      ├──────────────────────>│
      │                      │                       │
      │                      │             [card 🔒 ]│
      │                      │             [card ✓  ]│
      │                      │             [card ✓  ]│
```

---

## Segurança

- RLS habilitado em todas as tabelas
- `apps` legível por todos (necessário pra TV funcionar sem login)
- Updates em `apps` apenas pra role `admin` (via `has_role()`)
- `user_roles` em tabela separada (padrão obrigatório, evita escalação de privilégio)
- Service role key NUNCA exposta ao cliente

---

## Detalhes técnicos (pode pular)

- **Migrations SQL:** 1 migration cria colunas novas + tabela user_roles + função has_role + policies + bucket de ícones
- **Server functions:** `getCatalog` (pública), `updateApp`, `toggleBlock`, `createApp` (admin only)
- **Server route:** `src/routes/api/public/catalog.ts`
- **Auth attacher:** já existe em `src/start.ts`, será reutilizado
- **Kotlin:** novo `RemoteCatalog.kt`, novo `card_blocked.xml`, alterações em `MainActivity.kt` pra renderizar condicionalmente

---

## Passo a passo após aprovar

1. Migration do banco (você aprova o SQL)
2. Configuro auth (email/senha, sem auto-confirm)
3. Crio painel web + endpoint público
4. Modifico app Android
5. **Você precisa fazer 1 coisa manual:**
   - Acessar `/login` com `contato.ra.recargas@gmail.com`
   - Criar a senha
   - Confirmar email (link chega no Gmail)
   - Eu então rodo um comando que te promove a `admin`
6. Rebuild do APK no Android Studio e instala na TV

A partir daí: bloquear/desbloquear apps = 1 clique no celular, em qualquer lugar.

---

## Tempo estimado: 25-30 minutos do meu lado após aprovação
