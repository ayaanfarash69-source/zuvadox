param(
    [int]$Port = 3000,
    [int]$StartupTimeoutSeconds = 20
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverScript = Join-Path $scriptDir "server.js"
$bundledNode = Join-Path $HOME ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$nodeBinary = $null

if (Test-Path $bundledNode) {
    $nodeBinary = $bundledNode
} else {
    $systemNode = Get-Command node -ErrorAction SilentlyContinue
    if ($systemNode) {
        $nodeBinary = $systemNode.Source
    }
}

if (-not $nodeBinary) {
    Write-Error "Node.js was not found. Install Node.js or use Codex bundled runtimes."
    exit 1
}

function Test-PortalOnline {
    param([int]$TestPort)

    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$TestPort/health" -UseBasicParsing -TimeoutSec 3
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

if (Test-PortalOnline -TestPort $Port) {
    Write-Output "Portal is already running on port $Port."
    exit 0
}

$logPath = Join-Path $scriptDir "server-auto.log"
$errorPath = Join-Path $scriptDir "server-auto.err.log"
$launchCommand = "`$env:PORT='$Port'; Set-Location '$scriptDir'; & '$nodeBinary' '$serverScript' *> '$logPath' 2> '$errorPath'"

Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $launchCommand `
    -WindowStyle Hidden `
    -WorkingDirectory $scriptDir | Out-Null

$deadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
    if (Test-PortalOnline -TestPort $Port) {
        Write-Output "Portal started on port $Port."
        exit 0
    }
}

Write-Error "The portal did not start within $StartupTimeoutSeconds seconds. Check server-auto.err.log."
exit 1
