## Diagnóstico do erro de conexão no APK

Checei o status do backend hospedado (Lovable Cloud) e ele está **respondendo normalmente** — não há instabilidade do nosso lado neste momento. Então o "erro de conexão com servidor" que aparece no APK ao colocar a senha tem outra causa.

O APK chama o endpoint público `/api/public/verify-launcher-password` no domínio publicado. Possíveis culpados:

1. URL antiga/errada compilada no APK.
2. TV Box com Android antigo (≤ 7.1) que não confia no certificado TLS do `.lovable.app` (problema bem comum em TV Box genérica).
3. Handler retornando erro intermitente.

### Plano de execução

1. Testar o endpoint em produção via `invoke-server-function` para confirmar que responde 200.
2. Olhar `MainActivity.kt` e ver:
   - Qual URL está hardcoded.
   - Como o erro é mostrado (mapear `IOException` / `SSLHandshakeException` para mensagens distintas em vez de "sem conexão").
3. Se for problema de TLS em Android antigo: adicionar `network_security_config.xml` confiando em system + user CAs e atualizar OkHttp para usar `conscrypt-android` (ou cair pra HttpURLConnection com TLS 1.2 forçado).
4. Recompilar APK.

Antes de mexer no Android, **preciso de uma confirmação rápida** que muda o tipo de correção:

### Pergunta

Qual a versão do Android da TV Box onde dá o erro? (Configurações → Sobre → versão do Android: 7, 9, 11, etc.)

- Se for **7 ou menor** → é praticamente certo que é falha de certificado TLS (corrige no manifesto + network_security_config).
- Se for **9 ou maior** → vou investigar a URL/handler/logs do servidor.

Sem isso eu posso queimar várias iterações chutando.
