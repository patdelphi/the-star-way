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
    $inUse = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
    if (-not $inUse) { return $p }
    $p++
  }
  throw "未找到可用端口（从 $Start 开始）"
}

function Kill-Port {
  param([int]$Port)
  $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
  foreach ($c in $conn) {
    if ($c.OwningProcess -gt 0) {
      Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }
}

function Cleanup-Previous {
  if (Test-Path $PidFile) {
    try {
      $saved = Get-Content $PidFile | ConvertFrom-Json
      if ($saved.backend) { Stop-Process -Id $saved.backend -Force -ErrorAction SilentlyContinue }
      if ($saved.frontend) { Stop-Process -Id $saved.frontend -Force -ErrorAction SilentlyContinue }
    } catch {}
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
  }
}

function Wait-Up {
  param([string]$Url, [int]$Timeout = 30)
  $deadline = (Get-Date).AddSeconds($Timeout)
  do {
    try {
      $r = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 2 -UseBasicParsing
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return }
    } catch { Start-Sleep -Milliseconds 300 }
  } while ((Get-Date) -lt $deadline)
  throw "服务启动超时: $Url"
}

# ---- 清理上次残留 ----
Cleanup-Previous

# ---- 端口顺延 ----
$actualBackend = Find-AvailablePort $BackendPort
$actualFrontend = Find-AvailablePort $FrontendPort

if ($actualBackend -ne $BackendPort) {
  Write-Host "后端端口 $BackendPort 被占用，已顺延至 $actualBackend"
}
if ($actualFrontend -ne $FrontendPort) {
  Write-Host "前端端口 $FrontendPort 被占用，已顺延至 $actualFrontend"
}

# ---- 检查依赖 ----
if (-not (Test-Path $BackendDir)) { throw "缺少后端目录" }
if (-not (Test-Path $FrontendDir)) { throw "缺少前端目录" }
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw "未找到 pnpm" }
if (-not (Test-Path (Join-Path $BackendDir "node_modules"))) { throw "后端依赖未安装，请先 cd backend && pnpm install" }
if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) { throw "前端依赖未安装，请先 cd frontend && pnpm install" }

# ---- 启动 ----
$backendCmd = "`$env:PORT='$actualBackend'; pnpm exec tsx 'src/api/start.ts'"
$frontendCmd = "`$env:VITE_API_BASE='http://localhost:$actualBackend'; pnpm exec vite --host 127.0.0.1 --port $actualFrontend"

$backendProc = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command $backendCmd" -WorkingDirectory $BackendDir -WindowStyle Hidden -PassThru
$frontendProc = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command $frontendCmd" -WorkingDirectory $FrontendDir -WindowStyle Hidden -PassThru

# ---- 保存 PID ----
if (-not (Test-Path $RuntimeDir)) { New-Item -ItemType Directory -Path $RuntimeDir | Out-Null }
@{ backend = $backendProc.Id; frontend = $frontendProc.Id } | ConvertTo-Json | Set-Content $PidFile

# ---- 注册退出清理 ----
$stopBoth = {
  if ($backendProc -and -not $backendProc.HasExited) { Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue }
  if ($frontendProc -and -not $frontendProc.HasExited) { Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue }
  if (Test-Path $PidFile) { Remove-Item $PidFile -Force -ErrorAction SilentlyContinue }
}
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { $stopBoth.Invoke() } | Out-Null

# ---- 等待就绪 ----
try {
  Wait-Up "http://localhost:$actualBackend/api/users" -Timeout 30
  Wait-Up "http://localhost:$actualFrontend/" -Timeout 20
} catch {
  $stopBoth.Invoke()
  throw $_
}

# ---- 输出 ----
Write-Host ""
Write-Host "后端: http://localhost:$actualBackend/"
Write-Host "前端: http://localhost:$actualFrontend/"
Write-Host "按 Ctrl+C 停止"
if ($OpenBrowser) { Start-Process "http://localhost:$actualFrontend/" }

# ---- 保持运行，直到被终止 ----
try {
  while ($true) {
    Start-Sleep -Seconds 1
    if ($backendProc.HasExited -and $frontendProc.HasExited) { break }
  }
} finally {
  $stopBoth.Invoke()
}
