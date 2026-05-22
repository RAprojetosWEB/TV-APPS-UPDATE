## Problema

No `src/components/LoginGate.tsx`, quando há atualização disponível, o React só troca o **conteúdo interno** do mesmo card animado:

```tsx
<div className="... animate-in fade-in zoom-in-95 ...">
  {ota.hasUpdate ? <CardAtualização/> : <CardLogin/>}
</div>
```

O WebView do Android TV não repinta totalmente nessa troca → o card de login continua visível "fantasma" por baixo do card de atualização, e o glow verde da animação fica preso como uma barra horizontal atravessando a tela (o que aparece na sua foto).

## Solução

Tornar a tela de **Atualização Obrigatória** uma rota visual **separada e em tela cheia**, igual ao que já é feito com `showSplash` e `isTransitioning`. Assim o React desmonta completamente o login antes de mostrar a tela de update — sem sobreposição, sem glow residual.

### Mudanças em `src/components/LoginGate.tsx`

1. **Adicionar um novo bloco `if (ota.hasUpdate) return (...)` ANTES do `return` principal** (logo após o `isTransitioning`), com layout próprio em tela cheia (mesmo estilo visual do splash/transitioning: glow âmbar, ícone grande, título, botão "ATUALIZAR AGORA" e barra de progresso quando baixando).

2. **Remover o bloco `{ota.hasUpdate ? (...) : (...)}` do card de login** — o card de login passa a renderizar só o formulário de senha, sem ternário.

3. **Remover o `boxShadow` condicional âmbar** do card de login (não é mais necessário, já que login e update viraram telas distintas).

4. Manter a lógica de `updateBtnRef` recebendo foco automaticamente, mas dentro da nova tela de update.

### Resultado

- Login → tela limpa, só formulário.
- Update disponível → tela cheia separada, sem nenhum elemento do login por baixo.
- Sem glow/barra residual atravessando a tela.
- Foco do controle remoto continua funcionando igual.

Sem mudanças no Android nativo (`MainActivity.kt`) — o problema é só na camada web/WebView.