## Objetivo

Quando você bloquear um app no `/admin`, o card vira **neutro (cadeado, sem identidade)** automaticamente — tanto na home web quanto no APK Android instalado nas TV Boxes — sem precisar recompilar nada.

## Decisões assumidas

- **Cache do Android:** 5 min (recomendado). Se preferir 1 min ou 30s, me diga antes de eu construir.
- **Card neutro** já foi definido: cadeado cinza, texto "Indisponível / Em manutenção", sem logo, nome, descrição, botão ou foco do controle remoto.

---

## Etapa 1 — Home Web (`src/routes/index.tsx`)

1. Trocar a query atual (que lê direto de `apps` + `app_versions`) por uma chamada ao endpoint público `/api/public/catalog` (já existe), retornando também `is_blocked` e `block_reason`.
2. No render do card:
   - **Se `is_blocked = true`:** renderizar `<BlockedCard />` neutro — ícone de cadeado, texto "Indisponível", motivo opcional, `tabIndex={-1}` (controle remoto pula), sem `onClick`.
   - **Se `is_blocked = false`:** card normal como hoje.
3. Ajustar a navegação por setas para **pular cards bloqueados** (lista de índices "focáveis").
4. Fallback: se a API falhar, mantém os `APPS` locais como hoje.

## Etapa 2 — App Android

1. **Novo arquivo `RemoteCatalog.kt`:**
   - Faz `GET https://sideload-hero.lovable.app/api/public/catalog`
   - Cacheia o JSON em `SharedPreferences` por 5 min (timestamp + payload)
   - Se sem rede e cache válido → usa cache
   - Se sem rede e sem cache → usa lista hardcoded de `AppCatalog.kt` como fallback (mantemos `AppCatalog.kt` só como último recurso)
2. **`MainActivity.kt`:**
   - Substituir a leitura de `AppCatalog.kt` por `RemoteCatalog.fetch()`
   - Para cada app, montar o card como hoje **se `is_blocked = false`**
   - Se `is_blocked = true`, inflar layout `card_blocked` (novo): cadeado cinza, texto "Indisponível", motivo se houver, `isFocusable = false`
   - Atualizar a navegação de foco (D-pad) para pular cards bloqueados
3. **Novo layout `res/layout/card_blocked.xml`** com mesmo tamanho dos cards normais, fundo cinza-escuro neutro, ícone de cadeado centralizado.

## Etapa 3 — Endpoint `/api/public/catalog`

Verificar que ele já retorna os campos necessários (`id, name, description, icon_url, apk_url, is_blocked, block_reason, display_order`) com cache de 30s. Ajustar se faltar algum campo.

---

## Detalhes técnicos

- Endpoint público já existe em `src/routes/api/public/catalog.ts` e bypassa auth.
- Painel `/admin` já edita os campos; nada muda lá.
- `BlockedCard` web: componente React local em `src/components/BlockedCard.tsx`.
- Android: dependência HTTP usa `HttpURLConnection` nativo (sem adicionar libs).
- Após terminar, você precisa **rebuild do APK no Android Studio uma única vez** (para incluir o `RemoteCatalog.kt`). Depois disso, **nunca mais precisa recompilar** para bloquear/desbloquear/editar apps.

## O que NÃO faço agora

- Não mexo no painel `/admin` (já está pronto).
- Não mexo nas tabelas do banco (já têm todas as colunas).
- Não mexo no fluxo de OTA do próprio TV.Apps.

## Tempo estimado

15–20 min de implementação.