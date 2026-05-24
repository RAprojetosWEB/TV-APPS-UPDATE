## Problema

Build do Android quebrou após a última edição no `onResume` do `MainActivity.kt`:

```
e: MainActivity.kt:292 'if' must have both main and 'else' branches if used as an expression
```

## Causa

O bloco `pendingInstallApk?.let { apk -> ... }` faz com que o Kotlin trate o último `if / else if` como expressão de retorno do `let`. Como não existe um `else` final, o compilador reclama.

## Correção (1 linha)

Trocar `.let` por `.also` (que não exige valor de retorno), OU adicionar um `else { }` vazio ao final do `if / else if`.

Vou usar a opção mais segura e legível: **trocar `pendingInstallApk?.let { apk ->` por `pendingInstallApk?.also { apk ->`** no `onResume` (linha 286).

Isso resolve o erro de compilação sem mudar o comportamento.

## O que NÃO muda

- Nenhuma alteração no fluxo OTA, retry de 600ms, ou no botão "INSTALAR APLICATIVO".
- Nenhuma alteração no `ApkInstaller`.
- Versão continua subindo normalmente (2.3).
