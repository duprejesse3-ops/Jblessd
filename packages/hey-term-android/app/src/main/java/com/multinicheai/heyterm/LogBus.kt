// Copyright (c) 2026 MultiNiche AI. All rights reserved.
package com.multinicheai.heyterm

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * In-process event bus from HeyTermService (the actual wake/listen/plan/
 * confirm/execute loop, running in a foreground service so it survives
 * MainActivity being backgrounded) to whatever's currently showing the log
 * -- MainActivity's scrolling TextView is the print() statements' Android
 * equivalent. Replay-buffered so a freshly (re)opened activity sees recent
 * lines instead of starting blank.
 */
object LogBus {
    private val _lines = MutableSharedFlow<String>(replay = 200, extraBufferCapacity = 64)
    val lines: SharedFlow<String> = _lines.asSharedFlow()

    fun emit(line: String) {
        _lines.tryEmit(line)
    }
}
