## Backup completo (admin)

Adicionar um botão **"Baixar backup completo"** no painel admin, na seção do OTA do launcher, que gera e baixa um arquivo `.zip` com tudo que importa do projeto.

### O que entra no zip

```
backup-YYYY-MM-DD-HHMM.zip
├── README.txt                        # explica o que é cada arquivo
├── db/
│   ├── apps.json                     # tabela apps (catálogo)
│   ├── app_versions.json             # tabela app_versions (histórico OTA)
│   └── app_settings.json             # tabela app_settings (senha do launcher etc.)
├── storage/
│   ├── tvapps-updates/
│   │   ├── app-release-latest.apk    # APK atual do launcher
│   │   ├── update.json               # manifest OTA atual
│   │   └── releases/...              # APKs antigos, se existirem
│   └── app-icons/
│       └── ...                       # ícones dos apps do catálogo
└── manifest.json                     # versão do backup, data, contagens
```

Não entram: arquivos do projeto (código), usuários do Lovable Cloud Auth (gerenciados pela plataforma), nem segredos.

### Como funciona

1. **Server function `createBackup`** (`src/lib/admin.functions.ts`):
   - Protegida por `requireSupabaseAuth` + checagem de role `admin`.
   - Lê com `supabaseAdmin`:
     - tudo de `apps`, `app_versions`, `app_settings`
     - lista todos os arquivos dos buckets `tvapps-updates` e `app-icons`
   - Para cada arquivo, baixa o conteúdo (`.download()`).
   - Monta o zip em memória com **fflate** (puro JS, roda em Cloudflare Worker).
   - Retorna o zip como `Uint8Array` (base64) + nome do arquivo.

2. **Botão no admin** (`src/routes/admin.tsx`):
   - Novo botão "Baixar backup completo" ao lado de "Upload direto".
   - Ao clicar: chama `createBackup`, recebe base64, transforma em `Blob`, dispara download no navegador.
   - Mostra estado "Gerando backup..." enquanto roda (pode demorar alguns segundos se houver vários APKs).

3. **Dependência nova**: `fflate` (~30kb, sem deps nativas, compatível com Worker).

### O que NÃO faço agora (e por quê)

- **Restore (importar backup)**: é o dobro de trabalho e precisa de cuidado pra não sobrescrever dados sem querer. Se quiser, faço numa próxima etapa.
- **Backup automático agendado**: também pode vir depois (cron).
- **Backup do código-fonte**: já fica no histórico do Lovable / GitHub.

### Resultado esperado

No admin, um clique baixa um `.zip` com banco + storage. Você guarda esse arquivo em qualquer lugar (Drive, HD externo) e tem como reconstruir o catálogo + OTA se algo der errado.

Confirma que quer só o **download** por enquanto (sem importar/restaurar)?