Vou corrigir a rolagem dos cards no launcher Android nativo, porque hoje a tela principal usa apenas um `LinearLayout` horizontal. Quando há mais de 4 cards, os cards extras ficam fora da tela, mas o container não é rolável.

Plano:

1. Trocar a linha de cards por um container rolável horizontal
   - Envolver o `LinearLayout` dos cards em um `HorizontalScrollView`.
   - Manter o `LinearLayout` interno para preservar o layout atual dos cards.
   - Desabilitar barra visual de scroll para manter aparência de TV.

2. Fazer a rolagem acompanhar o foco do controle remoto
   - Ao mover para direita/esquerda, quando o foco mudar de card, centralizar automaticamente o card focado dentro da tela.
   - Isso garante que o 5º card em diante apareça ao navegar com o controle.

3. Preservar a navegação atual
   - Manter a lógica que pula cards bloqueados.
   - Manter a navegação circular esquerda/direita.
   - Manter foco inicial no primeiro card disponível.

4. Gerar nova versão OTA
   - Incrementar `android/version.properties` novamente, pois a correção é no APK nativo.

Arquivos previstos:
- `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt`
- `android/version.properties`

Resultado esperado: com 5 ou mais cards, o usuário navega pelo controle remoto e a lista rola automaticamente para revelar os cards fora da tela.