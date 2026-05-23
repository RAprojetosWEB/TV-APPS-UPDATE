## Plano

Na versão web (navegador comum), pular completamente a tela de senha. No APK Android (WebView nativa), continuar exigindo a senha como hoje.

### Como detectar
O app já distingue Android nativo pela presença de `window.Android.installApk` (mesma checagem usada em `src/routes/index.tsx`). Vou usar a mesma checagem no `LoginGate`.

### Mudança
Em `src/components/LoginGate.tsx`, no `useEffect` inicial:
- Se `typeof window.Android?.installApk !== "function"` → considerar autenticado automaticamente (`setAuthed(true)`), pulando splash, OTA gate e tela de senha.
- Se for Android nativo → fluxo atual permanece intacto (splash + verificação OTA + senha).

Nada mais muda: `app_settings`, `verifyLoginPassword`, splash e OTA continuam funcionando no APK.

### Observação
"Versão web" aqui inclui o preview do Lovable e o site publicado em qualquer navegador (desktop, celular, smart TV browser). Só o APK Android (com a bridge `window.Android`) mantém o login.