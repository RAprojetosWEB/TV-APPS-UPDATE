# Mensagem de acesso restrito

## Objetivo
Comunicar claramente que o app é de uso restrito a clientes, orientando novos
usuários a solicitar acesso pelo WhatsApp.

## Mensagem
> Acesso restrito a clientes. Peça o acesso no WhatsApp **14 99868-1696**.

## Onde aplicar

1. **Tela de login (web/launcher React)** — `src/components/LoginGate.tsx`
   - Adicionar a mensagem logo abaixo do bloco "Bem-vindo / Digite a senha
     para continuar", em fonte pequena e cor suave (`text-white/60`), com o
     número do WhatsApp destacado.
   - Manter centralizado, sem alterar layout, glow ou botões existentes.

2. **Rodapé do launcher Android (tela inicial da TV)** —
   `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt` (variável
   `footer`, ~linha 468). Substituir o texto atual
   ("Selecione um aplicativo e pressione OK para instalar ou abrir") pela
   mesma mensagem de acesso restrito, mantendo cor, tamanho e alinhamento.

## Fora do escopo
- Não alterar lógica de autenticação, OTA ou layout das telas.
- Não adicionar link clicável (TV Box não tem navegador padrão); apenas texto.
