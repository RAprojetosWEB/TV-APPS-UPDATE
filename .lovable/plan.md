### Plano: Detecção de Versão e Atualização Automática

Adicionar comparação entre versão instalada e versão remota dos APKs, com badges visuais e botão "ATUALIZAR" quando houver nova versão.

#### 1. Fonte das versões (JSON manual)
Criar `public/versions.json` que você atualiza sempre que publicar um APK novo:

```json
{
  "com.unitv.app":     { "version": "2.4", "code": 24 },
  "com.nexa.tv":       { "version": "1.8", "code": 18 },
  "com.alphaplay.app": { "version": "3.1", "code": 31 }
}
```

#### 2. Camada nativa (Kotlin)
- `getInstalledVersion(packageName)` em `MainActivity.kt` via `packageManager.getPackageInfo(pkg, 0).versionName`.
- Expor por `@JavascriptInterface` (`window.Android.getInstalledVersion`).
- UI nativa busca `versions.json` por HTTP, compara, e mostra badge laranja "⬆ ATUALIZAÇÃO" no canto do card + linha "Instalado: X | Novo: Y" no subtítulo.

#### 3. Camada Web (React)
- Hook `useVersions()` faz `fetch('/versions.json')` na inicialização.
- Cada card calcula: `idle | installed | update-available`.
- Visual:
  - **Não instalado**: botão "QUERO INSTALAR" (atual).
  - **Instalado/atualizado**: badge verde "✅ INSTALADO" + botão "ABRIR APP" (atual).
  - **Atualização disponível**: badge laranja "⬆ ATUALIZAÇÃO" + texto "Instalado: 2.1 → Novo: 2.4" + botão "ATUALIZAR APP".

#### 4. Layout responsivo
Todas as novas linhas de versão e badges seguem o padrão atual com **`aspect-ratio`, `max-width`, `max-height` e `clamp()`** para manter proporção em qualquer tela (celular, MiBox, MXQ, TV 4K).

#### 5. Fluxo de atualização
Botão "ATUALIZAR APP" reusa `startDownload()` — o PackageInstaller nativo trata como upgrade automaticamente quando o `packageName` é o mesmo e o `versionCode` é maior.

---

**Atenção**
- O `versions.json` precisa ser atualizado manualmente a cada APK novo.
- A versão instalada só é detectável na versão nativa (APK launcher). No navegador puro, só aparece a versão remota.
