# Modal "Abrir arquivo?" ao terminar o download

Quando o download de um APK termina, abrir um modal centralizado perguntando "Deseja abrir o arquivo?" com botões **Sim** e **Não**. Ao clicar em **Sim**, o app navega pra URL do blob — o Android reconhece o MIME `application/vnd.android.package-archive` e chama o instalador nativo.

## O que vou fazer em `src/routes/index.tsx`

- Guardar a `blobUrl` no estado de cada botão ao final do download (hoje ela é criada e descartada localmente).
- Adicionar um modal overlay (fixed, fundo escuro semi-transparente, centralizado) que aparece quando `status === "done"`.
- Modal mostra: ícone de check, nome do app, "Download concluído. Deseja abrir o arquivo?", e 2 botões grandes: **Sim, abrir** (verde, foco inicial) e **Não, agora não**.
- Navegação DPAD dentro do modal: ← → alterna entre os 2 botões, Enter confirma, Escape/Back fecha.
- **Sim** → `window.location.href = blobUrl` (em Android dispara o instalador nativo; em outros browsers, abre/baixa de novo).
- **Não** → fecha o modal e volta o card pro estado idle.
- Card volta a mostrar conteúdo normal após fechar o modal.

## Limitação honesta

- O comportamento ao clicar em **Sim** depende do browser da TV Box:
  - Chrome Android moderno: abre o instalador direto ✅
  - WebView antiga: pode só baixar de novo
- A notificação automática do Android (que já aparece sozinha após o download) continua funcionando em paralelo — é o fallback garantido.

## Não vou mexer

- Lógica de download, barra de progresso, layout dos botões, navegação DPAD principal, PWA manifest.
