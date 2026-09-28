// Copyright (c) 2026 MultiNiche AI. All rights reserved.
package com.multinicheai.heyterm

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import android.os.Binder
import android.os.IBinder

/**
 * The main loop, ported from main.py's `while True` in a foreground
 * service so it keeps listening while the app is backgrounded (the whole
 * point of a "full APK version" over opening a terminal window and running
 * a script by hand). English-only in this v1 -- see this package's README
 * for why -- so this is a simplified port of main.py, not a byte-for-byte
 * one: no jobs/cost/revert meta-commands or multi-language i18n yet,
 * everything that actually defines Hey Term (wake -> plan -> confirm ->
 * run -> speak, with the same safety gate and audit log) is here.
 */
class HeyTermService : Service() {
    private val scope = CoroutineScope(Dispatchers.IO + Job())
    private var loopJob: Job? = null

    private lateinit var audio: AudioCapture
    private lateinit var shell: DeviceShell
    private lateinit var tts: Tts

    private val history = mutableListOf<Pair<String, String>>()
    private var running = false

    inner class LocalBinder : Binder() {
        fun service(): HeyTermService = this@HeyTermService
    }
    private val binder = LocalBinder()
    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        audio = AudioCapture(this)
        shell = DeviceShell(this)
        tts = Tts(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIF_ID, buildNotification(getString(R.string.notif_listening)))
        if (loopJob == null) {
            running = true
            // Loaded on the service's own IO-dispatcher coroutine, not here
            // on the main thread -- copying the ~140MB model asset and
            // running nativeInit can take a couple of seconds, which would
            // otherwise risk an ANR on this callback.
            loopJob = scope.launch {
                val loaded = WhisperBridge.ensureLoaded(this@HeyTermService)
                log(if (loaded) "[Hey Term] Speech model loaded." else "[Hey Term] Speech model FAILED to load: ${WhisperBridge.lastError}")
                runLoop()
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        loopJob?.cancel()
        tts.shutdown()
        super.onDestroy()
    }

    private fun log(line: String) {
        LogBus.emit(line)
    }

    private suspend fun runLoop() {
        val apiKey = Config.apiKey(this)
        if (apiKey.isBlank()) {
            log("[Hey Term] No Anthropic API key set yet -- open the app and add one before speaking a request.")
        }
        log("Hey Term (Android) -- listening for \"${Config.wakeWord(this)}\"…")

        var chunkCount = 0
        while (running) {
            val typed = RequestBus.channel.tryReceive().getOrNull()
            if (typed != null) {
                if (ConfirmGate.tryResolveTyped(typed)) continue // it was a typed CONFIRM, not a new request
                log("[you] $typed")
                AuditLog.log(this, "wake", mapOf("via" to "typed"))
                handleRequest(typed)
                continue
            }

            val clip = audio.recordFixed(Config.WAKE_CHUNK_SECONDS)
            val heard = WhisperBridge.transcribe(clip, "en")
            if (heard.isNotEmpty()) log("[heard] $heard")

            // Temporary diagnostic -- prints every ~10s so we can tell, from
            // the on-screen log alone (no ADB needed), whether the mic is
            // capturing real audio (rms above the silence gate) and whether
            // the model loaded, rather than guessing why nothing transcribes.
            chunkCount++
            if (chunkCount % 4 == 0) {
                log("[debug] clip samples=${clip.size} rms=${"%.4f".format(WhisperBridge.rms(clip))} (gate=${Config.SILENCE_RMS_THRESHOLD}) modelLoaded=${WhisperBridge.isLoaded()}")
            }

            if (Wake.heardWakeWord(heard, Config.wakeWord(this))) {
                AuditLog.log(this, "wake", mapOf("via" to "voice"))
                updateNotification("Listening…")
                val commandClip = audio.recordUntilSilence(Config.COMMAND_MAX_SECONDS)
                val requestText = WhisperBridge.transcribe(commandClip, "en")
                if (requestText.isNotEmpty()) log("[you] $requestText")
                handleRequest(requestText)
                updateNotification(getString(R.string.notif_listening))
            }
        }
    }

    private suspend fun handleRequest(requestText: String) {
        if (requestText.isBlank()) {
            tts.speak("I didn't catch that.")
            AuditLog.log(this, "request", mapOf("text" to "", "outcome" to "empty"))
            return
        }

        val normalized = requestText.lowercase().trim(' ', '.', '!', '?')
        if (normalized == "stop listening" || normalized == "stop" || normalized == "goodbye") {
            tts.speak("Stopping.")
            AuditLog.log(this, "request", mapOf("text" to requestText, "outcome" to "stop_phrase"))
            history.clear()
            return
        }

        val apiKey = Config.apiKey(this)
        AuditLog.log(this, "request", mapOf("text" to requestText))

        val plan = try {
            ClaudeClient.plan(apiKey, requestText, history).also {
                history.add("user" to requestText)
                if (it is Plan.Run) history.add("assistant" to "${it.summary} :: ${it.commands}")
                if (it is Plan.Clarify) history.add("assistant" to it.question)
                while (history.size > MAX_HISTORY) history.removeAt(0)
            }
        } catch (e: AgentException) {
            log("[error] ${e.message}")
            AuditLog.log(this, "plan_error", mapOf("error" to e.message))
            tts.speak("Sorry, I couldn't reach Claude to plan that.")
            return
        }

        when (plan) {
            is Plan.Clarify -> {
                tts.speak(plan.question)
                AuditLog.log(this, "clarify", mapOf("question" to plan.question))
            }
            is Plan.Run -> runPlan(plan)
        }
    }

    private suspend fun runPlan(plan: Plan.Run) {
        AuditLog.log(this, "plan", mapOf("summary" to plan.summary, "commands" to plan.commands.toString()))
        val risky = Safety.dangerousCommands(plan.commands)

        val confirmed: Boolean
        if (risky.isNotEmpty()) {
            tts.speak("${plan.summary} This includes a command that needs typed confirmation in the app.")
            for (cmd in plan.commands) {
                val flag = if (cmd in risky) "  [REQUIRES TYPED CONFIRM]" else ""
                log("    $ $cmd$flag")
            }
            updateNotification("Type CONFIRM in the app to run this")
            val deferred = ConfirmGate.open(typed = true)
            val outcome = withTimeoutOrNull(120_000) { deferred.await() }
            confirmed = outcome == ConfirmOutcome.CONFIRM
            AuditLog.log(this, "confirmation", mapOf("method" to "typed", "commands" to plan.commands.toString(),
                "dangerous" to risky.toString(), "outcome" to if (confirmed) "confirm" else "cancel"))
        } else {
            tts.speak("${plan.summary} Say or tap confirm to run it.")
            for (cmd in plan.commands) log("    $ $cmd")
            postConfirmNotification(plan.summary)
            val deferred = ConfirmGate.open(typed = false)
            val outcome = withTimeoutOrNull(60_000) { deferred.await() }
            confirmed = outcome == ConfirmOutcome.CONFIRM
            AuditLog.log(this, "confirmation", mapOf("method" to "notification", "commands" to plan.commands.toString(),
                "outcome" to if (confirmed) "confirm" else "cancel"))
        }

        if (!confirmed) {
            tts.speak("Canceled.")
            return
        }

        val results = plan.commands.map { shell.run(it) }
        for (r in results) {
            log("    $ ${r.command}  -> exit ${r.exitCode}")
            if (r.stdout.isNotBlank()) log(r.stdout.trimEnd())
            if (r.stderr.isNotBlank()) log("[stderr] ${r.stderr.trimEnd()}")
            if (r.error != null) log("[error] ${r.error}")
        }
        AuditLog.log(this, "run", mapOf(
            "ok" to results.all { it.ran && it.exitCode == 0 },
            "results" to results.map { mapOf("command" to it.command, "exitCode" to it.exitCode, "ran" to it.ran, "error" to it.error) }.toString(),
        ))

        val okCount = results.count { it.ran && it.exitCode == 0 }
        tts.speak(if (okCount == results.size) "Done." else "Ran with $${results.size - okCount} error(s).")
    }

    private fun postConfirmNotification(summary: String) {
        val confirmIntent = PendingIntent.getBroadcast(
            this, 0, Intent(this, ConfirmActionReceiver::class.java).setAction(ConfirmActionReceiver.ACTION_CONFIRM),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val cancelIntent = PendingIntent.getBroadcast(
            this, 1, Intent(this, ConfirmActionReceiver::class.java).setAction(ConfirmActionReceiver.ACTION_CANCEL),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, HeyTermApp.NOTIF_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle(getString(R.string.notif_confirm_title))
            .setContentText(summary)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .addAction(0, getString(R.string.action_confirm), confirmIntent)
            .addAction(0, getString(R.string.action_cancel), cancelIntent)
            .setOngoing(true)
            .build()
        (getSystemService(NOTIFICATION_SERVICE) as android.app.NotificationManager).notify(NOTIF_ID, notification)
    }

    private fun updateNotification(text: String) {
        (getSystemService(NOTIFICATION_SERVICE) as android.app.NotificationManager)
            .notify(NOTIF_ID, buildNotification(text))
    }

    private fun buildNotification(text: String): Notification =
        NotificationCompat.Builder(this, HeyTermApp.NOTIF_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(text)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

    companion object {
        private const val NOTIF_ID = 42
        private const val MAX_HISTORY = 12
    }
}
