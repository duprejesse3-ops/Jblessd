// Copyright (c) 2026 MultiNiche AI. All rights reserved.
package com.multinicheai.heyterm

/**
 * Port of the desktop/Termux versions' lib/safety.py + lib/config.py's
 * DANGEROUS_PATTERNS. Kept short and specific on purpose -- see the Python
 * original's comment: this catches the handful of commands that can nuke an
 * entire filesystem or OS install, not a general security boundary.
 */
object Safety {
    val DANGEROUS_PATTERNS = listOf(
        "rm -rf /",
        "rm -rf ~",
        "rm -rf .",
        "rm -rf *",
        ":(){ :|:& };:",
        "mkfs",
        "dd if=",
        "> /dev/sd",
        "format c:",
        "diskpart",
        "shutdown",
        "reboot",
        "del /f /s /q",
        "git push --force",
        "git reset --hard",
        "drop database",
        "drop table",
        "truncate table",
    )

    /** Commands (case-insensitive substring match) that require typed
     * CONFIRM in the app rather than a spoken/notification-tap confirm. */
    fun dangerousCommands(commands: List<String>): List<String> {
        val lowered = DANGEROUS_PATTERNS.map { it.lowercase() }
        return commands.filter { cmd ->
            val c = cmd.lowercase()
            lowered.any { pattern -> c.contains(pattern) }
        }
    }
}
