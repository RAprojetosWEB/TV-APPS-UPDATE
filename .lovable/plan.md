## Redesign do painel admin — dark premium

Estilo-alvo: Linear / Vercel / Raycast — superfícies dark com profundidade real, acento verde neon **só** no que importa, tipografia com hierarquia clara, microinterações discretas.

### 1. Sistema de design (src/styles.css)

Adicionar tokens semânticos no `:root` (e mapear em `@theme inline`) para parar de hard-codar `oklch(...)` e `white/10` no JSX:

```text
--surface-0   #0A0B0F  (fundo da página)
--surface-1   gradiente sutil p/ cards
--surface-2   superfície elevada (hover, dialog)
--border-soft / --border-strong   (2 níveis)
--text-primary / --text-secondary / --text-muted   (3 níveis)
--neon          verde principal
--neon-glow     versão translúcida p/ ring/shadow
--shadow-card   sombra ampla + difusa
--shadow-glow   glow neon no hover/foco
--shadow-inset  highlight 1px no topo do card
```

Mais: keyframes `fade-in-up`, `scale-in`, `glow-pulse`; transição padrão `cubic-bezier(.2,.8,.2,1) 220ms`.

### 2. Primitivos reutilizáveis (novos componentes em src/components/admin/)

- `<Surface>` — card base com gradiente `surface-1`, borda `border-soft`, sombra + highlight interno, hover eleva e ganha glow neon suave.
- `<SectionHeader title subtitle action />` — padrão pra cada bloco (label uppercase fininho + título grande + ação à direita).
- `<StatPill label value tone="neon|muted|danger" />` — chips de status.
- `<NeonButton variant="primary|ghost|danger">` — substitui os `inline-flex … bg-[oklch…]` espalhados; primary com leve glow, ghost com borda fina, danger só na hora.
- `<Toggle>` — switch estilo Stripe (track 36×20, thumb com sombra, transição suave, glow neon quando ativo).
- `<IconButton>` — botão quadrado 36px para ações de linha (editar/duplicar/excluir).

### 3. Header

Fininho (h=56), sticky, fundo `surface-0/80` + `backdrop-blur-xl`, borda inferior `border-soft`. Logo "TV.Apps" + chip discreto "admin". À direita: chip do email + "Sair" como ghost button.

### 4. Layout da página

- Container `max-w-5xl` (era 4xl) com `space-y-10` entre seções pra dar respiro.
- Título da seção (Senha / Apps / OTA) usando `<SectionHeader>` — não mais um header dentro do próprio card.
- Grid de apps mantém 1 coluna (cards full-width, é o que cabe melhor a lista ordenável).

### 5. AppCard

- Padding interno `p-6`, gap maior, alinhamento estável (handle de drag à esquerda virando ícone discreto).
- Ícone do app **80×80** (era 56), com fundo gradiente e ring sutil — vira o "herói" do card.
- Nome do app: `text-lg font-semibold tracking-tight` (era `font-bold` no `text-base`).
- Pacote em `text-xs text-muted font-mono` (assina o lado técnico sem competir).
- Badges (bloqueado / inativo) compactos, com glow quando críticos.
- Ações: 3 IconButtons agrupados num pill com divisores finos, aparecendo full-opacity só no hover (some pra reduzir poluição quando o card não está em foco).
- Hover: leve `translateY(-1px)`, glow neon `0 0 0 1px var(--neon-glow), 0 12px 40px -12px var(--neon-glow)`.
- Formulário expandido (edição): bloco interno com `surface-2`, separador limpo, inputs com `h-10` e foco neon.

### 6. Seção OTA

- Card único de "Versão atual" no topo, grande, com número da versão em display (`text-4xl font-semibold tabular-nums`), changelog truncado, botão "Publicar nova" como primary neon.
- Histórico: lista compacta (linha 56px), 1 linha por versão: `v1.2.3` mono • data • size • menu de ação. Só a versão atual ganha o badge neon glow; as outras ficam em `text-muted` sem borda visível, separadas por divider finíssimo (`border-b border-soft/50`).
- Form "Publicar versão" colapsa por padrão e abre num bloco `surface-2` (não num card flutuando).
- Backup / Restore / Upload direto: agrupados num cluster `<StatPill>`-like no rodapé da seção, não mais botões soltos no meio.

### 7. Dialogs (Restore, confirmação de delete)

`DialogContent` com `surface-2`, borda `border-strong`, sombra ampla, `animate-scale-in`. Inputs e checkboxes seguem o mesmo sistema.

### 8. Microinterações

- Mount de cards: `animate-fade-in-up` com stagger leve (delay por index, capado em 8).
- Hover em qualquer botão/card: 180ms easing suave (scale 1.01 + glow).
- Focus visible: ring neon de 2px sempre, em vez de outline default.
- Toggle: spring-like (200ms ease-out no thumb).
- Smooth scroll global: `html { scroll-behavior: smooth }`.

### O que NÃO muda

- Estrutura de rotas, server functions, lógica de DnD (`dnd-kit`), backup/restore — só visual.
- Funcionalidades existentes ficam idênticas: senha, CRUD de apps, OTA, backup/restore, upload direto.

### Arquivos alterados

- `src/styles.css` — tokens + keyframes + utilitários (.surface, .surface-2, .glow-neon).
- `src/components/admin/Surface.tsx`, `SectionHeader.tsx`, `NeonButton.tsx`, `Toggle.tsx`, `IconButton.tsx`, `StatPill.tsx` (novos).
- `src/routes/admin.tsx` — refatora JSX pra usar os primitivos; sem lógica nova.

Confirma seguir assim?
