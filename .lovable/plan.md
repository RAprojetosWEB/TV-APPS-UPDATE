## Objetivo

Permitir que você instale `/admin` como app independente no celular/desktop (botão "Adicionar à tela inicial" / "Instalar app"), abrindo direto no painel admin em modo standalone — sem mexer no PWA atual que o launcher TV usa.

## Por que um manifest separado

O `public/manifest.json` atual é do app TV (`start_url: "/"`, `display: "fullscreen"`, orientação landscape). Se eu mexer nele, quebra a experiência da TV. Solução: criar um **segundo manifest** só para o admin e linkar ele apenas na rota `/admin`.

Também **não vou adicionar service worker** — seguindo a recomendação do Lovable, PWA sem SW já é instalável e evita problemas de cache no preview do editor. Você só não terá modo offline (não precisa pro admin).

## Mudanças

**1. Criar `public/manifest-admin.json`**
- `name`: "TV.Apps Admin"
- `short_name`: "Admin"
- `start_url`: "/admin"
- `scope`: "/admin"
- `display`: "standalone" (não fullscreen — admin precisa da barra de status pra digitar)
- `orientation`: "portrait" (admin é usado no celular)
- `theme_color` / `background_color`: tons do tema admin
- Reusa `/icon-512.png` como ícone

**2. Sobrescrever o manifest na rota `/admin`**

No `src/routes/admin.tsx`, adicionar `head()` que substitui o `<link rel="manifest">` herdado do root, apontando pra `/manifest-admin.json`. Também ajustar `theme-color` e título da aba.

**3. Sem mudanças** em: root, manifest.json do TV, service worker (continua não existindo), nem nas funções backend.

## Como instalar depois

- **Android (Chrome)**: abrir `/admin` → menu ⋮ → "Instalar app" / "Adicionar à tela inicial"
- **iOS (Safari)**: abrir `/admin` → compartilhar → "Adicionar à Tela de Início"
- **Desktop (Chrome/Edge)**: abrir `/admin` → ícone de instalar na barra de endereço

Importante: a instalação só funciona na **URL publicada** (`sideload-hero.lovable.app`), não no preview do editor.

## O que NÃO entra

- Service worker / modo offline (causa problemas no preview e você não precisa)
- Push notifications
- Mudanças no manifest atual da TV
