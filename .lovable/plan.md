Copiar o arquivo `local.properties` enviado para `android/local.properties` no projeto, para que ele venha incluído sempre que o ZIP for baixado do GitHub.

Conteúdo do arquivo:
```
BUILD_VERSION_TOKEN=tvapps_J3m3adVve_qr4Q5
```

Verifiquei que não há `.gitignore` bloqueando esse arquivo, então ele vai ser versionado normalmente.

**Aviso:** esse arquivo vai ficar público no repositório GitHub (se ele for público), incluindo o token. Se isso for um problema, melhor manter o `local.properties` fora do repo.