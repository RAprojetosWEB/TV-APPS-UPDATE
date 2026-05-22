## Problema

No `android/app/build.gradle.kts`, o bloco `buildTypes { release { signingConfig = signingConfigs.getByName("release") } }` está **antes** do bloco `signingConfigs { create("release") {...} }`. Gradle Kotlin DSL é avaliado de cima pra baixo, então no momento que ele lê a linha 44 o `release` ainda não foi criado → `SigningConfig with name 'release' not found`.

## Correção

Mover o bloco `signingConfigs { ... }` para **antes** do bloco `buildTypes { ... }` dentro de `android { ... }`. Sem nenhuma outra mudança (senhas, alias, keystore continuam iguais).

Estrutura final:

```text
android {
    namespace = ...
    compileSdk = 34
    defaultConfig { ... }

    signingConfigs {
        create("release") {
            storeFile = file("rastream.keystore")
            storePassword = "android"
            keyAlias = "androidkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(...)
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions { ... }
    kotlinOptions { ... }
    packaging { ... }
    applicationVariants.all { ... }
}
```

Depois: **File → Sync Project with Gradle Files** no Android Studio e rodar `Build → Build APK(s)` de novo.
