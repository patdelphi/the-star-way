# 设置 CLOUDFLARE_API_TOKEN 到 GitHub Secrets
# 使用方法：在项目根目录运行 .\set-cloudflare-token.ps1
# Token 创建地址：https://dash.cloudflare.com/profile/api-tokens
# 权限：Workers Scripts:Edit, D1:Edit, Pages:Edit, Account Settings:Read

$token = Read-Host "请粘贴 Cloudflare API Token" -AsSecureString
$plain = [System.Net.NetworkCredential]::new("", $token).Password
if ([string]::IsNullOrWhiteSpace($plain)) {
    Write-Host "Token 为空，已取消" -ForegroundColor Yellow
    exit 1
}
gh secret set CLOUDFLARE_API_TOKEN --body $plain
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ CLOUDFLARE_API_TOKEN 已配置到 GitHub Secrets" -ForegroundColor Green
    gh secret list
} else {
    Write-Host "❌ 配置失败" -ForegroundColor Red
}
