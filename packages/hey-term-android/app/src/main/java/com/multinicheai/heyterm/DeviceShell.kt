// Copyright (c) 2026 MultiNiche AI. All rights reserved.
package com.multinicheai.heyterm

import android.content.Context
import java.util.concurrent.TimeUnit

data class CommandResult(
    val command: String,
    val ran: Boolean,
    val exitCode: Int,
    val stdout: String,
    val stderr: String,
    val error: String?,
)

/**
 * Real command execution through Android's own shell interpreter,
 * /system/bin/sh, which is present on every Android device -- not part of
 * a separate app that has to be installed (unlike Termux), and not a
 * cross-compiled binary this app carries around and has to keep working
 * across OS/architecture updates. This is the same thing a JNI/native
 * `exec()` call or any terminal-emulator app on the Play Store ultimately
 * does; there's no "OS service" layer being borrowed here the way Android's
 * cloud speech recognizer was rejected earlier -- /system/bin/sh is just
 * the standard POSIX shell binary, like invoking libc, not a competing
 * product. Paired with Android's own coreutils-equivalent (toybox, backing
 * ls/cat/grep/find/sed/mkdir/cp/mv/chmod/tar/ps and friends on every stock
 * build since Android 6), this is a genuinely self-contained terminal --
 * nothing else needs installing.
 *
 * Runs in this app's own sandboxed storage (Config.workDir) -- see that
 * comment for why: regular, non-rooted Android apps can't reach arbitrary
 * system paths or another app's storage no matter what shell is invoking
 * the command, so that boundary would exist with any implementation.
 */
class DeviceShell(private val context: Context) {
    private val shellBinary = "/system/bin/sh"

    /** Runs one command through the device's shell, in Config.workDir.
     * Never throws -- a launch failure or timeout comes back as a
     * CommandResult with ran=false/exitCode=-1 and `error` set, same
     * contract the desktop/Termux executors use. */
    fun run(command: String, timeoutSeconds: Long = Config.COMMAND_TIMEOUT_SECONDS): CommandResult {
        return try {
            val process = ProcessBuilder(shellBinary, "-c", command)
                .directory(Config.workDir(context))
                .redirectErrorStream(false)
                .start()

            val finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS)
            if (!finished) {
                process.destroyForcibly()
                return CommandResult(command, ran = true, exitCode = -1, stdout = "", stderr = "",
                    error = "timed out after ${timeoutSeconds}s")
            }
            val stdout = process.inputStream.bufferedReader().readText()
            val stderr = process.errorStream.bufferedReader().readText()
            CommandResult(command, ran = true, exitCode = process.exitValue(), stdout = stdout, stderr = stderr, error = null)
        } catch (e: Exception) {
            CommandResult(command, ran = false, exitCode = -1, stdout = "", stderr = "", error = e.message ?: "launch failed")
        }
    }
}
