## Objetivo
Ocultar temporariamente o card do **UniTV** no launcher para você compilar o APK e validar o fluxo de atualização OTA.

## Mudança
Arquivo: `android/app/src/main/java/com/tvapps/launcher/AppCatalog.kt`

Comentar o bloco do `CatalogApp` do UniTV (linhas 14-21), mantendo Nexa TV e AlphaPlay visíveis. Como está comentado (não removido), basta descomentar depois para trazer de volta.

```kotlin
val apps: List<CatalogApp> = listOf(
    // CatalogApp(
    //     name = "UniTV",
    //     description = "Mais de 400 canais, filmes e séries",
    //     url = "...",
    //     icon = "▶",
    //     packageName = "com.unitv.app",
    //     iconRes = R.drawable.ic_unitv,
    // ),
    CatalogApp(name = "Nexa TV", ...),
    CatalogApp(name = "AlphaPlay", ...),
)
```

## Depois
1. Compile no Android Studio (Build APK)
2. Suba `app-release-latest.apk` + `update.json` no bucket `tvapps-updates`
3. No TV Box, abra o app — deve aparecer a tela de update; após atualizar, o card UniTV some
