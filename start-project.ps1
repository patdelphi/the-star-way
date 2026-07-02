param(
  [int]$BackendPort = 3210,
  [int]$FrontendPort = 5173,
  [switch]$OpenBrowser
)

# 程序说明：启动 the-star-way 后端和前端，并固定 Node/pnpm 入口，避免 native 模块 ABI 混用。
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$RuntimeDir = Join-Path $ProjectRoot ".runtime"
$PidFile = Join-Path $RuntimeDir "pids.json"
$RequiredNodeVersion = "24.15.0"

function Find-AvailablePort {
  param([int]$Start)
  $p = $Start
  while ($p -le 65535) {
    $inUse = @(Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" })
    if ($inUse.Count -eq 0) { return $p }
    $p++
  }
  throw "No available port starting from $Start"
}

function Cleanup-Previous {
  if (Test-Path $PidFile) {
    try {
      $saved = Get-Content $PidFile -Raw | ConvertFrom-Json
      if ($saved.backend) { Stop-Process -Id $saved.backend -Force -ErrorAction SilentlyContinue }
      if ($saved.frontend) { Stop-Process -Id $saved.frontend -Force -ErrorAction SilentlyContinue }
    } catch {}
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
  }
}

function Wait-Ready {
  param([string]$Url, [int]$Timeout = 30)
  $deadline = (Get-Date).AddSeconds($Timeout)
  do {
    try {
      $r = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 2 -UseBasicParsing
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $true }
    } catch { Start-Sleep -Milliseconds 300 }
  } while ((Get-Date) -lt $deadline)
  return $false
}

function Show-Log {
  param([string]$Path)
  if (Test-Path $Path) {
    Get-Content $Path -Tail 20
  }
}

function Resolve-RequiredCommand {
  param([string]$Name)
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $cmd) { throw "$Name not found" }
  if (-not $cmd.Source) { throw "$Name path not resolved" }
  return $cmd.Source
}

function Resolve-PnpmCommand {
  param([string]$NodeDir)
  $corepack = Join-Path $NodeDir "corepack.cmd"
  if (Test-Path $corepack) {
    return @{ Command = $corepack; PrefixArgs = @("pnpm") }
  }

  $pnpm = Resolve-RequiredCommand "pnpm"
  return @{ Command = $pnpm; PrefixArgs = @() }
}

function Assert-NodeVersion {
  param([string]$NodeCmd, [string]$RequiredVersion)
  $actualVersion = (& $NodeCmd -p "process.versions.node").Trim()
  if ($actualVersion -ne $RequiredVersion) {
    throw "Node.js version mismatch. Required v$RequiredVersion, current v$actualVersion at $NodeCmd. Use the project .node-version/.nvmrc and rerun corepack pnpm rebuild better-sqlite3."
  }
}

function Initialize-LogFile {
  param([string]$Path, [string]$Prefix)
  try {
    Set-Content -Path $Path -Value "" -Encoding UTF8 -ErrorAction Stop
    return $Path
  } catch {
    # 旧进程可能仍持有日志文件句柄，改用本次启动专属日志，避免启动流程被旧日志阻塞。
    $fallback = Join-Path $RuntimeDir "$Prefix-$PID.log"
    Set-Content -Path $fallback -Value "" -Encoding UTF8
    return $fallback
  }
}

# ===== Main =====
try {
  Cleanup-Previous

  $actualBackend = Find-AvailablePort $BackendPort
  $actualFrontend = Find-AvailablePort $FrontendPort

  if (-not (Test-Path $BackendDir)) { throw "Missing backend dir: $BackendDir" }
  if (-not (Test-Path $FrontendDir)) { throw "Missing frontend dir: $FrontendDir" }
  $NodeCmd = Resolve-RequiredCommand "node"
  Assert-NodeVersion $NodeCmd $RequiredNodeVersion
  $NodeDir = Split-Path -Parent $NodeCmd
  $PnpmRuntime = Resolve-PnpmCommand $NodeDir
  $PnpmCmd = $PnpmRuntime.Command
  $PnpmArgsPrefix = $PnpmRuntime.PrefixArgs
  $env:PATH = "$NodeDir;$env:PATH"
  $env:STARWAY_NODE_CMD = $NodeCmd
  $env:STARWAY_PNPM_CMD = $PnpmCmd
  if (-not (Test-Path (Join-Path $BackendDir "node_modules"))) { throw "Backend deps missing: cd backend && corepack pnpm install" }
  if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) { throw "Frontend deps missing: cd frontend && corepack pnpm install" }
  $BackendTsx = Join-Path $BackendDir "node_modules\tsx\dist\cli.mjs"
  $FrontendVite = Join-Path $FrontendDir "node_modules\vite\bin\vite.js"
  if (-not (Test-Path $BackendTsx)) { throw "Backend tsx CLI missing: $BackendTsx" }
  if (-not (Test-Path $FrontendVite)) { throw "Frontend vite CLI missing: $FrontendVite" }

  if (-not (Test-Path $RuntimeDir)) { New-Item -ItemType Directory -Path $RuntimeDir | Out-Null }
  $backendLog = Join-Path $RuntimeDir "backend.log"
  $frontendLog = Join-Path $RuntimeDir "frontend.log"
  $backendLog = Initialize-LogFile $backendLog "backend"
  $frontendLog = Initialize-LogFile $frontendLog "frontend"

  Write-Host "Starting..."

  # 检查 native 模块：用后续启动后端的同一个 Node ABI 进行加载验证。
  Write-Host "Checking native modules..."
  Push-Location $BackendDir
  $nativeCheckOutput = & $NodeCmd -e "const Database = require('better-sqlite3'); new Database(':memory:').close()" 2>&1
  $nativeCheckExit = $LASTEXITCODE
  if ($nativeCheckExit -ne 0) {
    Write-Host "Rebuilding better-sqlite3 for Node.js $((& $NodeCmd -v).Trim()) ..."
    $rebuildOutput = & $PnpmCmd @PnpmArgsPrefix rebuild better-sqlite3 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-Host "--- native check error ---" -ForegroundColor Yellow
      $nativeCheckOutput | Select-Object -Last 20
      Write-Host "--- rebuild error ---" -ForegroundColor Yellow
      $rebuildOutput | Select-Object -Last 40
      throw "better-sqlite3 rebuild failed. Try manually: cd backend && corepack pnpm rebuild better-sqlite3"
    }
    Write-Host "Rebuild done."
  }
  Pop-Location

  # 子进程复用父进程解析出的绝对路径，避免 PowerShell 在不同 PATH 下找到另一套 pnpm/node。
  $backendCmd = "Set-Location '$BackendDir'; `$env:PATH='$NodeDir;' + `$env:PATH; `$env:PORT='$actualBackend'; & `$env:STARWAY_NODE_CMD -p `"process.version + ' modules=' + process.versions.modules + ' exec=' + process.execPath`"; & `$env:STARWAY_NODE_CMD '$BackendTsx' src/api/start.ts *>&1 | Tee-Object -FilePath '$backendLog'"
  $backendProc = Start-Process -FilePath "powershell" -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-Command",$backendCmd) -WindowStyle Hidden -PassThru
  Write-Host "Backend PID: $($backendProc.Id)"

  # Launch frontend
  $frontendCmd = "Set-Location '$FrontendDir'; `$env:PATH='$NodeDir;' + `$env:PATH; `$env:VITE_API_BASE='http://localhost:$actualBackend'; & `$env:STARWAY_NODE_CMD -p `"process.version + ' modules=' + process.versions.modules + ' exec=' + process.execPath`"; & `$env:STARWAY_NODE_CMD '$FrontendVite' --host 127.0.0.1 --port $actualFrontend *>&1 | Tee-Object -FilePath '$frontendLog'"
  $frontendProc = Start-Process -FilePath "powershell" -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-Command",$frontendCmd) -WindowStyle Hidden -PassThru
  Write-Host "Frontend PID: $($frontendProc.Id)"

  # Save PID
  @{ backend = $backendProc.Id; frontend = $frontendProc.Id } | ConvertTo-Json | Set-Content $PidFile

  # Wait backend
  if (-not (Wait-Ready "http://localhost:$actualBackend/api/users" -Timeout 30)) {
    Write-Host ""
    Write-Host "--- Backend log (last 20 lines) ---" -ForegroundColor Yellow
    Show-Log $backendLog
    Write-Host ""
    throw "Backend startup timeout (30s). See log above."
  }

  # Wait frontend
  if (-not (Wait-Ready "http://localhost:$actualFrontend/" -Timeout 30)) {
    Write-Host ""
    Write-Host "--- Frontend log (last 20 lines) ---" -ForegroundColor Yellow
    Show-Log $frontendLog
    Write-Host ""
    throw "Frontend startup timeout (30s). See log above."
  }

  # Output
  Write-Host ""
  if ($actualBackend -ne $BackendPort) {
    Write-Host "Backend port $BackendPort in use, using $actualBackend" -ForegroundColor Yellow
  }
  if ($actualFrontend -ne $FrontendPort) {
    Write-Host "Frontend port $FrontendPort in use, using $actualFrontend" -ForegroundColor Yellow
  }
  Write-Host "Backend:  http://localhost:$actualBackend/" -ForegroundColor Green
  Write-Host "Frontend: http://localhost:$actualFrontend/" -ForegroundColor Green
  Write-Host ""
  Write-Host "Press Ctrl+C or close window to stop."

  if ($OpenBrowser) { Start-Process "http://localhost:$actualFrontend/" }

  # Keep running
  try {
    while ($true) {
      Start-Sleep -Seconds 2
      if ($backendProc.HasExited) { Write-Host "Backend exited"; break }
      if ($frontendProc.HasExited) { Write-Host "Frontend exited"; break }
    }
  } finally {
    Write-Host "Stopping..."
    if (-not $backendProc.HasExited) { Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue }
    if (-not $frontendProc.HasExited) { Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue }
    if (Test-Path $PidFile) { Remove-Item $PidFile -Force -ErrorAction SilentlyContinue }
  }

} catch {
  Write-Host ""
  Write-Host "STARTUP FAILED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host ""
  Write-Host "Press any key to exit..."
  $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
