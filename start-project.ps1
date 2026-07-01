# 程序说明：一键启动 the-star-way 本地开发环境
# 功能：检查本地依赖与端口，后台启动后端 API 和前端 Vite，并输出访问地址与日志路径。
# 注意：本脚本不安装依赖、不下载文件、不执行数据库迁移、不执行 git 操作。

[CmdletBinding()]
param(
  [int]$BackendPort = 3210,
  [int]$FrontendPort = 5173,
  [switch]$Restart,
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$RuntimeDir = Join-Path $ProjectRoot ".runtime"
$BackendLog = Join-Path $RuntimeDir "backend-api.log"
$BackendErr = Join-Path $RuntimeDir "backend-api.err.log"
$FrontendLog = Join-Path $RuntimeDir "frontend-vite.log"
$FrontendErr = Join-Path $RuntimeDir "frontend-vite.err.log"

function Write-Info {
  param([string]$Message)
  Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Message)
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
  param([string]$Message)
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Test-CommandExists {
  param([string]$CommandName)
  return [bool](Get-Command $CommandName -ErrorAction SilentlyContinue)
}

function Get-ListeningProcesses {
  param([int]$Port)
  return @(Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" })
}

function Stop-ProjectPort {
  param([int]$Port)
  $connections = Get-ListeningProcesses -Port $Port
  foreach ($connection in $connections) {
    $processId = $connection.OwningProcess
    if ($processId -and $processId -gt 0) {
      $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
      if ($process) {
        Stop-Process -Id $processId -Force
        Write-Warn "已停止端口 $Port 上的进程 PID=$processId ($($process.ProcessName))"
      }
    }
  }
}

function Assert-PortFree {
  param([int]$Port, [string]$Name)
  $connections = Get-ListeningProcesses -Port $Port
  if ($connections.Count -gt 0) {
    $owners = ($connections | Select-Object -ExpandProperty OwningProcess -Unique) -join ", "
    throw "$Name 端口 $Port 已被占用，PID: $owners。需要重启请执行：.\start-project.ps1 -Restart"
  }
}

function Wait-HttpReady {
  param(
    [string]$Url,
    [string]$Name,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 3 -UseBasicParsing
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        Write-Ok "$Name 已响应：$Url"
        return
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  } while ((Get-Date) -lt $deadline)

  throw "$Name 启动超时，请查看日志。"
}

function Start-ProjectProcess {
  param(
    [string]$Name,
    [string]$WorkingDirectory,
    [string]$Command,
    [string]$OutputLog,
    [string]$ErrorLog
  )

  $argument = "-NoProfile -ExecutionPolicy Bypass -Command $Command"
  $process = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList $argument `
    -WorkingDirectory $WorkingDirectory `
    -RedirectStandardOutput $OutputLog `
    -RedirectStandardError $ErrorLog `
    -WindowStyle Hidden `
    -PassThru

  Write-Ok "$Name 已启动，PID=$($process.Id)"
  return $process
}

try {
  Write-Info "项目目录：$ProjectRoot"

  if (-not (Test-Path -LiteralPath $BackendDir)) {
    throw "缺少后端目录：$BackendDir"
  }
  if (-not (Test-Path -LiteralPath $FrontendDir)) {
    throw "缺少前端目录：$FrontendDir"
  }
  if (-not (Test-CommandExists -CommandName "pnpm")) {
    throw "未找到 pnpm。请先安装或配置 pnpm 后再运行。"
  }
  if (-not (Test-Path -LiteralPath (Join-Path $BackendDir "node_modules"))) {
    throw "后端依赖目录不存在：$BackendDir\node_modules。请先在 backend 目录执行 pnpm install。"
  }
  if (-not (Test-Path -LiteralPath (Join-Path $FrontendDir "node_modules"))) {
    throw "前端依赖目录不存在：$FrontendDir\node_modules。请先在 frontend 目录执行 pnpm install。"
  }

  if (-not (Test-Path -LiteralPath $RuntimeDir)) {
    New-Item -ItemType Directory -Path $RuntimeDir | Out-Null
  }

  if ($Restart) {
    Stop-ProjectPort -Port $BackendPort
    Stop-ProjectPort -Port $FrontendPort
    Start-Sleep -Milliseconds 500
  }

  Assert-PortFree -Port $BackendPort -Name "后端 API"
  Assert-PortFree -Port $FrontendPort -Name "前端 Vite"

  $backendCommand = "`$env:PORT='$BackendPort'; pnpm exec tsx 'src/api/start.ts'"
  $frontendCommand = "`$env:VITE_API_BASE='http://localhost:$BackendPort'; pnpm exec vite --host 127.0.0.1 --port $FrontendPort"

  Start-ProjectProcess -Name "后端 API" -WorkingDirectory $BackendDir -Command $backendCommand -OutputLog $BackendLog -ErrorLog $BackendErr | Out-Null
  Start-ProjectProcess -Name "前端 Vite" -WorkingDirectory $FrontendDir -Command $frontendCommand -OutputLog $FrontendLog -ErrorLog $FrontendErr | Out-Null

  Wait-HttpReady -Name "后端 API" -Url "http://localhost:$BackendPort/api/users"
  Wait-HttpReady -Name "前端 Vite" -Url "http://localhost:$FrontendPort/"

  Write-Host ""
  Write-Ok "启动完成"
  Write-Host "前端地址：http://localhost:$FrontendPort/"
  Write-Host "后端地址：http://localhost:$BackendPort/"
  Write-Host "后端日志：$BackendLog"
  Write-Host "前端日志：$FrontendLog"

  if ($OpenBrowser) {
    Start-Process "http://localhost:$FrontendPort/"
  }
} catch {
  Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "后端错误日志：$BackendErr"
  Write-Host "前端错误日志：$FrontendErr"
  exit 1
}
