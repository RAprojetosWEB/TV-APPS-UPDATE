## Problema

No painel admin, ao clicar em **Upload direto**, o popover abre mas os campos "Escolher arquivo" (APK e update.json) não respondem ao clique — não abre o seletor de arquivos nativo.

## Causa provável

O popover do `RawUploadButton` é renderizado como `<div absolute z-20>` *dentro* do cabeçalho da seção OTA. Quando o formulário **"Publicar nova versão"** está aberto ao mesmo tempo (que é o caso no print), os elementos do formulário (inputs, textarea, file input) ficam abaixo no DOM e em alguns navegadores acabam capturando o clique do `<input type="file">` do popover, porque o popover não está renderizado em portal — vive no mesmo stacking context da página e o native file-picker depende de um clique limpo no elemento.

Sintoma típico: visualmente o popover aparece por cima, mas a área dos `<input type="file">` é "atravessada" pelo formulário que está logo abaixo.

## Solução

Trocar o popover ad-hoc por um **Dialog do shadcn** (`@/components/ui/dialog`), que é renderizado num **Portal** no topo do `<body>` com z-index alto e backdrop modal. Assim:

1. Não há disputa de z-index com o formulário "Publicar nova versão".
2. Cliques no `<input type="file">` chegam limpos ao navegador → o picker abre.
3. Como bônus, fica visualmente consistente com os outros modais do admin.

### Alterações em `src/routes/admin.tsx`

- Reescrever apenas o componente `RawUploadButton`:
  - Botão "Upload direto" continua igual (estilo `border border-white/15 bg-white/5 …`).
  - Em vez de `<div className="absolute …">` controlado por `open`, usar `<Dialog open={open} onOpenChange={setOpen}>` com `<DialogContent>` contendo:
    - Título "Upload direto (sem form)"
    - Descrição curta atual
    - Dois `<input type="file">` (APK e update.json), com `<label>` claros — manter o styling escuro do tema mas com um botão custom "Escolher APK" / "Escolher update.json" usando `<label htmlFor>` + input escondido para garantir clique consistente
    - Mostrar nome do arquivo selecionado ao lado
    - Botões "Fechar" e "Enviar" no rodapé (`DialogFooter`)
  - Comportamento: ao clicar "Enviar", chama `onUpload(apk, json)`, limpa estado e fecha o dialog (igual ao atual).
- Nada muda no `handleRawUpload` nem nas server functions `uploadLauncherApk` / `uploadLauncherRaw`.

### Observações

- Sem mexer em código de backend / migrations / OTA.
- Sem mexer no APK (não precisa recompilar nada Android).
- Mudança puramente de UI no admin.

## Resultado esperado

Clicar em **Upload direto** abre um modal sobreposto e os botões "Escolher APK" / "Escolher update.json" abrem o seletor de arquivos normalmente, independentemente do formulário "Publicar nova versão" estar aberto ou não.
