// Copyright (c) 2026 MultiNiche AI. All rights reserved.
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.multinicheai.heyterm"
    compileSdk = 34
    ndkVersion = "26.3.11579264"

    defaultConfig {
        applicationId = "com.multinicheai.heyterm"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        ndk {
            // arm64-v8a covers effectively every phone sold in the last several
            // years; armeabi-v7a added for older/budget devices. x86_64 (for
            // emulator testing) intentionally left out to keep the APK smaller
            // -- add it back if you ever need to test in an Android emulator.
            abiFilters += listOf("arm64-v8a", "armeabi-v7a")
        }

        externalNativeBuild {
            cmake {
                cppFlags += "-std=c++17"
                arguments += listOf("-DANDROID_STL=c++_shared")
            }
        }
    }

    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }

    // Debug builds normally get signed with a throwaway key that Gradle
    // auto-generates at ~/.android/debug.keystore -- fine on a laptop where
    // that file persists, but on a fresh GitHub Actions runner it gets
    // regenerated (with a different random key) on every single run. Since
    // Android refuses to install an "update" over an app signed with a
    // different key than what's already on the phone, every CI-built APK
    // failed to install over the last one with a bare "App not installed."
    // This keystore (debug-only, not for a real release) -- checked into
    // the repo base64-encoded as ../hey-term-debug.keystore.b64 and decoded
    // to this path by the CI workflow before Gradle runs, since GitHub's
    // web upload UI can't handle the raw binary file -- makes every CI
    // build share the same signing key, so future installs behave like
    // normal app updates. debug.keystore's own default alias/password
    // ("androiddebugkey"/"android") isn't required here -- these just need
    // to match what's set below and stay consistent build to build.
    signingConfigs {
        getByName("debug") {
            storeFile = file("../hey-term-debug.keystore")
            storePassword = "android"
            keyAlias = "heytermdebug"
            keyPassword = "android"
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        viewBinding = true
    }
    // BusyBox binaries (per-ABI, fetched/built by the CI workflow -- see
    // .github/workflows/build-hey-term-android.yml -- not checked into the
    // repo, both because they're binaries and because building them from
    // source at CI time, not vendoring a prebuilt someone else compiled, is
    // the same "build it, don't borrow it" rule the rest of Hey Term follows)
    // land in src/main/assets/busybox/<abi>/busybox before this runs.
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.lifecycle:lifecycle-service:2.8.4")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.activity:activity-ktx:1.9.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.json:json:20240303")
}
