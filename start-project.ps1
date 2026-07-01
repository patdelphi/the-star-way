param(
  [int]$BackendPort = 3210,
  [int]$FrontendPort = 5173,
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$RuntimeDir = Join-Path $ProjectRoot ".runtime"
$PidFile = Join-Path $RuntimeDir "pids.json"

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

# ===== Main =====
try {
  Cleanup-Previous

  $actualBackend = Find-AvailablePort $BackendPort
  $actualFrontend = Find-AvailablePort $FrontendPort

  if (-not (Test-Path $BackendDir)) { throw "Missing backend dir: $BackendDir" }
  if (-not (Test-Path $FrontendDir)) { throw "Missing frontend dir: $FrontendDir" }
  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw "pnpm not found" }
  if (-not (Test-Path (Join-Path $BackendDir "node_modules"))) { throw "Backend deps missing: cd backend && pnpm install" }
  if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) { throw "Frontend deps missing: cd frontend && pnpm install" }

  if (-not (Test-Path $RuntimeDir)) { New-Item -ItemType Directory -Path $RuntimeDir | Out-Null }
  $backendLog = Join-Path $RuntimeDir "backend.log"
  $frontendLog = Join-Path $RuntimeDir "frontend.log"

  Write-Host "Starting..."

  # Check & rebuild native modules using pnpm's Node.js
  Write-Host "Checking native modules..."
  Push-Location $BackendDir
  $testErr = pnpm exec node -e "require('better-sqlite3')" 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Rebuilding better-sqlite3..."
    pnpm rebuild better-sqlite3 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "better-sqlite3 rebuild failed. Try manually: cd backend && pnpm rebuild better-sqlite3"
    }
    Write-Host "Rebuild done."
  }
  Pop-Location

  # Launch backend (child powershell, pnpm exec ensures correct Node)
  $backendCmd = "Set-Location '$BackendDir'; `$env:PORT='$actualBackend'; pnpm exec tsx src/api/start.ts *>&1 | Tee-Object -FilePath '$backendLog'"
  $backendProc = Start-Process -FilePath "powershell" -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-Command",$backendCmd) -WindowStyle Hidden -PassThru
  Write-Host "Backend PID: $($backendProc.Id)"

  # Launch frontend
  $frontendCmd = "Set-Location '$FrontendDir'; `$env:VITE_API_BASE='http://localhost:$actualBackend'; pnpm exec vite --host 127.0.0.1 --port $actualFrontend *>&1 | Tee-Object -FilePath '$frontendLog'"
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
  if (-not (Wait-Ready "http://localhost:$actualFrontend/" -Timeout 20)) {
    Write-Host ""
    Write-Host "--- Frontend log (last 20 lines) ---" -ForegroundColor Yellow
    Show-Log $frontendLog
    Write-Host ""
    throw "Frontend startup timeout (20s). See log above."
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
