# Copyright (c) 2026 MultiNiche AI. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.
#
# Entry point: hands off to the real Windows setup script (best-effort
# Speech/SAPI5 voice pack if run elevated, Python deps, .env, Whisper
# model). See scripts\setup-windows.ps1 for every parameter; anything you
# pass here is forwarded as-is, e.g.:
#
#   .\install.ps1 -Langs es,fr,de
#   .\install.ps1 -SkipCapabilities

param(
    [string[]]$Langs = @("en"),
    [switch]$SkipCapabilities,
    [switch]$Yes
)

$ErrorActionPreference = "Stop"
$setupArgs = @{ Langs = $Langs }
if ($SkipCapabilities) { $setupArgs.SkipCapabilities = $true }
if ($Yes) { $setupArgs.Yes = $true }
& (Join-Path $PSScriptRoot "scripts\setup-windows.ps1") @setupArgs
