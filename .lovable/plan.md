## Ajustes no card de app bloqueado (`src/components/BlockedCard.tsx`)

1. **Texto principal**: trocar "Indisponível" por **"Em breve um novo app aqui"**.
2. **Cadeado vermelho**: mudar a cor do ícone `Lock` e do fundo do círculo para tons de vermelho (ex.: ícone `oklch(0.65 0.20 25)`, fundo `oklch(0.30 0.10 25)`).
3. **Sem "null"**: a lógica atual já cai no fallback "Em manutenção" quando `reason` é vazio, mas está mostrando `"null"` — significa que está chegando a string literal `"null"` do banco. Ajustar a checagem para também ignorar `reason === "null"` (case-insensitive) e, quando vazio/null, **não mostrar nenhum texto** de motivo (em vez do fallback "Em manutenção").

## Fora de escopo
Nenhuma mudança no Android, no admin ou no schema do banco.