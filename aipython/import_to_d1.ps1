# 批量导入 SQLite 数据到 Cloudflare D1
# 按 依赖顺序执行：users -> repos -> stars -> repo_tags -> translations -> sync_runs
# 每个 SQL 文件用 wrangler d1 execute --file 上传执行

$ErrorActionPreference = "Stop"

# 项目路径
$PROJECT_ROOT = "c:\Users\patde\Documents\GitHub\the-star-way"
$WORKER_DIR = Join-Path $PROJECT_ROOT "cloudflare\worker"
$SYNC_DIR = Join-Path $PROJECT_ROOT "aipython\d1_sync"

# 导入顺序（按外键依赖）
$TABLES_IN_ORDER = @("users", "repos", "stars", "repo_tags", "translations", "sync_runs")

Write-Host "========================================"
Write-Host "SQLite -> D1 批量导入"
Write-Host "========================================"
Write-Host "Worker 目录: $WORKER_DIR"
Write-Host "SQL 文件目录: $SYNC_DIR"
Write-Host ""

# 切换到 worker 目录（wrangler 需要读取 wrangler.toml）
Set-Location $WORKER_DIR
Write-Host "当前工作目录: $(Get-Location)"
Write-Host ""

$totalFiles = 0
$totalSuccess = 0
$totalFailed = 0
$failedFiles = @()

foreach ($table in $TABLES_IN_ORDER) {
    Write-Host "--- 表: $table ---"
    # 匹配该表的所有 SQL 文件（如 users.sql, repos_01.sql, repos_02.sql 等）
    $files = Get-ChildItem -Path $SYNC_DIR -Filter "$table*.sql" | Sort-Object Name

    if ($files.Count -eq 0) {
        Write-Host "  [SKIP] 无 SQL 文件"
        continue
    }

    foreach ($file in $files) {
        $totalFiles++
        $filePath = $file.FullName
        $fileName = $file.Name
        Write-Host -NoNewline "  [import] $fileName ... "

        # 执行 wrangler d1 execute
        $output = npx wrangler d1 execute starway-db --remote --file="$filePath" 2>&1
        $exitCode = $LASTEXITCODE

        if ($exitCode -eq 0) {
            $totalSuccess++
            Write-Host "OK" -ForegroundColor Green
        } else {
            $totalFailed++
            $failedFiles += $fileName
            Write-Host "FAILED (exit $exitCode)" -ForegroundColor Red
            # 输出错误详情（仅前 500 字符）
            $errSnippet = ($output | Out-String).Substring(0, [Math]::Min(500, ($output | Out-String).Length))
            Write-Host "    error: $errSnippet" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host "导入完成"
Write-Host "========================================"
Write-Host "总文件数: $totalFiles"
Write-Host "成功: $totalSuccess"
Write-Host "失败: $totalFailed"

if ($failedFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "失败文件列表:"
    foreach ($f in $failedFiles) {
        Write-Host "  - $f"
    }
}
