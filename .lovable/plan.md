## Problema

No Android TV, ao usar o controle remoto para mover o foco do botão **"Procurar atualizações"** (Updates) para **"Configurações"**, o foco volta automaticamente para um dos cards de app.

## Causa

Em `src/routes/index.tsx`, o elemento `<main>` tem um `onKeyDown={handleKey}` global que captura **todas** as setas (incluindo as disparadas a partir dos botões do header, que são filhos de `<main>`).

```tsx
const handleKey = (e: React.KeyboardEvent) => {
  if (modalOpen) return;
  if (e.key === "ArrowRight") {
    e.preventDefault();
    setFocused(next);   // ← força foco em um card
    ...
  }
  ...
};
```

E há um `useEffect` que, sempre que `focused` muda, chama `refs.current[focused]?.focus()` — o que **rouba o foco** dos botões do header e devolve para o card.

Resultado: setas no header acabam movendo o foco para um card em vez de navegar entre os botões do header.

## Correção

Fazer o `handleKey` só agir quando o foco atual está em um dos cards da grade. Se o evento veio de um botão do header (ou de qualquer elemento que não seja um card), o handler ignora e deixa o navegador/WebView fazer a navegação natural por foco.

### Mudança em `src/routes/index.tsx`

No início de `handleKey`, antes de tratar `ArrowRight`/`ArrowLeft`:

```tsx
const handleKey = (e: React.KeyboardEvent) => {
  if (modalOpen) return;

  // Só captura setas quando o foco está em um dos cards de app.
  // Caso contrário (botões do header como Updates/Configurações),
  // deixa a navegação de foco padrão do Android TV agir.
  const target = e.target as HTMLElement | null;
  const isCard = refs.current.some((el) => el === target);
  if (!isCard) return;

  if (e.key === "ArrowRight") { ... }
  else if (e.key === "ArrowLeft") { ... }
};
```

Nada mais muda. A navegação entre cards continua igual; só paramos de sequestrar as setas quando o usuário está no header.

## Validação

- Web/preview: comportamento idêntico (cards continuam respondendo a ←/→).
- Android TV (após gerar novo APK): foco move livremente entre "Updates", "Configurações" e cards sem voltar sozinho.
