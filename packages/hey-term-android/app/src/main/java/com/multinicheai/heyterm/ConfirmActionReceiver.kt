// Copyright (c) 2026 MultiNiche AI. All rights reserved.
package com.multinicheai.heyterm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Handles the Confirm/Cancel action buttons on the confirmation
 * notification HeyTermService posts for ordinary (non-dangerous)
 * commands. */
class ConfirmActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_CONFIRM -> ConfirmGate.resolve(ConfirmOutcome.CONFIRM)
            ACTION_CANCEL -> ConfirmGate.resolve(ConfirmOutcome.CANCEL)
        }
    }

    companion object {
        const val ACTION_CONFIRM = "com.multinicheai.heyterm.ACTION_CONFIRM"
        const val ACTION_CANCEL = "com.multinicheai.heyterm.ACTION_CANCEL"
    }
}
