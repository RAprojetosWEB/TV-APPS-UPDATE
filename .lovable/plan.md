# Modal "Abrir arquivo?" ao terminar o download

Quando o download de um APK terminar, abrir um modal centralizado perguntando: "Deseja abrir o arquivo?" com os botões **Sim** e **Não**.

Ao clicar em **Sim**, o app navega para a URL do blob. O Android reconhece o MIME `application/vnd.android.package-archive` e chama automaticamente o instalador nativo do sistema.

## O que será feito em `src/routes/index.tsx`

- Armazenar a `blobUrl` no estado de cada botão após o término do download (hoje é criada e descartada localmente).
- Adicionar um modal overlay (fixed, fundo escuro semi-transparente, centralizado) exibido quando `status === "done"`.
- O modal mostra: ícone de confirmação, nome do app, texto "Download concluído. Deseja abrir o arquivo?" e dois botões grandes:
  - **Sim, abrir** (verde, foco inicial)
  - **Não, agora não**
- Navegação DPAD dentro do modal:
  - ← → alterna entre os botões
  - Enter confirma
  - Escape/Back fecha o modal
- Ao clicar em **Sim**: executar `window.location.href = blobUrl`. No Android dispara o instalador nativo do APK; em outros browsers pode apenas abrir/baixar de novo.
- Ao clicar em **Não**: fechar o modal e retornar o card ao estado `idle`.
- Após fechar o modal, o card volta ao conteúdo normal.

## Limitação conhecida

- Chrome Android moderno: abre o instalador diretamente ✅
- WebViews antigas: podem apenas baixar novamente o APK
- A notificação automática padrão do Android continua funcionando em paralelo como fallback.

## Não alterar

- Lógica de download
- Barra de progresso
- Layout principal dos botões
- Navegação DPAD principal
- Manifest PWA
