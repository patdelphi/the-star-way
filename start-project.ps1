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
  throw "未找到可用端口（从 $Start 开始）"
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

# ===== 主流程 =====
try {
  # 清理上次残留
  Cleanup-Previous

  # 端口顺延
  $actualBackend = Find-AvailablePort $BackendPort
  $actualFrontend = Find-AvailablePort $FrontendPort

  # 依赖检查
  if (-not (Test-Path $BackendDir)) { throw "缺少后端目录: $BackendDir" }
  if (-not (Test-Path $FrontendDir)) { throw "缺少前端目录: $FrontendDir" }
  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw "未找到 pnpm，请先安装 pnpm" }
  if (-not (Test-Path (Join-Path $BackendDir "node_modules"))) { throw "后端依赖未安装，请先执行: cd backend && pnpm install" }
  if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) { throw "前端依赖未安装，请先执行: cd frontend && pnpm install" }

  Write-Host "启动中..."

  # 启动后端
  $backendCmd = "`$env:PORT='$actualBackend'; pnpm exec tsx 'src/api/start.ts'"
  $backendProc = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command $backendCmd" -WorkingDirectory $BackendDir -WindowStyle Hidden -PassThru
  Write-Host "后端 PID: $($backendProc.Id)"

  # 启动前端
  $frontendCmd = "`$env:VITE_API_BASE='http://localhost:$actualBackend'; pnpm exec vite --host 127.0.0.1 --port $actualFrontend"
  $frontendProc = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command $frontendCmd" -WorkingDirectory $FrontendDir -WindowStyle Hidden -PassThru
  Write-Host "前端 PID: $($frontendProc.Id)"

  # 保存 PID
  if (-not (Test-Path $RuntimeDir)) { New-Item -ItemType Directory -Path $RuntimeDir | Out-Null }
  @{ backend = $backendProc.Id; frontend = $frontendProc.Id } | ConvertTo-Json | Set-Content $PidFile

  # 等待就绪
  if (-not (Wait-Ready "http://localhost:$actualBackend/api/users" -Timeout 30)) {
    Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    throw "后端启动超时（30s），请检查 .runtime 目录下的日志"
  }

  if (-not (Wait-Ready "http://localhost:$actualFrontend/" -Timeout 20)) {
    Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue
    throw "前端启动超时（20s），请检查 .runtime 目录下的日志"
  }

  # 输出结果
  Write-Host ""
  if ($actualBackend -ne $BackendPort) {
    Write-Host "后端端口 $BackendPort 被占用，已顺延至 $actualBackend" -ForegroundColor Yellow
  }
  if ($actualFrontend -ne $FrontendPort) {
    Write-Host "前端端口 $FrontendPort 被占用，已顺延至 $actualFrontend" -ForegroundColor Yellow
  }
  Write-Host "后端: http://localhost:$actualBackend/" -ForegroundColor Green
  Write-Host "前端: http://localhost:$actualFrontend/" -ForegroundColor Green
  Write-Host ""
  Write-Host "按 Ctrl+C 或关闭窗口停止服务"

  if ($OpenBrowser) { Start-Process "http://localhost:$actualFrontend/" }

  # 保持运行
  try {
    while ($true) {
      Start-Sleep -Seconds 2
      if ($backendProc.HasExited) { Write-Host "后端进程已退出"; break }
      if ($frontendProc.HasExited) { Write-Host "前端进程已退出"; break }
    }
  } finally {
    Write-Host "正在停止..."
    if (-not $backendProc.HasExited) { Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue }
    if (-not $frontendProc.HasExited) { Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue }
    if (Test-Path $PidFile) { Remove-Item $PidFile -Force -ErrorAction SilentlyContinue }
  }

} catch {
  Write-Host ""
  Write-Host "启动失败: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host ""
  Write-Host "按任意键退出..."
  $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
