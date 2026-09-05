# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.

# Adapter: Windows Task Scheduler.
#
# Registers a scheduled task that runs "docs-bridge sync" hourly. Requires
# you've already run "docs-bridge auth" once interactively before this — the
# saved refresh token is what lets it run unattended from here on.
#
# Install:
#   1. Open PowerShell (does not need to be Administrator)
#   2. Run:
#        powershell -ExecutionPolicy Bypass -File adapters\windows-task.ps1
#
# To remove the scheduled task later:
#   Unregister-ScheduledTask -TaskName "MultiVaultDocsBridgeSync" -Confirm:$false

$PackageDir = Split-Path -Parent $PSScriptRoot
$BinPath = Join-Path $PackageDir "bin\docs-bridge.mjs"
$LogPath = Join-Path $PackageDir "docs-bridge.log"

$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodePath) {
  Write-Error "Node.js was not found on PATH. Install Node 18+ from https://nodejs.org first."
  exit 2
}

$Arguments = "`"$BinPath`" sync"
$FullArguments = "/c `"$NodePath`" $Arguments >> `"$LogPath`" 2>&1"

$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $FullArguments
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration ([TimeSpan]::MaxValue)
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName "MultiVaultDocsBridgeSync" `
  -Action $Action -Trigger $Trigger -Settings $Settings `
  -Description "Exports changed Google Docs to local markdown files hourly." `
  -Force

Write-Host "Scheduled task 'MultiVaultDocsBridgeSync' registered — syncing hourly."
Write-Host "Logs will be written to $LogPath"
