Diagnóstico: o `android:banner` já está configurado e os PNGs têm dimensões corretas (`320x180` e `640x360`). O motivo mais provável de ainda aparecer a arte antiga é que o app ainda mantém ícones adaptativos antigos em `mipmap-anydpi` e `mipmap-anydpi-v26`, e alguns launchers/áreas do Android TV usam `android:icon`/`roundIcon` em vez de `android:banner`. Além disso, o Android TV pode manter cache do launcher após atualização.

Plano de correção:

1. Substituir também o ícone oficial do app pela arte nova
   - Gerar `ic_launcher.png` e `ic_launcher_round.png` em todas as densidades `mipmap-*`.
   - Assim, quando o Mi Box usar ícone em vez de banner, aparecerá a identidade nova.

2. Remover os ícones adaptativos antigos que apontam para o play roxo
   - Remover `res/mipmap-anydpi/ic_launcher.xml` e `ic_launcher_round.xml`.
   - Remover `res/mipmap-anydpi-v26/ic_launcher.xml` e `ic_launcher_round.xml`.
   - Esses XMLs hoje têm prioridade em Android 8+ e podem sobrescrever os PNGs.

3. Manter o banner Android TV correto
   - Preservar `android:banner="@drawable/banner"` no `<application>` e na `<activity>`.
   - Manter `LEANBACK_LAUNCHER` no intent filter.
   - Manter os banners `drawable/banner.png` e `drawable-xhdpi/banner.png`.

4. Garantir instalação limpa no Mi Box
   - Depois de gerar o APK novo, desinstalar o app antigo no Mi Box antes de instalar novamente.
   - Se ainda aparecer cache antigo, limpar dados/cache do launcher Android TV ou reiniciar a TV Box.

Resultado esperado: no Leanback, o banner novo aparece onde o sistema usa banner; nas telas que usam ícone/app tile, a mesma identidade nova também aparece em vez do play roxo antigo.