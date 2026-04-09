Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Assert-Dir([string]$path) {
  if (-not (Test-Path $path)) { throw "Missing dir: $path" }
}

function Has-Command([string]$name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Must-Command([string]$name) {
  if (-not (Has-Command $name)) { throw "Missing command: $name" }
}

Assert-Dir (Join-Path $root "frontend")
Assert-Dir (Join-Path $root "backend")

Must-Command "node"
Must-Command "npm"

$pythonCmd = $null
if (Has-Command "py") { $pythonCmd = "py -3" }
elseif (Has-Command "python") { $pythonCmd = "python" }
else { throw "Missing python (py or python) command" }

if (Test-Path (Join-Path $root "backend\\requirements.txt")) {
  $reqPath = Join-Path $root "backend\\requirements.txt"
  $venvActivate = Join-Path $root "backend\\venv\\Scripts\\activate.bat"

  if (-not (Test-Path $venvActivate)) {
    & ([ScriptBlock]::Create($pythonCmd + " -m venv `"backend\\venv`"")) | Out-Null
  }

  cmd /c "backend\\venv\\Scripts\\activate.bat && pip install -q -r `"$reqPath`""

  $backendPath = Join-Path $root "backend"
  Start-Process "cmd.exe" -ArgumentList "/k", "cd /d `"$backendPath`" && backend\\venv\\Scripts\\activate.bat && python app.py"
}

Set-Location (Join-Path $root "frontend")
if (-not (Test-Path ".\\package.json")) { throw "Missing frontend\\package.json" }
cmd /c "npm install"
cmd /c "npm run dev"
