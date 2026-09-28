// Copyright (c) 2026 MultiNiche AI. All rights reserved.
package com.multinicheai.heyterm

/**
 * Port of lib/wake.py -- fuzzy, punctuation-insensitive wake-phrase
 * matching, since a short phrase transcribed from a noisy mic clip rarely
 * comes back as the exact string "hey term".
 */
object Wake {
    private fun normalize(text: String): String =
        text.lowercase().trim()
            .replace(Regex("[^a-z0-9 ]+"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()

    /** Levenshtein-based similarity ratio in [0, 1], matching Python's
     * difflib.SequenceMatcher.ratio() closely enough for this use (short
     * phrases, approximate matching, not byte-identical semantics). */
    private fun similarity(a: String, b: String): Double {
        if (a.isEmpty() && b.isEmpty()) return 1.0
        val dist = levenshtein(a, b)
        val maxLen = maxOf(a.length, b.length)
        if (maxLen == 0) return 1.0
        return 1.0 - dist.toDouble() / maxLen
    }

    private fun levenshtein(a: String, b: String): Int {
        val dp = Array(a.length + 1) { IntArray(b.length + 1) }
        for (i in 0..a.length) dp[i][0] = i
        for (j in 0..b.length) dp[0][j] = j
        for (i in 1..a.length) {
            for (j in 1..b.length) {
                dp[i][j] = if (a[i - 1] == b[j - 1]) {
                    dp[i - 1][j - 1]
                } else {
                    1 + minOf(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
                }
            }
        }
        return dp[a.length][b.length]
    }

    fun heardWakeWord(
        transcript: String,
        wakeWord: String,
        threshold: Double = Config.WAKE_MATCH_THRESHOLD,
    ): Boolean {
        val wake = normalize(wakeWord)
        val norm = normalize(transcript)
        if (wake.isEmpty() || norm.isEmpty()) return false
        if (norm.contains(wake)) return true

        val words = norm.split(" ")
        val wakeLen = wake.split(" ").size
        var best = 0.0
        val upper = maxOf(1, words.size - wakeLen + 1)
        for (i in 0 until upper) {
            val window = words.subList(i, minOf(i + wakeLen, words.size)).joinToString(" ")
            best = maxOf(best, similarity(window, wake))
        }
        return best >= threshold
    }
}
