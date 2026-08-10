#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Run the jblessd.com storefront under Podman on Windows.

.DESCRIPTION
  The Windows counterpart to container/podman.sh. That script is POSIX shell and
  cannot run in PowerShell or cmd, so on Podman Desktop for Windows there was no
  supported way to start the stack without first installing WSL and a shell.
  This does the same three steps in the same order:

    1. create a pod publishing the host port
    2. start Postgres and wait until it actually answers
    3. run the migrations to completion, then start the app

  The ordering is written out rather than declared, for the reason the compose
  file explains: podman-compose does not reliably honour `depends_on` conditions,
  and without them the app races an unmigrated database.

  Everything runs in one pod, so the containers share a network namespace and
  reach Postgres on 127.0.0.1:5432 with no DNS plugin and no user-defined
  network. Only the app's port is published.

.EXAMPLE
  .\container\podman.ps1 up -Build     # rebuild the image, then start
.EXAMPLE
  .\container\podman.ps1 up            # start; build only if the image is absent
.EXAMPLE
  .\container\podman.ps1 logs          # follow the app's output
.EXAMPLE
  .\container\podman.ps1 down -Volumes # stop, remove, and delete the data

.NOTES
  If PowerShell refuses to run this file at all ("running scripts is disabled on
  this system"), that is the default execution policy, not a problem with the
  script:

    powershell -ExecutionPolicy Bypass -File .\container\podman.ps1 up -Build
#>

[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('up', 'down', 'build', 'migrate', 'logs', 'status')]
  [string]$Command = 'up',

  # Rebuild the image before starting, even if one is already present.
  [switch]$Build,

  # With `down`: also delete the Postgres and blob volumes.
  [switch]$Volumes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# The build context is the repository root, not container/, because the image
# needs the application source that lives above this directory.
$RepoRoot = Split-Path -Parent $PSScriptRoot

$Pod     = if ($env:POD_NAME)  { $env:POD_NAME }  else { 'jblessd' }
# `localhost/` matches what Podman names an image it built itself. A bare
# `jblessd-store:local` is an unqualified short name, which Podman resolves
# against registries.conf instead of local storage — either failing outright or
# looking for the image on Docker Hub.
$Image   = if ($env:APP_IMAGE) { $env:APP_IMAGE } else { 'localhost/jblessd-store:local' }
$PgImage = if ($env:PG_IMAGE)  { $env:PG_IMAGE }  else { 'docker.io/library/postgres:17-alpine' }
$EnvFile = if ($env:ENV_FILE)  { $env:ENV_FILE }  else { (Join-Path $RepoRoot 'container\.env') }

$PgCtr   = "$Pod-postgres"
$AppCtr  = "$Pod-app"
$PgVol   = "$Pod-pgdata"
$BlobVol = "$Pod-blobs"

# Every podman call passes its arguments as one array, rather than as loose
# tokens. PowerShell would otherwise try to bind a leading-dash token like `-d`
# to a parameter of this function instead of passing it through to podman.
#
# The exit-code check is the point of the wrapper: PowerShell does not fail on a
# non-zero exit from a native command, so without it a failed build would be a
# printed error followed by this script cheerfully starting a stale image.
function Invoke-Podman {
  param([Parameter(Mandatory = $true)][string[]]$PodmanArgs)

  & podman @PodmanArgs
  if ($LASTEXITCODE -ne 0) {
    throw "podman $($PodmanArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

# For the existence probes, where a non-zero exit is the answer and not an error.
function Test-PodmanCommand {
  param([Parameter(Mandatory = $true)][string[]]$PodmanArgs)

  & podman @PodmanArgs *>$null
  return ($LASTEXITCODE -eq 0)
}

# On Windows, Podman is a client talking to a Linux VM. When that VM is not
# running every later command fails with a connection error that says nothing
# about the machine, so it is worth one check and a specific instruction.
function Assert-Podman {
  if (-not (Get-Command podman -ErrorAction SilentlyContinue)) {
    throw 'podman is not on PATH. Install Podman Desktop, or add podman.exe to PATH.'
  }

  & podman info *>$null
  if ($LASTEXITCODE -ne 0) {
    throw @'
Cannot reach the Podman machine. On Windows the podman command is a client for a
Linux VM, which has to exist and be running:

  podman machine init     # first time only
  podman machine start

"podman machine init" needs WSL 2. If it reports that WSL is missing, run
"wsl --install" from an elevated prompt and reboot.
'@
  }
}

# Read as key/value pairs and pass with -e rather than handing the file to
# --env-file. On Windows this file is routinely saved with CRLF, and podman's
# own env-file parser keeps the trailing CR inside the value: POSTGRES_PASSWORD
# becomes "secret<CR>", which then fails to authenticate against a database that
# was initialised with "secret". Parsing here removes that whole class of
# Windows-only failure. Last assignment wins, matching how the runtimes read it.
function Read-EnvFile {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw @"
$Path not found. Copy the example and fill it in:

  Copy-Item container\.env.example container\.env
"@
  }

  $map = [ordered]@{}
  foreach ($line in @(Get-Content -LiteralPath $Path)) {
    $text = $line.Trim()
    if ($text -eq '' -or $text.StartsWith('#')) { continue }

    $split = $text.IndexOf('=')
    if ($split -lt 1) { continue }

    $key   = $text.Substring(0, $split).Trim()
    $value = $text.Substring($split + 1).Trim().TrimEnd("`r")

    # Strip one layer of surrounding quotes, the way compose does.
    if ($value.Length -ge 2 -and
        (($value.StartsWith('"') -and $value.EndsWith('"')) -or
         ($value.StartsWith("'") -and $value.EndsWith("'")))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $map[$key] = $value
  }
  return $map
}

function Get-Settings {
  $envMap = Read-EnvFile -Path $EnvFile

  if (-not $envMap.Contains('POSTGRES_PASSWORD') -or [string]::IsNullOrEmpty($envMap['POSTGRES_PASSWORD'])) {
    throw "POSTGRES_PASSWORD is empty in $EnvFile"
  }

  # The password is interpolated into a URL, so anything with reserved meaning
  # there truncates it into a connection string that fails obscurely.
  if ($envMap['POSTGRES_PASSWORD'] -notmatch '^[A-Za-z0-9._~\-]+$') {
    Write-Warning ('POSTGRES_PASSWORD contains characters that are reserved in a URL; ' +
      'use only letters, digits and . _ ~ - to avoid a malformed DATABASE_URL.')
  }

  $hostPort = '8080'
  if ($envMap.Contains('PORT') -and $envMap['PORT']) { $hostPort = $envMap['PORT'] }

  return [pscustomobject]@{
    Env         = $envMap
    HostPort    = $hostPort
    DatabaseUrl = "postgres://storefront:$($envMap['POSTGRES_PASSWORD'])@127.0.0.1:5432/storefront"
  }
}

function Build-Image {
  Assert-Podman
  Write-Host "==> Building $Image"
  Invoke-Podman @(
    'build',
    '--file', (Join-Path $RepoRoot 'container\Dockerfile'),
    '--tag', $Image,
    $RepoRoot
  )
}

# A local-only name means build it here; a registry reference means APP_IMAGE
# points at a published tag. `localhost/` is tested first because it has a slash
# but no registry behind it, so pulling it could only ever fail.
function Initialize-Image {
  if ($Build) { Build-Image; return }
  if (Test-PodmanCommand @('image', 'exists', $Image)) { return }

  if ($Image.StartsWith('localhost/') -or -not $Image.Contains('/')) {
    Build-Image
  }
  else {
    Write-Host "==> Pulling $Image"
    Invoke-Podman @('pull', $Image)
  }
}

function Start-Postgres {
  param([Parameter(Mandatory = $true)][pscustomobject]$Settings)

  if (Test-PodmanCommand @('container', 'exists', $PgCtr)) {
    Invoke-Podman @('start', $PgCtr) | Out-Null
  }
  else {
    Write-Host '==> Starting Postgres'
    Invoke-Podman @(
      'run', '-d',
      '--pod', $Pod,
      '--name', $PgCtr,
      '--restart', 'unless-stopped',
      '-e', 'POSTGRES_USER=storefront',
      '-e', "POSTGRES_PASSWORD=$($Settings.Env['POSTGRES_PASSWORD'])",
      '-e', 'POSTGRES_DB=storefront',
      '-v', "$($PgVol):/var/lib/postgresql/data",
      $PgImage
    ) | Out-Null
  }

  # Polled rather than left to the image's HEALTHCHECK: Podman runs those on a
  # systemd timer, and inside the WSL machine there is no user systemd session,
  # so health never leaves "starting" and anything gated on it waits forever.
  Write-Host -NoNewline 'Waiting for Postgres'
  $waited = 0
  while (-not (Test-PodmanCommand @('exec', $PgCtr, 'pg_isready', '-U', 'storefront', '-d', 'storefront'))) {
    $waited++
    if ($waited -gt 60) {
      Write-Host ''
      throw "Postgres was not ready after 60s. Check: podman logs $PgCtr"
    }
    Write-Host -NoNewline '.'
    Start-Sleep -Seconds 1
  }
  Write-Host ' ready'
}

function Invoke-Migrations {
  param([Parameter(Mandatory = $true)][pscustomobject]$Settings)

  Write-Host '==> Applying migrations'
  Invoke-Podman @(
    'run', '--rm',
    '--pod', $Pod,
    '-e', "DATABASE_URL=$($Settings.DatabaseUrl)",
    $Image,
    'node', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    '--import', './container/hooks/register.mjs', 'container/migrate.mjs'
  )
}

function Invoke-Up {
  Assert-Podman
  $settings = Get-Settings
  Initialize-Image

  if (Test-PodmanCommand @('pod', 'exists', $Pod)) {
    # The published port is fixed when the pod is created, so an edited PORT
    # takes effect only after a `down`. Worth saying, rather than leaving the
    # setting looking ignored. Joined to a single string because the template
    # emits one line but a Go template error would emit several.
    $format = '{{range $p, $b := .InfraConfig.PortBindings}}{{range $b}}{{.HostPort}}{{end}}{{end}}'
    $bound = (& podman pod inspect $Pod --format $format 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -eq 0 -and $bound -and $bound -ne $settings.HostPort) {
      Write-Warning ("pod $Pod publishes $bound, not $($settings.HostPort). " +
        "Run '.\container\podman.ps1 down' first to change it.")
    }
  }
  else {
    Write-Host "==> Creating pod $Pod (publishing $($settings.HostPort))"
    Invoke-Podman @('pod', 'create', '--name', $Pod, '--publish', "$($settings.HostPort):8080") | Out-Null
  }

  Start-Postgres -Settings $settings
  Invoke-Migrations -Settings $settings

  # Recreated rather than restarted, so a rebuilt image or an edited .env
  # actually takes effect instead of silently running the previous one.
  & podman rm -f $AppCtr *>$null

  Write-Host '==> Starting app'

  # PORT from the env file chooses the *host* side of the mapping above, so it is
  # deliberately not forwarded; the container always listens on 8080. Everything
  # else in the file goes through as-is.
  $runArgs = @(
    'run', '-d',
    '--pod', $Pod,
    '--name', $AppCtr,
    '--restart', 'unless-stopped'
  )
  foreach ($key in @($settings.Env.Keys)) {
    if ($key -eq 'PORT') { continue }
    $runArgs += @('-e', "$key=$($settings.Env[$key])")
  }
  $runArgs += @('-e', "DATABASE_URL=$($settings.DatabaseUrl)")
  $runArgs += @('-e', 'BLOBS_DIR=/data/blobs')
  $runArgs += @('-e', 'PORT=8080')
  $runArgs += @('-v', "$($BlobVol):/data/blobs")
  $runArgs += $Image

  Invoke-Podman $runArgs | Out-Null

  Write-Host ''
  Write-Host "Up on http://localhost:$($settings.HostPort)"
  Write-Host 'Logs: .\container\podman.ps1 logs'
}

function Invoke-Down {
  Assert-Podman

  if (Test-PodmanCommand @('pod', 'exists', $Pod)) {
    Write-Host "==> Removing pod $Pod"
    Invoke-Podman @('pod', 'rm', '-f', $Pod) | Out-Null
  }

  if ($Volumes) {
    Write-Host '==> Removing volumes'
    & podman volume rm $PgVol $BlobVol *>$null
  }
  else {
    Write-Host "Volumes $PgVol and $BlobVol kept. Add -Volumes to delete them."
  }
}

Push-Location $RepoRoot
try {
  switch ($Command) {
    'up'      { Invoke-Up }
    'down'    { Invoke-Down }
    'build'   { Build-Image }
    'migrate' { Assert-Podman; Invoke-Migrations -Settings (Get-Settings) }
    'logs'    { Assert-Podman; & podman logs -f $AppCtr }
    'status'  {
      Assert-Podman
      & podman pod ps --filter "name=$Pod"
      & podman ps -a --filter "pod=$Pod" --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
    }
  }
}
finally {
  Pop-Location
}
