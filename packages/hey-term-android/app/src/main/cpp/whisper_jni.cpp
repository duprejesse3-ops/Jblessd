// Copyright (c) 2026 MultiNiche AI. All rights reserved.
//
// Thin JNI wrapper around whisper.cpp's public C API (whisper.h). Mirrors
// what lib/termux_audio.py's transcribe_termux() does by shelling out to
// whisper-cli/whisper-server -- same whisper_full() call, same parameters
// (no timestamps, suppress non-speech tokens, explicit language) -- just
// called directly in-process instead of via a subprocess or HTTP request.
#include <jni.h>
#include <android/log.h>
#include <algorithm>
#include <string>
#include <thread>
#include <vector>

#include "whisper.h"

#define LOG_TAG "HeyTermWhisper"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

extern "C" JNIEXPORT jlong JNICALL
Java_com_multinicheai_heyterm_WhisperBridge_nativeInit(
    JNIEnv *env, jobject /* this */, jstring modelPath, jint threads) {
    const char *path = env->GetStringUTFChars(modelPath, nullptr);

    struct whisper_context_params cparams = whisper_context_default_params();
    cparams.use_gpu = false; // CPU-only -- consistent across every phone, no GPU driver variance to debug

    struct whisper_context *ctx = whisper_init_from_file_with_params(path, cparams);
    env->ReleaseStringUTFChars(modelPath, path);

    if (ctx == nullptr) {
        LOGE("whisper_init_from_file_with_params failed");
        return 0;
    }
    LOGI("whisper context initialized (threads=%d)", threads);
    return reinterpret_cast<jlong>(ctx);
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_multinicheai_heyterm_WhisperBridge_nativeTranscribe(
    JNIEnv *env, jobject /* this */, jlong contextPtr, jfloatArray audio, jstring language) {
    auto *ctx = reinterpret_cast<struct whisper_context *>(contextPtr);
    if (ctx == nullptr) return env->NewStringUTF("");

    jsize numSamples = env->GetArrayLength(audio);
    if (numSamples <= 0) return env->NewStringUTF("");

    std::vector<float> samples(numSamples);
    env->GetFloatArrayRegion(audio, 0, numSamples, samples.data());

    const char *lang = env->GetStringUTFChars(language, nullptr);

    struct whisper_full_params wparams = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    wparams.print_progress = false;
    wparams.print_special = false;
    wparams.print_realtime = false;
    wparams.print_timestamps = false;
    wparams.no_timestamps = true;
    wparams.suppress_nst = true; // suppress non-speech tokens -- same hallucination guard the Termux CLI path uses
    wparams.language = lang;
    wparams.n_threads = std::max(2, (int) std::thread::hardware_concurrency() - 1);
    wparams.translate = false;
    wparams.single_segment = false;

    int rc = whisper_full(ctx, wparams, samples.data(), (int) samples.size());
    env->ReleaseStringUTFChars(language, lang);

    if (rc != 0) {
        LOGE("whisper_full failed (%d)", rc);
        return env->NewStringUTF("");
    }

    std::string result;
    const int n_segments = whisper_full_n_segments(ctx);
    for (int i = 0; i < n_segments; ++i) {
        const char *text = whisper_full_get_segment_text(ctx, i);
        if (text != nullptr) {
            if (!result.empty()) result += " ";
            result += text;
        }
    }
    return env->NewStringUTF(result.c_str());
}

extern "C" JNIEXPORT void JNICALL
Java_com_multinicheai_heyterm_WhisperBridge_nativeFree(
    JNIEnv *env, jobject /* this */, jlong contextPtr) {
    auto *ctx = reinterpret_cast<struct whisper_context *>(contextPtr);
    if (ctx != nullptr) whisper_free(ctx);
}
