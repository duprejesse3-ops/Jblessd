# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.

# Adapter: Windows Task Scheduler.
#
# Registers a scheduled task that runs the organizer hourly — no manual
# clicking through the Task Scheduler GUI required. Run this script ONCE to
# set it up; Windows takes it from there.
#
# Install:
#   1. Open PowerShell (does not need to be Administrator, unless your
#      Downloads folder needs elevated access)
#   2. Edit $Folder below if you want something other than your Downloads
#      folder organized
#   3. Run:
#        powershell -ExecutionPolicy Bypass -File adapters\windows-task.ps1
#
# To remove the scheduled task later:
#   Unregister-ScheduledTask -TaskName "FileOrganizerAgent" -Confirm:$false
#
# To use AI classification for files the rules can't place, set an
# ANTHROPIC_API_KEY system environment variable first (Settings > System >
# About > Advanced system settings > Environment Variables), then re-run this
# script with -UseAI.

param(
  [string]$Folder = "$env:USERPROFILE\Downloads",
  [switch]$UseAI
)

$PackageDir = Split-Path -Parent $PSScriptRoot
$BinPath = Join-Path $PackageDir "bin\organize.mjs"
$LogPath = Join-Path $PackageDir "organize.log"

$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodePath) {
  Write-Error "Node.js was not found on PATH. Install Node 18+ from https://nodejs.org first."
  exit 2
}

$Arguments = "`"$BinPath`" `"$Folder`" --apply"
if ($UseAI) { $Arguments += " --ai" }
# Redirect output to the log file via cmd.exe, since Task Scheduler actions
# don't support shell redirection directly.
$FullArguments = "/c `"$NodePath`" $Arguments >> `"$LogPath`" 2>&1"

$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $FullArguments
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration ([TimeSpan]::MaxValue)
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName "FileOrganizerAgent" `
  -Action $Action -Trigger $Trigger -Settings $Settings `
  -Description "Sorts $Folder into categorized subfolders hourly (file-organizer-agent)." `
  -Force

Write-Host "Scheduled task 'FileOrganizerAgent' registered — organizing $Folder hourly."
Write-Host "Logs will be written to $LogPath"
