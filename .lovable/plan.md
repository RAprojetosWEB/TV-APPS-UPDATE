## O que muda

Hoje cada card no admin tem **uma chave** que apenas bloqueia/desbloqueia o app (`is_blocked`). Quando bloqueado, o app continua aparecendo na TV Box, mas como um card neutro "Em breve um novo app aqui".

Você quer uma **segunda chave**, ao lado da atual, que controle se o app aparece ou não — ou seja, alternar `is_active`. Quando desligada, o app some completamente da TV Box (o `getCatalog` já filtra por `is_active = true`).

## Mudanças

1. **`src/routes/admin.tsx` — card do app**
   - Adicionar uma segunda `Switch` antes da chave de bloqueio.
   - Chave da **esquerda (nova)**: Visível/Oculto → controla `is_active`. Verde = visível na TV, cinza = oculto.
   - Chave da **direita (existente)**: Liberado/Bloqueado → controla `is_blocked` (sem mudança de comportamento).
   - Cada switch com `title` no hover deixando claro o que faz ("Mostrar na TV" / "Bloquear app").
   - Pequeno rótulo/ícone acima ou tooltip pra não confundir as duas chaves.

2. **Handler de toggle**
   - Hoje existe `handleToggle(app, v)` que faz update do `is_blocked`. Vou adicionar `handleToggleActive(app, v)` análogo que atualiza `is_active` no banco e revalida a lista.

3. **Sem mudança no banco** — os campos `is_active` e `is_blocked` já existem e o endpoint público `/api/public/catalog` e o `getCatalog` já filtram por `is_active`, então a TV Box já respeita corretamente.

## Resultado

No card do AlphaPlay da sua screenshot, você terá duas chaves lado a lado:
- 1ª chave OFF → o app some completamente da TV Box
- 2ª chave OFF → o app aparece como card "Em breve" (bloqueado)
- Ambas ON → app normal na TV
