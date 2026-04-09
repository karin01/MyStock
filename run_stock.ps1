# Stock launcher for Windows PowerShell 5.1
# Source file is ASCII-only so CMD/PowerShell never mis-parse encoding (Korean Windows).
# User messages are English; double-click the launcher .bat in this folder.

$ErrorActionPreference = "Continue"

$Root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location -LiteralPath $Root

function Test-PathLiteralSafe {
    param([string]$LiteralPath)
    try { return (Test-Path -LiteralPath $LiteralPath) }
    catch { return $false }
}

# Venv on Google Drive / OneDrive often hits WinError 5 when copying venvlauncher.exe.
# Keep venv under LOCALAPPDATA (ASCII path, local disk), keyed by full project root.
function Get-StockVenvDirectory {
    param([string]$ProjectRoot)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $norm = $ProjectRoot.TrimEnd('\').ToLowerInvariant()
    $digest = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($norm))
    $suffix = ($digest[0..7] | ForEach-Object { $_.ToString("x2") }) -join ''
    Join-Path $env:LOCALAPPDATA (Join-Path "StockViewerVenv" ("proj_" + $suffix))
}

$VenvDir = Get-StockVenvDirectory -ProjectRoot $Root
$VenvPy = Join-Path $VenvDir "Scripts\python.exe"
$ReqFile = Join-Path $Root "requirements.txt"
$FrontendDir = Join-Path $Root "frontend"

foreach ($rel in @("requirements.txt", "backend\main.py", "frontend\index.html")) {
    $full = Join-Path $Root $rel
    if (-not (Test-PathLiteralSafe -LiteralPath $full)) {
        Write-Host ("ERROR: Missing " + $rel + " (Google Drive / OneDrive may still be syncing).")
        Write-Host ("Project folder: " + $Root)
        exit 1
    }
}

# Pinned installers when winget is missing (update if python.org / nodejs.org layout changes)
$PythonOrgVersion = "3.12.9"
$NodeDistVersion = "20.18.3"

function Write-LineOut {
    param([string]$Message)
    Write-Host $Message
}

# winget / MSI install updates registry PATH; this process does not reload it unless we do.
function Sync-EnvPathFromRegistry {
    try {
        $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
        $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
        $parts = @()
        if ($machinePath) { $parts += $machinePath.TrimEnd(';') }
        if ($userPath) { $parts += $userPath.TrimEnd(';') }
        $env:Path = ($parts -join ';')
    } catch { }
}

function Test-WingetAvailable {
    return [bool](Get-Command winget -ErrorAction SilentlyContinue)
}

function Download-FileBinary {
    param(
        [string]$Url,
        [string]$OutPath
    )
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $ProgressPreference = "SilentlyContinue"
        Invoke-WebRequest -Uri $Url -OutFile $OutPath -UseBasicParsing
        return (Test-Path -LiteralPath $OutPath)
    } catch {
        Write-LineOut ("Download failed: " + $_.Exception.Message)
        return $false
    }
}

function Install-PythonFromPythonOrg {
    $ver = $PythonOrgVersion
    $url = "https://www.python.org/ftp/python/$ver/python-$ver-amd64.exe"
    $exe = Join-Path $env:TEMP ("python-" + $ver + "-amd64.exe")
    Write-LineOut ("Downloading Python " + $ver + " from python.org ...")
    if (-not (Download-FileBinary -Url $url -OutPath $exe)) { return $false }
    Write-LineOut "Running Python installer (quiet, per-user, PATH, pip, py launcher)..."
    $argList = @(
        "/quiet",
        "InstallAllUsers=0",
        "PrependPath=1",
        "Include_test=0",
        "Include_doc=0",
        "Include_pip=1",
        "Include_launcher=1"
    )
    $p = Start-Process -FilePath $exe -ArgumentList $argList -Wait -PassThru -NoNewWindow
    if ($null -eq $p -or $p.ExitCode -ne 0) {
        $code = if ($p) { $p.ExitCode } else { "unknown" }
        Write-LineOut ("Python installer exit code: " + $code)
        return $false
    }
    return $true
}

function Install-NodeFromNodejsOrg {
    $ver = $NodeDistVersion
    $url = "https://nodejs.org/dist/v$ver/node-v$ver-x64.msi"
    $msi = Join-Path $env:TEMP ("node-v" + $ver + "-x64.msi")
    Write-LineOut ("Downloading Node.js " + $ver + " from nodejs.org ...")
    if (-not (Download-FileBinary -Url $url -OutPath $msi)) { return $false }
    Write-LineOut "Running Node.js MSI (quiet)..."
    $p = Start-Process -FilePath "msiexec.exe" -ArgumentList @("/i", $msi, "/qn", "/norestart") -Wait -PassThru -NoNewWindow
    if ($null -eq $p) {
        Write-LineOut "msiexec did not return a process handle."
        return $false
    }
    if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) {
        Write-LineOut ("Node MSI exit code: " + $p.ExitCode + " (3010=reboot needed, ok)")
        return $false
    }
    Start-Sleep -Seconds 5
    return $true
}

function Find-PythonExecutable {
    # Prefer 3.12 over 3.13: fewer "pyproject.toml / metadata" pip build failures on Windows.
    foreach ($pyTag in @("-3.12", "-3.13", "-3.11", "-3.10")) {
        try {
            $line = & py $pyTag -c "import sys; print(sys.executable)" 2>$null
            if ($line) {
                $p = ($line | Out-String).Trim()
                if ($p -and (Test-Path -LiteralPath $p)) { return $p }
            }
        } catch { }
    }

    foreach ($ver in @(312, 313, 311, 310)) {
        $candidate = Join-Path $env:LocalAppData "Programs\Python\Python$ver\python.exe"
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }

    $pf86 = ${env:ProgramFiles(x86)}
    foreach ($ver in @(312, 313, 311, 310)) {
        foreach ($base in @($env:ProgramFiles, $pf86)) {
            if (-not $base) { continue }
            $candidate = Join-Path $base "Python$ver\python.exe"
            if (Test-Path -LiteralPath $candidate) { return $candidate }
        }
    }

    $cmdPy = Get-Command python -ErrorAction SilentlyContinue
    if ($cmdPy -and $cmdPy.Source -notmatch "WindowsApps") {
        if (Test-Path -LiteralPath $cmdPy.Source) { return $cmdPy.Source }
    }

    return $null
}

function Ensure-Python {
    $py = Find-PythonExecutable
    if ($py) { return $py }

    Write-LineOut ""
    if (Test-WingetAvailable) {
        Write-LineOut "Installing Python 3.12 via winget (first run may take several minutes)..."
        $wingetArgs = @(
            "install", "-e", "--id", "Python.Python.3.12",
            "--accept-package-agreements", "--accept-source-agreements"
        )
        & winget @wingetArgs 2>&1 | Out-Host
        if ($LASTEXITCODE) {
            Write-LineOut "winget reported failure; will try python.org download if Python still missing."
        }
        Write-LineOut "Waiting for winget install to register..."
        Start-Sleep -Seconds 12
        Sync-EnvPathFromRegistry
    } else {
        Write-LineOut "winget not found (normal on some Windows 10 / LTSC). Using python.org download instead."
    }

    $py = Find-PythonExecutable
    if ($py) { return $py }

    if (-not (Install-PythonFromPythonOrg)) {
        Write-LineOut "ERROR: Could not install Python. Check internet / firewall, or install manually from python.org"
        exit 1
    }

    Sync-EnvPathFromRegistry
    Write-LineOut "Waiting for Python installer to finish registering..."
    Start-Sleep -Seconds 15
    Sync-EnvPathFromRegistry
    $py = Find-PythonExecutable
    if (-not $py) {
        Write-LineOut ""
        Write-LineOut "Python installed but not detected yet. Close this window and run the launcher .bat again."
        exit 1
    }
    return $py
}

function Test-NodeOk {
    if (Get-Command node -ErrorAction SilentlyContinue) { return $true }
    $pf86 = ${env:ProgramFiles(x86)}
    $paths = @(
        (Join-Path $env:ProgramFiles "nodejs\node.exe"),
        (Join-Path $pf86 "nodejs\node.exe")
    )
    foreach ($np in $paths) {
        if (Test-Path -LiteralPath $np) { return $true }
    }
    return $false
}

function Ensure-NodeOptional {
    if (Test-NodeOk) { return $true }

    Write-LineOut ""
    if (Test-WingetAvailable) {
        Write-LineOut "Installing Node.js LTS via winget (optional for this app)..."
        $wingetArgs = @(
            "install", "-e", "--id", "OpenJS.NodeJS.LTS",
            "--accept-package-agreements", "--accept-source-agreements"
        )
        & winget @wingetArgs 2>&1 | Out-Null
        Start-Sleep -Seconds 8
        if (Test-NodeOk) { return $true }
        Write-LineOut "winget Node install missing or failed; trying nodejs.org MSI..."
    } else {
        Write-LineOut "winget not found; optional Node.js will be installed from nodejs.org if download works."
    }

    if (-not (Install-NodeFromNodejsOrg)) {
        return $false
    }
    return (Test-NodeOk)
}

function Stop-ListenersOnPorts {
    param([int[]]$Ports)
    $hasNetTcp = $null -ne (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)
    foreach ($port in $Ports) {
        if ($hasNetTcp) {
            try {
                $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
                foreach ($c in $listeners) {
                    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
                }
            } catch { }
        } else {
            $raw = netstat -aon 2>$null | Out-String
            foreach ($line in ($raw -split "`n")) {
                if ($line -match "LISTENING" -and $line -match ":$port\s") {
                    $tok = ($line -split "\s+") | Where-Object { $_ -ne "" }
                    $pidStr = $tok[-1]
                    if ($pidStr -match "^\d+$") {
                        Start-Process -FilePath "taskkill.exe" -ArgumentList @("/F", "/PID", $pidStr) -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue
                    }
                }
            }
        }
    }
}

function Wait-BackendHealth {
    param([int]$MaxSeconds = 50)
    $url = "http://127.0.0.1:8000/api/health"
    $deadline = (Get-Date).AddSeconds($MaxSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($resp.StatusCode -eq 200) { return $true }
        } catch { }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Start-StockCmdWindow {
    param(
        [string]$Title,
        [string]$WorkingDirectory,
        [string[]]$CmdArguments
    )
    $pyQuoted = '"' + $VenvPy + '"'
    $argTail = ($CmdArguments | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }) -join ' '
    $inner = 'title ' + $Title + ' & ' + $pyQuoted + ' ' + $argTail
    Start-Process -FilePath "cmd.exe" -ArgumentList @('/k', $inner) -WorkingDirectory $WorkingDirectory
}

function Read-PyvenvHome {
    $cfgPath = Join-Path $VenvDir "pyvenv.cfg"
    if (-not (Test-PathLiteralSafe -LiteralPath $cfgPath)) { return $null }
    foreach ($line in Get-Content -LiteralPath $cfgPath) {
        if ($line -match '^\s*home\s*=\s*(.+)\s*$') {
            return $matches[1].Trim().TrimEnd('\')
        }
    }
    return $null
}

function Ensure-StockVenv {
    param([string]$GlobalPythonExe)
    $expectedHome = (Split-Path -Parent $GlobalPythonExe).Trim().TrimEnd('\')
    $recreate = $false

    if (-not (Test-PathLiteralSafe -LiteralPath $VenvPy)) {
        $recreate = $true
    } else {
        $cfgHome = Read-PyvenvHome
        if (-not $cfgHome) {
            $recreate = $true
        } elseif ($cfgHome -ine $expectedHome) {
            Write-LineOut ""
            Write-LineOut "Venv points to another Python install or user. Recreating venv for this machine."
            $recreate = $true
        } else {
            & $VenvPy -c "import sys; sys.exit(0)" 2>$null
            if ($LASTEXITCODE -ne 0) {
                Write-LineOut ""
                Write-LineOut "Venv python.exe failed to run; recreating venv."
                $recreate = $true
            }
        }
    }

    if ($recreate -and (Test-PathLiteralSafe -LiteralPath $VenvDir)) {
        Write-LineOut "Removing old venv folder (under LOCALAPPDATA) ..."
        Remove-Item -LiteralPath $VenvDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    if (-not (Test-PathLiteralSafe -LiteralPath $VenvPy)) {
        Write-LineOut ""
        Write-LineOut ("Creating venv at: " + $VenvDir)
        # Call python in-process so errors print here (Start-Process hid failures on some PCs).
        & $GlobalPythonExe -m venv $VenvDir
        if ($LASTEXITCODE -ne 0 -or -not (Test-PathLiteralSafe -LiteralPath $VenvPy)) {
            Write-LineOut ("ERROR: python -m venv failed (exit " + $LASTEXITCODE + "). Store aliases: Settings > Apps > Advanced app settings > App execution aliases > OFF python.exe / python3.exe.")
            exit 1
        }
    }

    $legacy = Join-Path $Root ".venv"
    if (Test-PathLiteralSafe -LiteralPath $legacy) {
        Write-LineOut ""
        Write-LineOut "NOTE: An old .venv folder still exists under the project (e.g. Google Drive). You may delete it manually to free space; the launcher uses LOCALAPPDATA only."
    }
}

Write-LineOut "==============================================="
Write-LineOut "  Stock viewer - install if needed, then start"
Write-LineOut "==============================================="
Write-LineOut ""

if (Test-WingetAvailable) {
    Write-LineOut "winget: available (will use for Python/Node when possible)."
} else {
    Write-LineOut "winget: not found - will download Python/Node from official sites if missing (needs internet)."
}
Write-LineOut ""

$globalPy = Ensure-Python
Write-LineOut ("Found Python: " + $globalPy)

Ensure-StockVenv -GlobalPythonExe $globalPy

Write-LineOut ""
Write-LineOut "pip install -r requirements.txt (may take a while the first time)"
Push-Location -LiteralPath $Root
try {
    & $VenvPy -m pip install --upgrade pip setuptools wheel
    if ($LASTEXITCODE -ne 0) {
        Write-LineOut "WARN: pip/setuptools upgrade failed; continuing."
    }
    & $VenvPy -m pip install -r $ReqFile
    if ($LASTEXITCODE -ne 0) {
        Write-LineOut ""
        Write-LineOut "ERROR: pip install failed. Common fixes:"
        Write-LineOut "  1) Install Python 3.12 (winget install Python.Python.3.12), delete venv folder under %LOCALAPPDATA%\\StockViewerVenv\\proj_* for this project, re-run this launcher."
        Write-LineOut "  2) Do NOT use requirements-streamlit.txt unless you need Streamlit; that stack is heavier and fails more often on Python 3.13."
        exit 1
    }
} finally {
    Pop-Location
}

$nodeOk = Ensure-NodeOptional
if ($nodeOk) {
    Write-LineOut "Node.js is available."
} else {
    Write-LineOut "Note: Node.js not required for this app (Python only)."
}

Write-LineOut ""
Write-LineOut "Step 1/3: Free ports 8000 and 8765..."
Stop-ListenersOnPorts -Ports @(8000, 8765)

Write-LineOut ""
Write-LineOut "Step 2/3: Start backend, frontend, telegram bot..."

Start-StockCmdWindow -Title "Stock Backend API" -WorkingDirectory $Root -CmdArguments @("backend\main.py")
Start-Sleep -Seconds 2
Write-LineOut "Waiting for backend (127.0.0.1:8000) to answer..."
if (-not (Wait-BackendHealth -MaxSeconds 55)) {
    Write-LineOut "WARN: Backend did not respond yet. Keep the Stock Backend API window open; reload the page when you see Uvicorn running."
} else {
    Write-LineOut "Backend is up."
}

Start-StockCmdWindow -Title "Stock Frontend UI" -WorkingDirectory $FrontendDir -CmdArguments @("-m", "http.server", "8765")

$dotEnv = Join-Path $Root ".env"
if (Test-PathLiteralSafe -LiteralPath $dotEnv) {
    # Do not use '" inside a single-quoted PS string (it ends the string). Use Format:
    $botInner = [string]::Format('title Stock Telegram Bot & echo Set TELEGRAM_BOT_TOKEN in .env & "{0}" telegram_bot.py', $VenvPy)
    Start-Process -FilePath "cmd.exe" -ArgumentList @('/k', $botInner) -WorkingDirectory $Root
} else {
    Write-LineOut "Telegram bot skipped (no .env). Web UI still runs. Copy .env here to enable the bot."
}

Write-LineOut ""
Write-LineOut "Step 3/3: Opening browser (127.0.0.1:8765)..."
Start-Sleep -Seconds 1
Start-Process "http://127.0.0.1:8765"

Write-LineOut ""
Write-LineOut "Servers started. Close each CMD window to stop that service."
Write-LineOut "Telegram bot needs TELEGRAM_BOT_TOKEN in .env file."
Write-LineOut ""
Write-LineOut "Press any key to close this window (servers keep running)..."
try {
    if ($Host.UI -and $Host.UI.RawUI) {
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } else {
        Read-Host "Press Enter"
    }
} catch {
    Read-Host "Press Enter"
}

exit 0
