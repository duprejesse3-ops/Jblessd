// Copyright (c) 2026 MultiNiche AI. All rights reserved.
package com.multinicheai.heyterm

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.Locale
import java.util.UUID
import kotlin.coroutines.resume

/**
 * Android's own system TextToSpeech engine -- the direct in-process
 * equivalent of the Termux version's termux-tts-speak shell-out, minus the
 * subprocess (a real app talks to Android's TTS APIs directly). speak() is
 * a suspend function that returns only once playback finishes, matching
 * the desktop/Termux versions' speak() being a blocking call in their
 * synchronous main loop.
 */
class Tts(context: Context) {
    private var engine: TextToSpeech? = null
    private var ready = false

    init {
        engine = TextToSpeech(context.applicationContext) { status ->
            ready = status == TextToSpeech.SUCCESS
            if (ready) engine?.language = Locale.US
        }
    }

    suspend fun speak(text: String) {
        if (text.isBlank()) return
        val e = engine ?: return
        if (!ready) return

        suspendCancellableCoroutine<Unit> { cont ->
            val utteranceId = UUID.randomUUID().toString()
            e.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(id: String?) {}
                override fun onDone(id: String?) {
                    if (id == utteranceId && cont.isActive) cont.resume(Unit)
                }
                @Deprecated("Deprecated in Java")
                override fun onError(id: String?) {
                    if (id == utteranceId && cont.isActive) cont.resume(Unit)
                }
            })
            val result = e.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
            if (result != TextToSpeech.SUCCESS && cont.isActive) cont.resume(Unit)
        }
    }

    fun shutdown() {
        engine?.stop()
        engine?.shutdown()
    }
}
