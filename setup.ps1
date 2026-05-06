# One-command setup wrapper for Windows PowerShell.
# Forwards all args to scripts/setup.mjs.

$ErrorActionPreference = "Stop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "X Node.js is not installed." -ForegroundColor Red
    Write-Host "  Install Node 20+ from https://nodejs.org/ and re-run setup.ps1"
    exit 1
}

$nodeMajor = [int]((node -p "process.versions.node.split('.')[0]"))
if ($nodeMajor -lt 20) {
    Write-Host "X Node $nodeMajor detected. GitMesh requires Node 20 or newer." -ForegroundColor Red
    exit 1
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
& node (Join-Path $repoRoot "scripts/setup.mjs") @args
exit $LASTEXITCODE
