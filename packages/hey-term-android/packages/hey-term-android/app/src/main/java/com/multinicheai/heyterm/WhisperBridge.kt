// Copyright (c) 2026 MultiNiche AI. All rights reserved.
package com.multinicheai.heyterm

import android.content.Context
import java.io.File
import java.io.FileOutputStream

/**
 * JNI bridge to whisper.cpp (app/src/main/cpp/whisper_jni.cpp), compiled
 * directly into this app as a native library -- unlike the Termux version,
 * which shells out to a separate whisper-cli/whisper-server process, this
 * runs in-process: no subprocess, no per-call model reload, no HTTP hop.
 * The model loads once (see init()) and stays resident in native memory
 * for the life of the app process.
 *
 * Same real, self-built, MIT-licensed whisper.cpp
 * (https://github.com/ggml-org/whisper.cpp) as the Termux version -- one
 * engine, two integration styles, because a linked-in library is the right
 * shape for an app process and a standalone binary was the right shape for
 * a Termux shell session.
 */
object WhisperBridge {
    init {
        System.loadLibrary("heyterm_whisper")
    }

    private external fun nativeInit(modelPath: String, threads: Int): Long
    private external fun nativeTranscribe(contextPtr: Long, audio: FloatArray, language: String): String
    private external fun nativeFree(contextPtr: Long)

    private var contextPtr: Long = 0L
    private val lock = Any()

    /** Last failure reason from ensureLoaded(), for the caller to log --
     * "" when the model is loaded or ensureLoaded() hasn't been tried yet. */
    var lastError: String = ""
        private set

    /** Copies the bundled ggml model from assets to internal storage (once)
     * and loads it into native memory. Safe to call more than once -- a
     * no-op after the first successful call. Returns false if the model
     * asset is missing or the native context fails to initialize; check
     * lastError for why. */
    fun ensureLoaded(context: Context): Boolean = synchronized(lock) {
        if (contextPtr != 0L) return true

        val modelFile = File(context.filesDir, "ggml-base.bin")
        if (!modelFile.exists() || modelFile.length() == 0L) {
            try {
                context.assets.open("models/ggml-base.bin").use { input ->
                    FileOutputStream(modelFile).use { output -> input.copyTo(output) }
                }
            } catch (e: Exception) {
                lastError = "couldn't copy model asset: ${e.message}"
                return false
            }
        }

        val threads = maxOf(2, Runtime.getRuntime().availableProcessors() - 1)
        contextPtr = try {
            nativeInit(modelFile.absolutePath, threads)
        } catch (e: Throwable) {
            lastError = "nativeInit threw: ${e.message}"
            return false
        }
        if (contextPtr == 0L) {
            lastError = "nativeInit returned null (model file ${modelFile.length()} bytes at ${modelFile.absolutePath})"
            return false
        }
        lastError = ""
        return true
    }

    /** Transcribes a float32 [-1, 1] mono PCM clip at Config.SAMPLE_RATE.
     * Returns "" for empty/near-silent audio (see the RMS gate below --
     * same false-wake hallucination guard as the Termux version needed,
     * whisper.cpp has no VAD of its own on either platform), or if the
     * model hasn't loaded yet. `language` is a plain Whisper code ("en",
     * "auto", ...). Never throws. */
    fun transcribe(audio: FloatArray, language: String = "en"): String {
        if (audio.isEmpty()) return ""
        if (rms(audio) < Config.SILENCE_RMS_THRESHOLD) return ""

        val ptr = synchronized(lock) { contextPtr }
        if (ptr == 0L) return ""
        return try {
            nativeTranscribe(ptr, audio, language).trim()
        } catch (e: Exception) {
            ""
        }
    }

    /** True once ensureLoaded() has successfully initialized the native
     * whisper context. Diagnostic helper -- lets the on-screen log confirm
     * whether the model actually loaded without needing ADB. */
    fun isLoaded(): Boolean = synchronized(lock) { contextPtr != 0L }

    /** Root-mean-square amplitude of a float32 [-1, 1] PCM clip, exposed so
     * callers can log it against Config.SILENCE_RMS_THRESHOLD for
     * diagnostics (same formula transcribe() gates on internally). */
    fun rms(audio: FloatArray): Double {
        if (audio.isEmpty()) return 0.0
        return kotlin.math.sqrt(audio.sumOf { (it * it).toDouble() } / audio.size)
    }
}
