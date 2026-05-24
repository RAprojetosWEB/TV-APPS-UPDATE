## Resetar o token

Token gerado: **`tvapps_k7m3x9q2p8w4n6`**

Passos:

1. Atualizar o secret `BUILD_VERSION_TOKEN` no Lovable Cloud com esse valor (vou abrir o formulário, você só clica "Salvar" com o valor já preenchido — ou cola você mesmo, tanto faz).

2. Você abre o `android/local.properties` no Android Studio e adiciona:

```text
BUILD_VERSION_TOKEN=tvapps_k7m3x9q2p8w4n6
```

3. Compila normal. Versão sai `2.1`, depois `2.2`, `2.3`...

Pronto.