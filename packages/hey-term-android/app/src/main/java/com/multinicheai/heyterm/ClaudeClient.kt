// Copyright (c) 2026 MultiNiche AI. All rights reserved.
package com.multinicheai.heyterm

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class AgentException(message: String) : Exception(message)

sealed class Plan {
    data class Run(val summary: String, val commands: List<String>) : Plan()
    data class Clarify(val question: String) : Plan()
}

/**
 * Port of lib/agent.py -- same system prompt, same plain-HTTP call to
 * Claude's Messages API (no SDK dependency here either), same
 * clarify-over-guess instruction, same {"summary","commands"} /
 * {"clarify"} response contract. The one real difference: this app has no
 * bash/PowerShell to hand off to -- it runs commands itself through
 * DeviceShell (Android's own /system/bin/sh + toybox), against its own
 * sandboxed workspace, not the person's whole filesystem -- so the prompt
 * says that plainly rather than pretending to be a full desktop shell.
 */
object ClaudeClient {
    private const val API_URL = "https://api.anthropic.com/v1/messages"
    private const val MODEL = Config.ANTHROPIC_MODEL

    private val SYSTEM_PROMPT = """
        You are Hey Term, a cautious voice-controlled terminal assistant made by MultiNiche AI, running as an Android app. \
        The person speaks a request; you turn it into exact shell command(s) to run, or ask a clarifying question if the \
        request is ambiguous or you're missing information you'd need to get it right.

        Rules:
        - Commands run through Android's own /system/bin/sh inside this app's private, sandboxed workspace on the phone -- \
        not the person's whole device filesystem, and not a full bash/coreutils environment. Use plain POSIX sh syntax \
        (no bash-only features like arrays or [[ ]]), and only reference files/paths inside that workspace.
        - Prefer the smallest, safest command that accomplishes exactly what was asked. Do not add steps the person didn't \
        ask for (no extra cleanup, no "while I'm at it" changes).
        - If the request could reasonably mean more than one thing, or names a file/target you have no way to confirm \
        exists, ask a clarifying question instead of guessing.
        - If the request is not something this sandboxed shell can do, say so in "clarify" rather than inventing a command \
        that doesn't actually do it.
        - Never chain an unrelated destructive command onto a benign request.
        - Write "summary" (and "clarify", if you use it) in a short, natural, speakable English sentence -- it will be \
        read aloud by text-to-speech, not displayed as text.

        Respond with ONLY a single JSON object, no other text, in exactly one of these two shapes:

        {"summary": "<one plain sentence describing what will happen>", "commands": ["<command 1>", "<command 2>"]}

        or

        {"clarify": "<one short question to ask back>"}
    """.trimIndent()

    private val http = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    /** `history` is the conversation so far as [{"role","content"}, ...] --
     * forwarded ahead of `requestText` so a clarifying answer or a
     * follow-up reference lands in context, same as the desktop/Termux
     * versions' plan(). Caller owns when to reset it. */
    fun plan(apiKey: String, requestText: String, history: List<Pair<String, String>>): Plan {
        if (apiKey.isBlank()) throw AgentException("No Anthropic API key set -- add one in the app's settings.")

        val messages = JSONArray()
        for ((role, content) in history) {
            messages.put(JSONObject().put("role", role).put("content", content))
        }
        messages.put(JSONObject().put("role", "user").put("content", requestText))

        val body = JSONObject()
            .put("model", MODEL)
            .put("max_tokens", 500)
            .put("system", SYSTEM_PROMPT)
            .put("messages", messages)
            .toString()
            .toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url(API_URL)
            .addHeader("x-api-key", apiKey)
            .addHeader("anthropic-version", "2023-06-01")
            .addHeader("content-type", "application/json")
            .post(body)
            .build()

        val responseText: String
        val statusCode: Int
        try {
            http.newCall(request).execute().use { resp ->
                statusCode = resp.code
                responseText = resp.body?.string() ?: ""
            }
        } catch (e: IOException) {
            throw AgentException("Could not reach Claude's API: ${e.message}")
        }

        if (statusCode != 200) {
            throw AgentException("Claude's API returned $statusCode: ${responseText.take(300)}")
        }

        val data = try {
            JSONObject(responseText)
        } catch (e: Exception) {
            throw AgentException("Unexpected response shape from Claude's API: ${e.message}")
        }

        val content = data.optJSONArray("content") ?: JSONArray()
        val text = StringBuilder()
        for (i in 0 until content.length()) {
            val block = content.optJSONObject(i) ?: continue
            if (block.optString("type") == "text") text.append(block.optString("text", ""))
        }

        return parsePlan(text.toString().trim())
    }

    /** Separated from plan() so it's testable without a network call, same
     * as lib/agent.py's parse_plan(). */
    fun parsePlan(rawText: String): Plan {
        var text = rawText.trim()
        if (text.startsWith("```")) {
            text = text.trim('`').trim()
            if (text.lowercase().startsWith("json")) text = text.substring(4).trim()
        }

        val parsed = try {
            JSONObject(text)
        } catch (e: Exception) {
            throw AgentException("Response wasn't valid JSON: ${e.message}")
        }

        if (parsed.has("clarify")) {
            val question = parsed.optString("clarify", "").trim()
            if (question.isEmpty()) throw AgentException("'clarify' field was empty or not a string.")
            return Plan.Clarify(question)
        }

        if (parsed.has("summary") && parsed.has("commands")) {
            val summary = parsed.optString("summary", "").trim()
            val commandsArr = parsed.optJSONArray("commands")
            if (summary.isEmpty()) throw AgentException("'summary' field was empty or not a string.")
            if (commandsArr == null || commandsArr.length() == 0) {
                throw AgentException("'commands' field must be a non-empty list.")
            }
            val commands = (0 until commandsArr.length()).map { commandsArr.optString(it, "").trim() }
            if (commands.any { it.isEmpty() }) throw AgentException("Every entry in 'commands' must be a non-empty string.")
            return Plan.Run(summary, commands)
        }

        throw AgentException("Response JSON had neither a valid 'clarify' nor a valid 'summary'+'commands' shape.")
    }
}
