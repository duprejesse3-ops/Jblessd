# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.
#
# Registers MultiGuard as a Windows Scheduled Task that starts silently at
# logon and keeps running in the background.
#
# Usage (from an elevated PowerShell prompt, run from the package root):
#   .\adapters\windows-task.ps1

$ErrorActionPreference = 'Stop'

$packageRoot = Split-Path -Parent $PSScriptRoot
$binPath = Join-Path $packageRoot 'bin\guard.mjs'
$nodePath = (Get-Command node).Source

if (-not $nodePath) {
    Write-Error "Node.js was not found on PATH. Install Node 18+ first."
    exit 1
}

$action = New-ScheduledTaskAction -Execute $nodePath -Argument "`"$binPath`" start" -WorkingDirectory $packageRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -Hidden -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName "MultiGuard" `
    -Action $action -Trigger $trigger -Settings $settings -Force

Write-Host "Registered. MultiGuard will start automatically at your next login."
Write-Host "To start it right now: Start-ScheduledTask -TaskName 'MultiGuard'"
Write-Host "To remove it later:    Unregister-ScheduledTask -TaskName 'MultiGuard'"
