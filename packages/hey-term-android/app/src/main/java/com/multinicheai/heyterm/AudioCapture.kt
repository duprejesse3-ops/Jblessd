// Copyright (c) 2026 MultiNiche AI. All rights reserved.
package com.multinicheai.heyterm

import android.Manifest
import android.content.pm.PackageManager
import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import androidx.core.content.ContextCompat
import kotlin.math.sqrt

/**
 * Direct microphone capture via AudioRecord -- no subprocess/bridge needed
 * here (that was only ever a Termux limitation; a real installed app has
 * normal Android mic APIs). Records into a float32 PCM array at
 * Config.SAMPLE_RATE, mono -- the same shape lib/audio.py's desktop
 * capture hands to transcription, so WhisperBridge doesn't need to care
 * which platform it came from.
 */
class AudioCapture(private val context: Context) {
    private val minBufSamples = maxOf(
        AudioRecord.getMinBufferSize(
            Config.SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT
        ) / 2,
        Config.SAMPLE_RATE / 2, // at least 0.5s worth, defensively
    )

    private fun hasMicPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED

    private fun newRecorder(): AudioRecord = AudioRecord(
        MediaRecorder.AudioSource.VOICE_RECOGNITION,
        Config.SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
        minBufSamples * 2,
    )

    /** Records a fixed-length clip. Returns an empty array if mic
     * permission isn't granted or the recorder fails to initialize --
     * never throws, matching the desktop/Termux capture functions'
     * "no audio" contract. */
    fun recordFixed(seconds: Double): FloatArray {
        if (!hasMicPermission()) return FloatArray(0)
        val totalSamples = (seconds * Config.SAMPLE_RATE).toInt()
        val recorder = newRecorder()
        if (recorder.state != AudioRecord.STATE_INITIALIZED) {
            recorder.release()
            return FloatArray(0)
        }
        val out = ShortArray(totalSamples)
        try {
            recorder.startRecording()
            var read = 0
            while (read < totalSamples) {
                val n = recorder.read(out, read, totalSamples - read)
                if (n <= 0) break
                read += n
            }
            recorder.stop()
        } finally {
            recorder.release()
        }
        return shortsToFloats(out)
    }

    /** Records until Config.SILENCE_HOLD_SECONDS of trailing silence (RMS
     * below Config.SILENCE_RMS_THRESHOLD) after speech has been heard, or
     * maxSeconds elapses -- port of lib/audio.py's record_until_silence,
     * now with real block-by-block streaming (Termux's chunked
     * approximation was a workaround for termux-microphone-record having
     * no streaming mode; a direct AudioRecord stream doesn't need it). */
    fun recordUntilSilence(maxSeconds: Double): FloatArray {
        if (!hasMicPermission()) return FloatArray(0)
        val recorder = newRecorder()
        if (recorder.state != AudioRecord.STATE_INITIALIZED) {
            recorder.release()
            return FloatArray(0)
        }
        val blockSamples = Config.SAMPLE_RATE / 10 // 100ms blocks
        val maxSamples = (maxSeconds * Config.SAMPLE_RATE).toInt()
        val out = ArrayList<Short>(maxSamples)
        val block = ShortArray(blockSamples)
        var heardSpeech = false
        var consecutiveSilentSamples = 0
        val silenceHoldSamples = (Config.SILENCE_HOLD_SECONDS * Config.SAMPLE_RATE).toInt()

        try {
            recorder.startRecording()
            while (out.size < maxSamples) {
                val n = recorder.read(block, 0, blockSamples)
                if (n <= 0) break
                for (i in 0 until n) out.add(block[i])

                var sumSquares = 0.0
                for (i in 0 until n) {
                    val v = block[i] / 32768.0
                    sumSquares += v * v
                }
                val rms = sqrt(sumSquares / n)

                if (rms >= Config.SILENCE_RMS_THRESHOLD) {
                    heardSpeech = true
                    consecutiveSilentSamples = 0
                } else {
                    consecutiveSilentSamples += n
                }
                if (heardSpeech && consecutiveSilentSamples >= silenceHoldSamples) break
            }
            recorder.stop()
        } finally {
            recorder.release()
        }
        return shortsToFloats(out.toShortArray())
    }

    private fun shortsToFloats(shorts: ShortArray): FloatArray =
        FloatArray(shorts.size) { i -> shorts[i] / 32768.0f }
}
