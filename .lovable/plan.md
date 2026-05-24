## Como vai funcionar

Cada vez que você roda o build no Android Studio, o Gradle faz uma chamada HTTPS para o Lovable Cloud, que incrementa um contador no banco e devolve o próximo número. Esse número vira o `versionName` e o `versionCode` do APK.

```text
Android Studio → Gradle → POST https://...lovable.app/api/public/bump-version
                            ↓
                       Banco: counter = counter + 1
                            ↓
                       Resposta: { versionName: "2.5", versionCode: 5 }
                            ↓
                       APK gerado com versão 2.5
                       update.json gerado com versão 2.5
```

Resultado: 2.1, 2.2, 2.3, 2.4... sempre incrementando, independente de baixar ZIP novo, trocar de máquina, ou apagar a pasta.

## Mudanças

**1. Banco (nova tabela `build_counter`)**

Uma linha só, com o número atual. RLS bloqueia leitura/escrita direta — só o endpoint server-side mexe nela.

```text
build_counter
├── id (fixo: 'launcher')
├── version_base (int, default 2)  ← edita só quando quiser virar 3.x
└── build_number (int)              ← incrementa sozinho
```

**2. Endpoint público `src/routes/api/public/bump-version.ts`**

POST sem autenticação (precisa funcionar do Gradle, sem login). Usa `supabaseAdmin` para incrementar atomicamente e devolver:

```json
{ "versionName": "2.5", "versionCode": 5 }
```

Proteção mínima: header secreto `x-build-token` que só você conhece, pra evitar que qualquer um na internet incremente seu contador.

**3. `android/app/build.gradle.kts`**

Remove a leitura/escrita de `version.properties` (a parte que está bugada). No lugar, faz:

```text
curl -X POST -H "x-build-token: ..." https://...lovable.app/api/public/bump-version
→ parse JSON → usa versionName/versionCode no APK e no update.json
```

Se a chamada falhar (sem internet, por ex.), o build aborta com mensagem clara, em vez de gerar versão errada silenciosamente.

**4. `android/version.properties`**

Vira só:
```text
versionBase=2
```

Sem `buildNumber`. O contador agora mora no banco.

## O que você precisa fazer depois que eu aplicar

1. Aprovar a migração do banco
2. Eu te peço um token secreto (qualquer string aleatória) — guardamos como secret no Cloud
3. Eu te passo o token pra você colocar uma vez no `local.properties` do Android Studio
4. Compilar normalmente — versão sobe sozinha

## Trade-offs

- ✅ Versão curta (2.1, 2.2, 2.3...)
- ✅ Nunca reseta, em nenhum cenário
- ✅ Funciona em qualquer máquina
- ⚠️ Build precisa de internet (1 request HTTPS, ~200ms)
- ⚠️ Se rodar 2 builds ao mesmo tempo, gasta 2 números (pula um). Aceitável.