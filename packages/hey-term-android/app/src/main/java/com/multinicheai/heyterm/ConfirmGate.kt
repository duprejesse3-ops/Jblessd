// Copyright (c) 2026 MultiNiche AI. All rights reserved.
package com.multinicheai.heyterm

import kotlinx.coroutines.CompletableDeferred

enum class ConfirmOutcome { CONFIRM, CANCEL }

/**
 * Coordinates a pending confirmation between HeyTermService (which asks)
 * and whatever answers it:
 *  - a spoken-equivalent confirm/cancel notification tap, handled by
 *    ConfirmActionReceiver, for ordinary commands; or
 *  - typing the literal word CONFIRM into MainActivity's request field, for
 *    anything matching Safety.DANGEROUS_PATTERNS -- same "type it, don't
 *    just say/tap it" rule the desktop/Termux versions enforce for the
 *    same short list of genuinely destructive commands.
 * One pending confirmation at a time, matching the app's single active
 * request at a time (mirrors main.py's single-slot design).
 */
object ConfirmGate {
    @Volatile
    var requiresTypedConfirm: Boolean = false
        private set

    private var pending: CompletableDeferred<ConfirmOutcome>? = null

    fun open(typed: Boolean): CompletableDeferred<ConfirmOutcome> {
        requiresTypedConfirm = typed
        val deferred = CompletableDeferred<ConfirmOutcome>()
        pending = deferred
        return deferred
    }

    fun resolve(outcome: ConfirmOutcome) {
        pending?.complete(outcome)
        pending = null
        requiresTypedConfirm = false
    }

    /** Called with whatever the person typed into MainActivity's request
     * field while a typed confirmation is pending -- only the exact word
     * CONFIRM (case-sensitive, matching the desktop version) resolves it;
     * anything else is treated as a normal new typed request instead. */
    fun tryResolveTyped(text: String): Boolean {
        if (!requiresTypedConfirm) return false
        if (text.trim() == "CONFIRM") {
            resolve(ConfirmOutcome.CONFIRM)
            return true
        }
        return false
    }
}
