$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$submissionsFile = Join-Path $scriptDir "data\submissions.json"
$uploadsDir = Join-Path $scriptDir "uploads"
$resolvedScriptDir = [System.IO.Path]::GetFullPath($scriptDir)
$resolvedUploadsDir = [System.IO.Path]::GetFullPath($uploadsDir)

if (-not $resolvedUploadsDir.StartsWith($resolvedScriptDir, [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-Error "Resolved uploads path is outside the project directory. Aborting."
    exit 1
}

Set-Content -LiteralPath $submissionsFile -Value "[]`n" -Encoding UTF8

Get-ChildItem -LiteralPath $uploadsDir -Force |
    Where-Object { $_.Name -ne ".gitkeep" } |
    Remove-Item -Recurse -Force

Write-Output "All saved submissions and uploaded files were cleared."
