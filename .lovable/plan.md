## Plano

1. Você clica em **Publish → Update** (canto superior direito) para publicar a versão atual com debug.
2. Eu testo `/api/public/bump-version` com o token correto `tvapps_J3m3adVve_qr4Q5` e confirmo status **200**.
3. Removo o bloco de debug temporário em `src/routes/api/public/bump-version.ts` (volta ao 401 limpo).
4. Você clica em **Publish → Update** novamente para publicar a versão limpa.
5. Testo de novo para confirmar 200 com o token e 401 sem ele.