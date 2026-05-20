package com.tvapps.launcher

data class CatalogApp(
    val name: String,
    val description: String,
    val url: String,
)

object AppCatalog {
    val apps: List<CatalogApp> = listOf(
        CatalogApp(
            name = "UniTV",
            description = "Streaming de filmes e séries",
            url = "https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/unitv.apk",
        ),
        CatalogApp(
            name = "Nexa TV",
            description = "Player de mídia universal",
            url = "https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/Nexa_TV.apk",
        ),
        CatalogApp(
            name = "AllApp",
            description = "Tudo em um só app",
            url = "https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/AllApp.apk",
        ),
    )
}