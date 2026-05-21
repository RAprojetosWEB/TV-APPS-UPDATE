package com.tvapps.launcher

data class CatalogApp(
    val name: String,
    val description: String,
    val url: String,
    val icon: String,
    val packageName: String,
)

object AppCatalog {
    val apps: List<CatalogApp> = listOf(
        CatalogApp(
            name = "UniTV",
            description = "Streaming de filmes e séries",
            url = "https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/unitv.apk",
            icon = "▶",
            packageName = "com.unitv.app", // Substitua pelo package name real
        ),
        CatalogApp(
            name = "Nexa TV",
            description = "Player de mídia universal",
            url = "https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/Nexa_TV.apk",
            icon = "📺",
            packageName = "com.nexa.tv", // Substitua pelo package name real
        ),
        CatalogApp(
            name = "ALPHAPLAY",
            description = "Tudo em um só app",
            url = "https://firebasestorage.googleapis.com/v0/b/update-41ccf.appspot.com/o/alphaplay.apk?alt=media&token=cdbe4055-ea90-4f2c-a540-1b458159ade6",
            icon = "⬇",
            packageName = "com.alphaplay.app", // Substitua pelo package name real
        ),
    )
}