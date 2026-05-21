Implementar o sistema de atualização OTA (Over-The-Air) completo no Android, adicionando um botão dedicado na barra superior que permite verificar, baixar e instalar novas versões do aplicativo (launcher).

### Mudanças no Android (MainActivity.kt)

1. **Botão de Atualização**: Adicionar um novo botão focável na barra superior (ao lado das pílulas de status) com o texto "Procurar Atualização".
2. **Lógica de Verificação**:
    - Ao clicar, o app fará uma requisição ao arquivo `update.json` no Supabase.
    - Se a versão remota for maior que a local, abrirá um diálogo de confirmação: "Nova versão disponível. Deseja atualizar agora?".
    - Se a versão for a mesma, exibirá um aviso: "O sistema já está atualizado".
3. **Download e Instalação**:
    - Se o usuário confirmar a atualização, o app baixará o APK do launcher (usando a URL contida no `update.json`).
    - Exibirá o progresso do download.
    - Ao concluir, abrirá automaticamente o instalador nativo do Android para substituir a versão atual.
4. **Resiliência**: Tratar erros de conexão e arquivos inexistentes (404) com mensagens claras para o usuário.

### Detalhes Técnicos

- **Interface**: O botão seguirá o estilo visual dos "cards" e "pills" já existentes, com bordas arredondadas, cores contrastantes e feedback visual ao receber foco do controle remoto.
- **OTA JSON**: O sistema passará a esperar que o `update.json` contenha pelo menos: `{"version": "1.0.1", "url": "https://.../launcher-v1.0.1.apk"}`.
- **Permissões**: O app já possui as permissões necessárias para baixar e solicitar instalação de pacotes.
