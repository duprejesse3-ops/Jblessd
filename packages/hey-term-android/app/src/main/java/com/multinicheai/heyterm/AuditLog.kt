// Copyright (c) 2026 MultiNiche AI. All rights reserved.
package com.multinicheai.heyterm

import android.content.Context
import org.json.JSONObject
import java.io.FileWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Port of lib/audit.py -- one JSON object per line, plain text, appended
 * for every wake/request/plan/confirmation/run. Off by default is not an
 * option here either: see the desktop version's comment in lib/config.py.
 */
object AuditLog {
    private val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    @Synchronized
    fun log(context: Context, event: String, fields: Map<String, Any?> = emptyMap()) {
        val obj = JSONObject()
        obj.put("ts", isoFormat.format(Date()))
        obj.put("event", event)
        for ((k, v) in fields) obj.put(k, v)
        try {
            FileWriter(Config.auditLogPath(context), true).use { it.write(obj.toString() + "\n") }
        } catch (e: Exception) {
            // Best-effort, same as the desktop version -- never let logging
            // itself break the actual request/response flow.
        }
    }
}
