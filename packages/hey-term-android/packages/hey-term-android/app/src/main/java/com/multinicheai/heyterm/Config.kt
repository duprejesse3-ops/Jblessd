// Copyright (c) 2026 MultiNiche AI. All rights reserved.
package com.multinicheai.heyterm

import android.content.Context
import android.content.SharedPreferences

/**
 * Settings, stored in a plain SharedPreferences file (not source -- the API
 * key is never compiled into the APK). First launch prompts for it via
 * MainActivity if it's missing. Mirrors the desktop/Termux versions'
 * lib/config.py, scoped to what this v1 of the app actually uses (English
 * only for now -- see README in this package for why).
 */
object Config {
    private const val PREFS = "hey_term_prefs"
    private const val KEY_API_KEY = "anthropic_api_key"
    private const val KEY_WAKE_WORD = "wake_word"

    const val ANTHROPIC_MODEL = "claude-sonnet-4-5"
    // Loosened from 0.72 -- real-world testing on-device showed the small,
    // fast on-device model mishearing "hey term" often enough (e.g. as
    // "it's arm") that the tighter threshold was rejecting genuine wake
    // attempts. The RMS silence gate (SILENCE_RMS_THRESHOLD, applied before
    // any audio reaches the model) is what actually guards against false
    // wakes from near-silence/hallucination, so loosening this fuzzy-match
    // threshold doesn't reopen that problem.
    const val WAKE_MATCH_THRESHOLD = 0.6
    const val SAMPLE_RATE = 16000
    const val WAKE_CHUNK_SECONDS = 2.5
    const val COMMAND_MAX_SECONDS = 12.0
    const val SILENCE_HOLD_SECONDS = 1.2
    const val SILENCE_RMS_THRESHOLD = 0.012
    const val COMMAND_TIMEOUT_SECONDS = 120L
    const val DEFAULT_WAKE_WORD = "hey term"

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun apiKey(context: Context): String = prefs(context).getString(KEY_API_KEY, "") ?: ""

    fun setApiKey(context: Context, key: String) {
        prefs(context).edit().putString(KEY_API_KEY, key.trim()).apply()
    }

    fun wakeWord(context: Context): String =
        prefs(context).getString(KEY_WAKE_WORD, DEFAULT_WAKE_WORD) ?: DEFAULT_WAKE_WORD

    // The app's own private, sandboxed workspace -- see BusyBoxShell's
    // module doc for why commands run here rather than against arbitrary
    // system paths (Android's own app-sandboxing rules, not a Hey Term
    // limitation). This is created under filesDir, which Android guarantees
    // this app can read/write/execute in, unlike shared storage.
    fun workDir(context: Context) = context.filesDir.resolve("workspace").apply { mkdirs() }

    fun auditLogPath(context: Context) = context.filesDir.resolve("hey-term-audit.jsonl")
}
