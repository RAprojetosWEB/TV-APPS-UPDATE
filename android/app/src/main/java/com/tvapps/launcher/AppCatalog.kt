package com.tvapps.launcher

data class CatalogApp(
    val name: String,
    val description: String,
    val url: String,
    val icon: String,
    val packageName: String,
    val iconRes: Int,
)

object AppCatalog {
    val apps: List<CatalogApp> = listOf(
        CatalogApp(
            name = "UniTV",
            description = "Mais de 400 canais, filmes e séries",
            url = "https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/unitv.apk",
            icon = "▶",
            packageName = "com.unitv.app",
            iconRes = R.drawable.ic_unitv,
        ),
        CatalogApp(
            name = "Nexa TV",
            description = "Mais de 300 canais",
            url = "https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/Nexa_TV.apk",
            icon = "📺",
            packageName = "com.nexa.tv",
            iconRes = R.drawable.ic_nexa,
        ),
        CatalogApp(
            name = "AlphaPlay",
            description = "Mais de 300 canais, filmes e séries",
            url = "https://firebasestorage.googleapis.com/v0/b/update-41ccf.appspot.com/o/alphaplay.apk?alt=media&token=cdbe4055-ea90-4f2c-a540-1b458159ade6",
            icon = "⬇",
            packageName = "com.alphaplay.app",
            iconRes = R.drawable.ic_alphaplay,
        ),
    )
}