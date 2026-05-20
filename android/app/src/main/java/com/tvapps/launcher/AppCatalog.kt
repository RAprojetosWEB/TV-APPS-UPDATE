package com.tvapps.launcher

data class AppEntry(
    val name: String,
    val description: String,
    val url: String,
    val packageHint: String,
)

object AppCatalog {
    val apps: List<AppEntry> = listOf(
        AppEntry(
            name = "UniTV",
            description = "Streaming de filmes e séries",
            url = "https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/unitv.apk",
            packageHint = "unitv",
        ),
        AppEntry(
            name = "Nexa TV",
            description = "Player de mídia universal",
            url = "https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/Nexa_TV.apk",
            packageHint = "nexa_tv",
        ),
        AppEntry(
            name = "AllApp",
            description = "Tudo em um só app",
            url = "https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/AllApp.apk",
            packageHint = "allapp",
        ),
    )
}