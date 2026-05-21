### Plano de Implementação: Atualização de Versão e Detecção

Este plano adiciona a funcionalidade de comparar a versão instalada dos aplicativos com a versão disponível remotamente (via JSON), exibindo badges de "Atualização disponível" e informações de versão nos cards.

#### 1. Estrutura de Dados das Versões
- Criar um arquivo `public/versions.json` que servirá como fonte da verdade.
- Atualizar a interface `AndroidBridge` e as classes Kotlin para suportar a leitura de versões.

#### 2. Alterações no Android (Kotlin)
- **AppCatalog.kt**: Adicionar o campo `packageName` (já existe) e preparar para receber informações de versão.
- **MainActivity.kt**:
  - Implementar `getInstalledVersion(packageName)` usando `packageManager.getPackageInfo`.
  - Expor essa função via `JavascriptInterface` para a WebView.
  - Implementar lógica para buscar o `versions.json` via HTTP (ou receber do React) para exibir os badges na UI nativa.

#### 3. Alterações no Frontend (React)
- Criar um hook `useVersions` para buscar o `versions.json`.
- Comparar a versão remota com a versão instalada (obtida via bridge).
- **UI dos Cards**:
  - Adicionar badge "Atualização disponível" em cor de destaque (ex: laranja/ouro).
  - Mostrar "Versão instalada: X" e "Nova versão: Y" quando houver discrepância.
  - Alterar o texto do botão para "ATUALIZAR APP" se houver nova versão.

#### 4. Fluxo de Atualização
- Se `remoteVersion > installedVersion`:
  - Botão vira "ATUALIZAR".
  - Clique inicia o download e sobrescreve o APK anterior.

### Detalhes Técnicos

```json
// public/versions.json
{
  "com.unitv.app": { "version": "2.4", "code": 24 },
  "com.nexa.tv": { "version": "1.8", "code": 18 },
  "com.alphaplay.app": { "version": "3.1", "code": 31 }
}
```

---
*Nota: Para que isso funcione 100%, você precisará atualizar manualmente esse JSON sempre que subir um novo APK para seus links de download.*
