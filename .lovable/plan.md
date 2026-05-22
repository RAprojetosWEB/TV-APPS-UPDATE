Alterar `android/version.properties`:

```
versionBase=22
```

Resultado: próximos builds gerarão `versionName` no formato `22.AAAA.MM.DD.HHmm` (ex.: `22.2026.05.22.1430`). O `versionCode` continua sendo gerado por timestamp automaticamente.

Opcional: atualizar também o fallback web em `src/lib/app-version.ts` (`APP_VERSION = "22.0"`) para que o preview no navegador mostre a nova versão — no TV Box o valor real já vem do APK.

Após aplicar, rebuild no Android Studio (`Build → Build APK(s)`) para gerar o novo APK assinado.