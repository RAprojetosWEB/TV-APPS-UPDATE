# Barra de progresso de download nos botões

`DownloadManager` é API nativa Android e não roda em PWA. A solução equivalente em web — visualmente idêntica — usa `fetch` + `ReadableStream` pra ler o APK em pedaços, calcular % em tempo real, e no final disparar o download via blob.

## O que vou fazer

Atualizar `src/routes/index.tsx`:

- Adicionar estado por botão: `idle | downloading | done | error` + `progress` (0–100).
- Ao clicar (ou Enter no DPAD): iniciar `fetch(url)` com leitor de stream.
- Ler `Content-Length` pra saber o total, somar bytes recebidos a cada chunk → calcular %.
- Substituir o conteúdo do card focado por **barra de progresso grande + número da %** enquanto baixa.
- Ao terminar: montar `Blob`, criar `<a download>` automático → Android dispara notificação "Abrir" que aciona o instalador nativo.
- Tratamento de erro: mostrar mensagem no card + botão "Tentar de novo".
- Manter navegação DPAD; bloquear iniciar 2º download se um já está em andamento no mesmo botão.

## Limitações honestas

- A barra mostra o progresso **do download dentro do navegador**, não do `DownloadManager` do sistema. Pro usuário final é a mesma coisa visual.
- Funciona se o servidor (Supabase) retornar `Content-Length` (retorna) e CORS permitir leitura (Supabase Storage público permite).
- Se quiser `DownloadManager` real + instalação automática, só com Capacitor + Kotlin (caminho separado).

## Não vou mexer

- Layout, cores, ícones, navegação DPAD, manifest PWA — tudo fica como está.
