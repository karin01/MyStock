Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Has-Command([string]$name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Ensure-Tool([string]$cmdName, [string]$wingetId, [string]$manualUrl) {
  if (Has-Command $cmdName) { return $true }
  Write-Host ("[MISSING] $cmdName not found.") -ForegroundColor Yellow
  if (Has-Command "winget") {
    Write-Host ("[INSTALL] winget install $wingetId") -ForegroundColor Yellow
    try {
      winget install $wingetId --accept-package-agreements --accept-source-agreements --silent | Out-Host
      Write-Host "[OK] Installed. Close and run again." -ForegroundColor Green
      return $false
    } catch {
      Write-Host ("[FAIL] " + $_.Exception.Message) -ForegroundColor Red
    }
  }
  Write-Host ("[MANUAL] $manualUrl") -ForegroundColor Yellow
  try { Start-Process $manualUrl | Out-Null } catch {}
  return $false
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "       NEON REQUIEM 2087 - START" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# Node.js
if (-not (Ensure-Tool "node" "OpenJS.NodeJS.LTS" "https://nodejs.org/ko")) {
  Read-Host "Press Enter to exit"
  exit 1
}
Write-Host ("[OK] Node: " + (& node -v 2>&1)) -ForegroundColor Gray

# Python
$pyCmd = $null
if (Has-Command "py") { $pyCmd = "py" }
elseif (Has-Command "python") { $pyCmd = "python" }
else {
  if (-not (Ensure-Tool "python" "Python.Python.3.12" "https://www.python.org/downloads/")) {
    Read-Host "Press Enter to exit"
    exit 1
  }
  $pyCmd = "python"
}

# Backend (optional)
if (Test-Path ".\backend\requirements.txt") {
  Write-Host "[STEP] Backend setup..." -ForegroundColor Cyan
  Push-Location ".\backend"
  try {
    if (-not (Test-Path ".\venv\Scripts\activate.bat")) {
      Write-Host "[STEP] Creating venv..." -ForegroundColor Cyan
      if ($pyCmd -eq "py") { & py -3 -m venv venv | Out-Host }
      else { & python -m venv venv | Out-Host }
    }
    if (-not (Test-Path ".\venv\Scripts\activate.bat")) { throw "venv creation failed" }
    cmd /c ".\venv\Scripts\activate.bat && pip install -q -r requirements.txt"
    if ($LASTEXITCODE -ne 0) { throw "pip install failed" }
    $backendPath = (Join-Path $root "backend")
    Start-Process "cmd.exe" -ArgumentList "/k", "cd /d `"$backendPath`" && call venv\Scripts\activate.bat && python app.py" -WindowStyle Normal
    Write-Host "[OK] Backend started in new window." -ForegroundColor Gray
  } finally {
    Pop-Location
  }
} else {
  Write-Host "[SKIP] No backend\requirements.txt found." -ForegroundColor DarkGray
}

# Frontend
Write-Host ""
Write-Host "[STEP] Frontend setup..." -ForegroundColor Cyan
Set-Location (Join-Path $root "frontend")
if (-not (Test-Path ".\package.json")) {
  Write-Host "[ERROR] frontend\package.json not found." -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

npm install
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERROR] npm install failed." -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

Write-Host ""
Write-Host "[RUN] Starting dev server... (Ctrl+C to stop)" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""
npm run dev
