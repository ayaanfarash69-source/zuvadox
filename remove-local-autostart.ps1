$startupDir = [Environment]::GetFolderPath("Startup")
$launcherPath = Join-Path $startupDir "zuva-client-portal-watchdog.cmd"

if (Test-Path $launcherPath) {
    Remove-Item -LiteralPath $launcherPath -Force
    Write-Output "Removed $launcherPath"
} else {
    Write-Output "No autostart launcher was found."
}
