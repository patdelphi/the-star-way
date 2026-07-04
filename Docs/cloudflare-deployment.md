# Cloudflare 部署指南

本文档描述 the-star-way 项目的 Cloudflare 双架构部署流程，包括 Worker API、D1 数据库和前端 Pages 的发布。

## 1. 架构概览

```
┌──────────────────────────────────────────────────────────┐
│  前端（Cloudflare Pages）                                  │
│  - React 19 + Vite                                        │
│  - 通过 VITE_API_BASE 指向 Worker API                      │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTPS
                         ▼
┌──────────────────────────────────────────────────────────┐
│  Worker API（Cloudflare Workers）                          │
│  - 路由、CORS、错误处理                                    │
│  - GitHub 同步（最多 10 页 = 1000 条）                     │
│  - MVP 只读查询 + 轻量同步                                 │
└────────────────────────┬─────────────────────────────────┘
                         │ 绑定
                         ▼
┌──────────────────────────────────────────────────────────┐
│  D1 数据库                                                │
│  - users / repos / stars / repo_tags / sync_runs          │
│  - translations / analysis_reports（第二阶段启用）          │
└──────────────────────────────────────────────────────────┘
```

## 2. 前置条件

- Cloudflare 账号（免费版即可，D1 免费额度：5GB 存储 + 500 万次/天读 + 10 万次/天写）
- 已安装 Wrangler CLI（项目内已集成，可直接 `npx wrangler`）
- GitHub 仓库写权限（用于 CI/CD 自动部署）

## 3. 一次性初始化

### 3.1 登录 Cloudflare

```bash
cd cloudflare/worker
npx wrangler login
```

浏览器会打开授权页面，授权后返回终端确认。

### 3.2 创建 D1 数据库

```bash
npx wrangler d1 create starway-db
```

命令输出会包含 `database_id`，形如：
```
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**将这个 database_id 写入 `cloudflare/worker/wrangler.toml`**：

```toml
[[d1_databases]]
binding = "DB"
database_name = "starway-db"
database_id = "替换为上一步获取的真实 ID"
```

### 3.3 执行数据库迁移

将初始化 schema 应用到 D1：

```bash
# 生产环境
npx wrangler d1 execute starway-db --remote --file=../d1/migrations/0001_init.sql

# 开发环境（本地 D1 模拟）
npx wrangler d1 execute starway-db --local --file=../d1/migrations/0001_init.sql
```

验证表已创建：

```bash
npx wrangler d1 execute starway-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

应看到 6 张表：`users`、`repos`、`stars`、`repo_tags`、`translations`、`analysis_reports`、`sync_runs`。

### 3.4 配置 Worker Secrets

GitHub Token 必须通过 secret 注入，不要写入代码或 wrangler.toml：

```bash
npx wrangler secret put STARWAY_GITHUB_TOKEN
```

按提示粘贴 GitHub Personal Access Token（建议 fine-grained token，仅需 `read:user` 和 `public_repo` 权限）。

第二阶段启用 AI 时再配置：

```bash
npx wrangler secret put STARWAY_AI_API_KEY
npx wrangler secret put STARWAY_AI_BASE_URL
npx wrangler secret put STARWAY_AI_MODEL
```

## 4. 部署 Worker API

### 4.1 手动部署

```bash
cd cloudflare/worker
npx wrangler deploy
```

部署成功后会输出 Worker URL，形如：
```
https://the-star-way-api.<your-subdomain>.workers.dev
```

### 4.2 验证部署

```bash
# 测试用户列表接口
curl https://the-star-way-api.<your-subdomain>.workers.dev/api/users

# 测试状态接口
curl https://the-star-way-api.<your-subdomain>.workers.dev/api/status
```

预期返回：
```json
{
  "data": {
    "github": { "configured": true, "valid": true, "source": "STARWAY_GITHUB_TOKEN" },
    "ai": { "configured": false, "valid": false }
  }
}
```

### 4.3 本地开发调试

```bash
cd cloudflare/worker
npx wrangler dev
```

会在 `http://localhost:8787` 启动本地 Worker，使用本地 D1 模拟数据。

## 5. 部署前端到 Pages

### 5.1 构建前端

```bash
cd frontend
# 设置 VITE_API_BASE 指向 Worker URL
# Windows PowerShell
$env:VITE_API_BASE="https://the-star-way-api.<your-subdomain>.workers.dev"
# macOS/Linux
export VITE_API_BASE="https://the-star-way-api.<your-subdomain>.workers.dev"

pnpm install
pnpm build
```

构建产物在 `frontend/dist`。

### 5.2 手动部署到 Pages

首次创建 Pages 项目：

```bash
cd frontend
npx wrangler pages project create the-star-way-frontend
```

部署：

```bash
npx wrangler pages deploy dist --project-name=the-star-way-frontend
```

部署成功后会输出 Pages URL，形如：
```
https://the-star-way-frontend.pages.dev
```

### 5.3 通过 Dashboard 绑定自定义域名（可选）

在 Cloudflare Dashboard → Pages → the-star-way-frontend → Custom domains 中绑定自有域名。

## 6. CI/CD 自动部署

项目已配置 GitHub Actions 自动部署（见 `.github/workflows/deploy-cloudflare.yml`）。

### 6.1 在 GitHub 配置 Secrets

仓库 Settings → Secrets and variables → Actions → New repository secret，添加：

| Secret 名 | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（需 Workers、Pages、D1 权限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID（Dashboard 右下角可见） |
| `D1_DATABASE_ID` | D1 数据库 ID（步骤 3.2 获取） |

### 6.2 触发条件

- 推送到 `main` 分支且修改了 `cloudflare/`、`shared/`、`frontend/` 任一目录时自动部署
- 手动在 Actions 页面触发 `Deploy to Cloudflare` workflow

### 6.3 部署流程

1. 安装依赖
2. 运行测试（Worker 测试 + 前端 build）
3. 部署 Worker（`wrangler deploy`）
4. 构建前端（带 `VITE_API_BASE` 环境变量）
5. 部署 Pages（`wrangler pages deploy`）

### 6.4 创建 Cloudflare API Token

Dashboard → My Profile → API Tokens → Create Token → Custom token，权限：

- Account - Workers Scripts - Edit
- Account - Workers KV Storage - Edit（如启用 KV）
- Account - D1 - Edit
- Account - Cloudflare Pages - Edit

## 7. 数据库迁移流程

D1 表结构变更时，按以下流程执行：

1. 在 `cloudflare/d1/migrations/` 新建 `0002_xxx.sql`（递增编号）
2. 本地测试：`npx wrangler d1 execute starway-db --local --file=../d1/migrations/0002_xxx.sql`
3. 提交代码并走 Code Review
4. 部署前手动执行到生产：`npx wrangler d1 execute starway-db --remote --file=../d1/migrations/0002_xxx.sql`
5. 验证表结构变更生效

**注意**：D1 不支持 `ALTER TABLE DROP COLUMN`，需要用「创建新表 → 迁移数据 → 删除旧表 → 重命名」流程。

## 8. 监控与日志

### 8.1 查看实时日志

```bash
npx wrangler tail
```

实时输出 Worker 的 console.log 和异常堆栈。

### 8.2 查看 D1 查询日志

Dashboard → Workers & Pages → the-star-way-api → Logs → Real-time。

### 8.3 关键指标

- Worker 请求数：Dashboard → Workers → Analytics
- D1 读写次数：Dashboard → D1 → starway-db → Metrics
- Worker CPU 时间：单次请求默认上限 10ms（免费）/ 30ms（付费）

## 9. MVP 阶段限制

当前 Worker MVP 阶段有以下限制，部署前需向用户说明：

| 功能 | 状态 | 说明 |
|---|---|---|
| 只读查询（用户、仓库、统计、标签、时间轴） | 已启用 | 与 Node 后端等价 |
| GitHub 同步 | 已启用（限制） | 最多 10 页 = 1000 条仓库 |
| 规则分类（classify） | 已启用 | 与 Node 后端共用 shared/classifier |
| AI 摘要、Star DNA、学习路径 | 返回 501 | 第二阶段启用 |
| 相似项目推荐 | 返回 501 | 第二阶段启用 |
| 导出 CSV/JSON/MD/HTML | 返回 501 | 建议继续用 Node 后端导出 |
| 删除用户 | 返回 501 | 避免误操作 |
| 仓库标签管理（增删） | 返回 501 | 第二阶段启用 |

## 10. 回滚

### 10.1 Worker 回滚

```bash
# 列出历史版本
npx wrangler deployments list

# 回滚到指定版本
npx wrangler rollback <version-id>
```

### 10.2 D1 回滚

D1 不支持自动回滚，需要：
1. 备份当前数据：`npx wrangler d1 execute starway-db --remote --command=".dump" > backup.sql`
2. 手动编写反向 migration SQL
3. 执行反向 migration

### 10.3 Pages 回滚

Dashboard → Pages → the-star-way-frontend → Deployments → 选择历史版本 → Rollback to this deployment。

## 11. 常见问题

### 11.1 Worker 部署失败：database_id 未替换

错误信息：`D1_ERROR: database not found`

原因：`wrangler.toml` 中的 `database_id` 仍为 `REPLACE_WITH_REAL_DATABASE_ID`。

解决：按步骤 3.2 创建 D1 数据库并替换真实 ID。

### 11.2 同步失败：401 Unauthorized

原因：`STARWAY_GITHUB_TOKEN` 未配置或已过期。

解决：
```bash
npx wrangler secret list  # 确认 secret 存在
npx wrangler secret put STARWAY_GITHUB_TOKEN  # 重新配置
```

### 11.3 Worker 超时：CPU limit exceeded

原因：同步仓库数量过多，单次请求超过 Worker CPU 时间限制。

解决：
- Worker 同步已限制为 10 页（1000 条），超出的部分需在 Node 后端继续同步
- 升级到 Workers Paid Plan（$5/月）可将 CPU 限制从 10ms 提升到 30ms

### 11.4 D1 写入失败：too many SQL variables

原因：单条 SQL 绑定变量超过 D1 上限。

解决：已在 `markRemovedStars` 中通过分批 UPDATE 规避；如新增批量写入方法需注意此限制。

## 12. 相关文件

- `cloudflare/worker/wrangler.toml` - Worker 配置
- `cloudflare/worker/src/index.ts` - Worker 入口
- `cloudflare/worker/src/routes.ts` - 路由处理器
- `cloudflare/worker/src/d1-repository.ts` - D1 数据访问层
- `cloudflare/worker/src/github-sync.ts` - GitHub 同步流程
- `cloudflare/d1/migrations/0001_init.sql` - 数据库初始化 schema
- `.github/workflows/deploy-cloudflare.yml` - CI/CD 自动部署配置
- `Docs/dual-architecture-cloudflare-plan.md` - 双架构改造完整方案
