// Copyright (c) 2026 MultiNiche AI. All rights reserved.
package com.multinicheai.heyterm

import kotlinx.coroutines.channels.Channel

/**
 * Static, always-there channel for typed requests from MainActivity's text
 * field into HeyTermService's loop -- same idea as LogBus (service ->
 * activity), just the opposite direction. Routing this through a plain
 * object instead of MainActivity's bound `service` reference means typing
 * a request the instant you tap Start Listening can't lose the request to
 * a bindService() race: the channel exists before the service does, and
 * the service always drains it once its loop starts, whether or not
 * MainActivity's bind has completed yet.
 */
object RequestBus {
    val channel = Channel<String>(Channel.UNLIMITED)

    fun submit(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        channel.trySend(trimmed)
    }
}
