param(
    [int]$Port = 3000,
    [int]$CheckIntervalSeconds = 20
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

$serverLog = Join-Path $scriptDir "server-auto.log"
$serverErr = Join-Path $scriptDir "server-auto.err.log"

function Test-PortalOnline {
    param([int]$TestPort)

    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$TestPort/health" -UseBasicParsing -TimeoutSec 3
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Start-PortalProcess {
    $launchCommand = "`$env:PORT='$Port'; Set-Location '$scriptDir'; & '$nodeBinary' '$serverScript' *> '$serverLog' 2> '$serverErr'"

    Start-Process -FilePath "powershell.exe" `
        -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $launchCommand `
        -WindowStyle Hidden `
        -WorkingDirectory $scriptDir | Out-Null
}

while ($true) {
    if (-not (Test-PortalOnline -TestPort $Port)) {
        Start-PortalProcess
        Start-Sleep -Seconds 2
    }

    Start-Sleep -Seconds $CheckIntervalSeconds
}
