# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.

# Adapter: Windows Task Scheduler.
#
# Registers a scheduled task that runs "vault sync" hourly. Run this script
# ONCE to set it up; Windows takes it from there.
#
# Install:
#   1. Open PowerShell (does not need to be Administrator)
#   2. Run, replacing the passphrase with the one "vault init" printed:
#        powershell -ExecutionPolicy Bypass -File adapters\windows-task.ps1 -Passphrase "xxxx"
#
# To remove the scheduled task later:
#   Unregister-ScheduledTask -TaskName "MultiVaultSync" -Confirm:$false
#
# The passphrase is stored as a per-user environment variable
# (MULTIVAULT_PASSPHRASE), not embedded in the task definition itself, so it
# does not show up in Task Scheduler's UI or export.

param(
  [Parameter(Mandatory = $true)]
  [string]$Passphrase,
  [string]$Dest = "$env:USERPROFILE\.multivault"
)

$PackageDir = Split-Path -Parent $PSScriptRoot
$BinPath = Join-Path $PackageDir "bin\vault.mjs"
$LogPath = Join-Path $PackageDir "multivault.log"

$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodePath) {
  Write-Error "Node.js was not found on PATH. Install Node 18+ from https://nodejs.org first."
  exit 2
}

[System.Environment]::SetEnvironmentVariable('MULTIVAULT_PASSPHRASE', $Passphrase, 'User')

$Arguments = "`"$BinPath`" sync --dest `"$Dest`""
$FullArguments = "/c `"$NodePath`" $Arguments >> `"$LogPath`" 2>&1"

$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $FullArguments
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration ([TimeSpan]::MaxValue)
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName "MultiVaultSync" `
  -Action $Action -Trigger $Trigger -Settings $Settings `
  -Description "Refreshes the MultiVault encrypted context snapshot hourly." `
  -Force

Write-Host "Scheduled task 'MultiVaultSync' registered — syncing hourly."
Write-Host "Logs will be written to $LogPath"
Write-Host "Note: MULTIVAULT_PASSPHRASE was saved as a per-user environment variable."
