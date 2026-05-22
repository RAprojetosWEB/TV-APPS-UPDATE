Plano para corrigir o ícone cortado:

1. Gerar novamente os ícones `ic_launcher` e `ic_launcher_round` em todos os tamanhos Android, usando a imagem enviada como base, mas com margem interna/safe area para evitar corte em launchers comuns.

2. Restaurar suporte moderno de ícone adaptativo para Android 8+, criando os recursos `mipmap-anydpi-v26/ic_launcher.xml` e `ic_launcher_round.xml` com foreground/background adequados, em vez de depender só de PNG quadrado.

3. Manter o banner Leanback separado (`@drawable/banner`) para Android TV, sem mexer no layout do app nem nas funções de download.

4. Verificar as dimensões finais dos assets gerados para confirmar que cada densidade ficou correta e que o logo não encosta nas bordas.