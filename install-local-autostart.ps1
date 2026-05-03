param(
    [int]$Port = 3000
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$startupDir = [Environment]::GetFolderPath("Startup")
$launcherPath = Join-Path $startupDir "zuva-client-portal-watchdog.cmd"
$watchdogPath = Join-Path $scriptDir "portal-watchdog.ps1"

if (-not (Test-Path $watchdogPath)) {
    Write-Error "portal-watchdog.ps1 was not found."
    exit 1
}

$launcherContent = @"
@echo off
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$watchdogPath" -Port $Port
"@

Set-Content -LiteralPath $launcherPath -Value $launcherContent -Encoding ASCII
Write-Output "Autostart launcher installed at $launcherPath"
