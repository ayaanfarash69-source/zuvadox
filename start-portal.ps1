param(
    [int]$Port = 3000
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
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

$env:PORT = "$Port"

Push-Location $scriptDir
try {
    & $nodeBinary ".\server.js"
} finally {
    Pop-Location
}
