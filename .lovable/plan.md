# Botão dedicado de verificação OTA

Atualmente o botão "Procurar atualizações" no header dispara tanto a verificação dos apps (já removida) quanto a OTA. Vamos criar um botão dedicado e claro para o usuário verificar/atualizar o sistema (TV.Apps) manualmente.

## Mudanças em `src/routes/index.tsx`

- Adicionar no header, ao lado do botão "Procurar atualizações", um novo botão:
  - Texto: "Atualizar sistema" (ou "Verificando sistema..." durante a checagem).
  - Ícone: `Cloud` + `RefreshCcw` (spin quando `ota.checking`).
  - Cor de destaque laranja para diferenciar do botão de apps.
  - Ao clicar:
    1. Chama `ota.checkNow()`.
    2. Se `ota.hasUpdate` ficar true, o modal OTA já abre automaticamente (efeito existente).
    3. Se não houver update, o próprio hook exibe toast "✅ aplicativo já está atualizado".
- Manter navegação por DPAD (focusable, outline-none, focus styles).
- Remover a chamada `ota.checkNow()` do botão "Procurar atualizações" antigo (que agora só serve para apps), deixando-o exclusivo para o sistema OTA — ou simplesmente substituir aquele botão pelo novo, já que a verificação de apps foi removida.

## Decisão de UX

Substituir o botão atual "Procurar atualizações" por **"Atualizar sistema"** com ícone Cloud + RefreshCcw, em vez de manter dois botões redundantes. O texto deixa claro que é a atualização do próprio TV.Apps.

## Resultado

Usuário tem um botão claro no header para verificar atualizações OTA a qualquer momento.
# Sistema OTA (Over-The-Air Update)

Transformar o app em uma central com atualização automática do próprio APK via Lovable Cloud Storage.

## O que será feito

### 1. Backend (Lovable Cloud)
- Criar bucket público `tvapps-updates` no Storage para hospedar o APK e o arquivo de metadados.
- Você fará upload manual do `tvapps-latest.apk` e do `update.json` sempre que compilar uma versão nova.
- Formato do `update.json`:

```text
{
  "version": "2.4",
  "apkUrl": "https://<projeto>.supabase.co/storage/v1/object/public/tvapps-updates/tvapps-latest.apk",
  "changelog": "Melhorias visuais e correções",
  "forceUpdate": false
}
```

### 2. Lógica de verificação
- Ao abrir o app: baixa `update.json` automaticamente.
- Compara versão instalada (via `window.Android.version()` no APK nativo, ou constante local como fallback) com a versão remota.
- Botão "🔍 Procurar atualizações" no header dispara verificação manual com loading.
- Bloqueio para evitar downloads duplicados ou simultâneos.

### 3. UI quando houver atualização
- Badge "⬆️ UPDATE" com glow laranja/amarelo.
- Modal "Nova versão disponível" mostrando versão instalada, nova versão, changelog e botões "Atualizar agora" / "Depois".
- Navegação por DPAD totalmente funcional.

### 4. UI quando NÃO houver atualização
- Toast "✅ O aplicativo já está atualizado".

### 5. Processo de atualização
- "Atualizar agora" → no APK nativo chama `window.Android.installApk(url, "TV.Apps")`.
- No navegador, baixa o APK com barra de progresso e abre o arquivo.

### 6. Force update
- Quando `forceUpdate: true`, o modal não pode ser fechado.

## Arquivos afetados

- Novo: `src/hooks/useOtaUpdate.ts` — busca o `update.json`, compara versões, expõe `hasUpdate`, `remoteVersion`, `changelog`, `forceUpdate`, `checking`, `checkNow()`.
- Novo: `src/components/OtaUpdateModal.tsx` — modal com suporte a DPAD e bloqueio em modo force.
- Novo: `src/lib/app-version.ts` — constante `APP_VERSION` com a versão local atual.
- Editar: `src/routes/index.tsx` — integrar o hook, exibir badge OTA, abrir modal quando houver update, conectar o botão "Procurar atualização" também à verificação OTA.
- Migration: criar bucket público `tvapps-updates` + policies de leitura pública.

## Detalhes técnicos

- Comparação semântica de versões aceitando `2.4`, `2.4.1`.
- Cache-busting com `?t=Date.now()` na URL do `update.json`.
- Erros silenciosos na verificação automática; toast só na manual.
- Estado inicial vazio para evitar erro de hidratação SSR.

## Depois que o plano for aprovado

Você precisará fazer upload manual no bucket `tvapps-updates`:
1. `tvapps-latest.apk` (o APK novo)
2. `update.json` (com a nova versão)

Te explico o passo a passo do upload assim que o código estiver pronto.
