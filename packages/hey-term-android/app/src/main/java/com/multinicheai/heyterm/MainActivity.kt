// Copyright (c) 2026 MultiNiche AI. All rights reserved.
package com.multinicheai.heyterm

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.widget.EditText
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.multinicheai.heyterm.databinding.ActivityMainBinding
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private var service: HeyTermService? = null
    private var bound = false
    private var listening = false

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { /* handled by checking again on next Start tap */ }

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            service = (binder as HeyTermService.LocalBinder).service()
            bound = true
        }
        override fun onServiceDisconnected(name: ComponentName?) {
            service = null
            bound = false
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        ensureApiKey()

        binding.startStopButton.setOnClickListener { onStartStopTapped() }
        binding.sendTyped.setOnClickListener { sendTypedRequest() }
        binding.typedRequest.setOnEditorActionListener { _, _, _ -> sendTypedRequest(); true }

        lifecycleScope.launch {
            LogBus.lines.collect { line ->
                binding.logText.append(line + "\n")
                binding.logScroll.post { binding.logScroll.fullScroll(android.view.View.FOCUS_DOWN) }
            }
        }
    }

    private fun sendTypedRequest() {
        val text = binding.typedRequest.text?.toString()?.trim().orEmpty()
        if (text.isEmpty()) return
        binding.typedRequest.setText("")
        service?.submitTypedRequest(text) ?: LogBus.emit("[Hey Term] Not listening yet -- tap Start Listening first.")
    }

    private fun onStartStopTapped() {
        if (!listening) {
            val needed = mutableListOf(Manifest.permission.RECORD_AUDIO)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                needed.add(Manifest.permission.POST_NOTIFICATIONS)
            }
            val missing = needed.filter {
                ContextCompat.checkSelfPermission(this, it) != android.content.pm.PackageManager.PERMISSION_GRANTED
            }
            if (missing.isNotEmpty()) {
                permissionLauncher.launch(missing.toTypedArray())
                return
            }
            if (Config.apiKey(this).isBlank()) {
                ensureApiKey()
                return
            }
            val intent = Intent(this, HeyTermService::class.java)
            ContextCompat.startForegroundService(this, intent)
            bindService(intent, connection, Context.BIND_AUTO_CREATE)
            listening = true
            binding.startStopButton.text = getString(R.string.btn_stop)
        } else {
            if (bound) unbindService(connection)
            bound = false
            stopService(Intent(this, HeyTermService::class.java))
            listening = false
            binding.startStopButton.text = getString(R.string.btn_start)
        }
    }

    private fun ensureApiKey() {
        if (Config.apiKey(this).isNotBlank()) return
        val input = EditText(this).apply { hint = "sk-ant-..." }
        AlertDialog.Builder(this)
            .setTitle("Anthropic API key")
            .setMessage("Hey Term is bring-your-own-key -- get one at console.anthropic.com. Stored only on this device.")
            .setView(input)
            .setCancelable(false)
            .setPositiveButton("Save") { _, _ -> Config.setApiKey(this, input.text.toString()) }
            .show()
    }

    override fun onDestroy() {
        if (bound) {
            unbindService(connection)
            bound = false
        }
        super.onDestroy()
    }
}
