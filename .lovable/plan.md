# Atualizar texto do rodapé da tela inicial

## Contexto
O rodapé atual exibe: *"Após o download, abra o arquivo APK e permita instalação de fontes desconhecidas"*.

Como o app já automatiza o download e dispara o instalador automaticamente, esse texto está desatualizado e fora de contexto para o usuário final.

## Mudança proposta
Substituir o texto do rodapé por uma frase mais coerente com o propósito do app (central de aplicativos para TV Box), mantendo o mesmo estilo visual (cinza claro, centralizado, fonte pequena).

### Opções de novo texto
1. **"Selecione um aplicativo e pressione OK para instalar ou abrir"** — instrução de uso direta.
2. **"TV.Apps — Central de aplicativos para sua TV Box"** — assinatura institucional.
3. **"Use o controle remoto para navegar entre os aplicativos"** — orientação de navegação.

Sugestão padrão: **opção 1**, por ser instrucional e útil para quem está usando o launcher pela primeira vez.

## Arquivo afetado
- `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt` (variável `footer`, ~linha 468)

## Detalhes técnicos
Alteração de uma única string. Sem mudanças de layout, cor, tamanho ou comportamento.
