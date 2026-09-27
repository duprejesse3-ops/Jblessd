# Copyright (c) 2026 MultiNiche AI. All rights reserved.
#
# Automated setup for Hey Term on Windows.
# Installs Python deps, bootstraps .env, pre-downloads the Whisper model,
# and makes a best-effort attempt to install Windows Speech (SAPI5) language
# packs for the languages you ask for -- that part needs an elevated
# (Administrator) PowerShell and an internet connection; everything else
# does not.
#
# Usage (from a regular PowerShell prompt, in the hey-term folder):
#   .\scripts\setup-windows.ps1                          # English only
#   .\scripts\setup-windows.ps1 -Langs es,fr,de           # also request voice packs
#   .\scripts\setup-windows.ps1 -Langs es -SkipCapabilities   # skip the admin-only step
#
# If you didn't launch PowerShell as Administrator, the capability-install
# step is skipped automatically with instructions for doing it by hand from
# Settings instead -- everything else in the script still runs normally.

param(
    [string[]]$Langs = @("en"),
    [switch]$SkipCapabilities,
    [switch]$Yes
)

$ErrorActionPreference = "Stop"

# Hey Term's language codes -> Windows locale tags for the Speech (SAPI5 /
# Narrator) Feature-on-Demand capability.
$LocaleMap = @{
    en = "en-US"
    es = "es-ES"
    fr = "fr-FR"
    de = "de-DE"
    pt = "pt-PT"
    it = "it-IT"
}

function Confirm-Or-Skip {
    param([string]$Prompt)
    if ($Yes -or -not [Environment]::UserInteractive) { return $true }
    $reply = Read-Host "$Prompt [y/N]"
    return ($reply -match '^[Yy]')
}

Write-Host "== Hey Term Windows setup ==" -ForegroundColor Cyan
Write-Host "Languages requested: $($Langs -join ', ')"
Write-Host ""

# --- 1. Speech language capabilities (needs Administrator) ---------------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($SkipCapabilities) {
    Write-Host "Skipping speech language capability install (-SkipCapabilities)."
} elseif (-not $isAdmin) {
    Write-Warning "Not running as Administrator -- skipping automatic speech language install."
    Write-Host "To add a voice by hand instead: Settings > Time & Language > Language & region >" -ForegroundColor Yellow
    Write-Host "  Add a language > pick it > make sure 'Text-to-speech' is checked." -ForegroundColor Yellow
    Write-Host "Or re-run this script from an Administrator PowerShell to do it automatically." -ForegroundColor Yellow
} else {
    foreach ($lang in $Langs) {
        if (-not $LocaleMap.ContainsKey($lang)) {
            Write-Host "No known Windows locale mapping for '$lang' -- skipping." -ForegroundColor Yellow
            continue
        }
        $locale = $LocaleMap[$lang]
        $capName = "Language.Speech~~~$locale~0.0.1.0"
        try {
            $capability = Get-WindowsCapability -Online -Name $capName -ErrorAction Stop
            if ($capability.State -eq "Installed") {
                Write-Host "$locale speech voice already installed."
            } elseif (Confirm-Or-Skip "Install $locale speech voice?") {
                Write-Host "Installing $locale speech voice (this can take a minute)..."
                Add-WindowsCapability -Online -Name $capName | Out-Null
                Write-Host "$locale speech voice installed."
            }
        } catch {
            Write-Warning "Couldn't install $locale speech voice automatically: $($_.Exception.Message)"
            Write-Host "Install it by hand instead: Settings > Time & Language > Language & region > Add a language > pick $locale > check 'Text-to-speech'." -ForegroundColor Yellow
        }
    }
}
Write-Host ""

# --- 2. Python dependencies ------------------------------------------------
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $python) {
    Write-Error "Python was not found on PATH. Install Python 3.9+ from python.org or the Microsoft Store, then re-run this script."
    exit 1
}

Write-Host "Installing Python dependencies with $($python.Source)..."
$repoRoot = Split-Path -Parent $PSScriptRoot
& $python.Source -m pip install -q -r (Join-Path $repoRoot "requirements.txt")
if ($LASTEXITCODE -ne 0) {
    Write-Error "pip install failed -- see output above."
    exit 1
}

# --- 3. .env bootstrap ------------------------------------------------------
$envPath = Join-Path $repoRoot ".env"
$envExamplePath = Join-Path $repoRoot ".env.example"
if (-not (Test-Path $envPath)) {
    Copy-Item $envExamplePath $envPath
    Write-Host "Created .env -- edit it and add your ANTHROPIC_API_KEY before running Hey Term." -ForegroundColor Green
} else {
    Write-Host ".env already exists -- leaving it alone."
}

# --- 4. Pre-download the Whisper model --------------------------------------
Write-Host "Pre-downloading the Whisper speech-to-text model (one-time, ~150MB)..."
& $python.Source -c "from faster_whisper import WhisperModel; WhisperModel('base')"
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Model pre-download failed or was skipped -- it will just download on first run instead."
}

Write-Host ""
Write-Host "Done. Next steps:" -ForegroundColor Cyan
Write-Host "  1. Edit .env and set ANTHROPIC_API_KEY."
Write-Host "  2. Run: python main.py --lang en   (or --lang es / fr / de / pt / it)"
