## Bug

No Android, quando o botão **"Procurar atualizações"** está com foco (expandido com texto) e o usuário aperta a seta para a **direita** para ir em **"Configurações"** (engrenagem), o foco **pula** a engrenagem e cai direto num card de app embaixo. O vídeo confirma: em poucos frames a pílula colapsa e o foco aparece num card, sem nunca passar pela engrenagem.

## Causa

A barra superior usa `LayoutTransition` com animação `CHANGING` (250ms). Quando a pílula "Procurar atualizações" cresce/encolhe com texto, a engrenagem ainda está sendo animada para uma nova posição. Nesse meio-tempo, o algoritmo de **focus search** do Android usa retângulos desatualizados e às vezes não encontra a engrenagem à direita — então cai para o card mais próximo abaixo.

## Correção

Tornar a navegação por D-pad **determinística**, sem depender da posição animada. Em `buildTopBar` (MainActivity.kt, ~linhas 1400-1490):

1. Gerar IDs estáveis para as duas pílulas focáveis:
   ```kotlin
   system.id = View.generateViewId()
   settings.id = View.generateViewId()
   ```
2. Amarrar a navegação esquerda/direita explicitamente:
   ```kotlin
   system.nextFocusRightId = settings.id
   settings.nextFocusLeftId = system.id
   ```
3. Para a seta para baixo de ambas, apontar para o primeiro card (assim "baixo" sempre cai num card e nunca volta para outra pílula): definido em `buildRoot` depois que os cards são criados — `system.nextFocusDownId = cardViews[0].container.id` e idem para `settings`.

Resultado: pressionar **direita** em "Procurar atualizações" sempre leva para "Configurações", independente da animação. Pressionar **baixo** em qualquer pílula sempre leva para o primeiro card.

## Arquivo

Apenas `android/app/src/main/java/com/tvapps/launcher/MainActivity.kt` — ~8 linhas adicionadas em duas funções (`buildTopBar` e `buildRoot`). Nenhuma mudança visual, nenhuma mudança no preview web.