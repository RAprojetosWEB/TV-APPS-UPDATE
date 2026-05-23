Implementar no `/admin`: CRUD completo de apps (drag-drop, novo, excluir, duplicar) + gestão de OTA do launcher Android.

## 1. CRUD completo de apps

**Backend (`src/lib/admin.functions.ts`)** — novas server fns (todas com `requireSupabaseAuth` + `assertAdmin`):
- `createApp({ name, package_name, description?, apk_url?, icon_url? })` — INSERT, `display_order` = max+1.
- `deleteApp({ appId })` — DELETE (com confirmação no front).
- `duplicateApp({ appId })` — copia o registro com sufixo " (cópia)" no nome e `package_name + ".copy"`, ativo=false.
- `reorderApps({ orderedIds: string[] })` — UPDATE em batch dos `display_order` (0..N) numa transação RPC ou via múltiplos updates.

**Frontend (`src/routes/admin.tsx`):**
- Botão **"+ Novo app"** no topo → abre form modal/inline (campos: name obrigatório, package_name obrigatório, resto opcional). Submit chama `createApp`.
- Botão **Excluir** (ícone lixeira) em cada card → `confirm()` nativo → `deleteApp`.
- Botão **Duplicar** (ícone copy) em cada card → `duplicateApp`.
- **Drag-drop**: usar `@dnd-kit/core` + `@dnd-kit/sortable` (instalar). Handle de drag (ícone GripVertical) à esquerda de cada card. Ao soltar, atualizar otimisticamente a lista local e chamar `reorderApps` com a nova ordem; em erro, reverter.

## 2. Gestão de OTA do launcher

Hoje: você compila o APK localmente e sobe manualmente `app-release-latest.apk` + `update.json` no bucket `tvapps-updates`. A tabela `app_versions` existe mas está vazia.

**Nova seção "Atualizações do launcher (OTA)" no `/admin`** com 3 partes:

### a) Upload de nova versão
Form com:
- Upload do arquivo `.apk`
- `versionName` (ex: "2.5.0")
- `versionCode` (int, ex: 250)
- `changelog` (textarea opcional)

Ao salvar:
1. Upload do APK para `tvapps-updates/releases/{versionCode}.apk` (mantém histórico).
2. INSERT em `app_versions` (`is_latest=true`, demais viram false).
3. Reescreve `tvapps-updates/update.json` apontando para a nova `apkUrl` + versionCode/versionName.

Server fn `publishLauncherVersion({ versionName, versionCode, changelog, apkPath })`:
- Move/promove o APK do path temporário pra `releases/{versionCode}.apk`.
- Atualiza tabela `app_versions`.
- Reescreve `update.json` no bucket usando `supabaseAdmin.storage.from('tvapps-updates').upload('update.json', ..., { upsert: true })`.

**Schema**: a tabela `app_versions` hoje tem FK em `app_id` (apps do catálogo). Para versões do **launcher**, usar `app_id = NULL` ou criar tipo `target` ("launcher" | "catalog_app"). Vou propor coluna nova `target text default 'launcher'` + tornar `app_id` nullable via migration. (Mais simples que ter outra tabela.)

### b) Histórico de versões
Lista das últimas N versões com: versão, data, changelog, link pro APK, badge "Atual" na que tem `is_latest=true`. Botão **"Marcar como atual"** em qualquer linha → server fn `setLatestLauncherVersion({ versionId })` que:
1. UPDATE `is_latest=false` em todas.
2. UPDATE `is_latest=true` na escolhida.
3. Reescreve `update.json` com os dados dessa versão.

Isso dá rollback de 1 clique.

### c) Status atual
Card mostrando versão atualmente apontada pelo `update.json` (lendo o JSON do bucket), com link "Abrir update.json".

## Migrations necessárias

```sql
ALTER TABLE app_versions ALTER COLUMN app_id DROP NOT NULL;
ALTER TABLE app_versions ADD COLUMN target text NOT NULL DEFAULT 'launcher';
-- RLS: admins podem tudo, public continua só SELECT
CREATE POLICY "Admins manage versions" ON app_versions
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
```

## Dependências
- `bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

## Fora de escopo (deixar pra próxima)
- Stats/analytics de TVs ativas
- Forçar refresh remoto
- Per-device blocking
- Categorias / agendamento
- 2FA / multi-admin UI