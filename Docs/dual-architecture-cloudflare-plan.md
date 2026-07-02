# the-star-way 双架构 Cloudflare 改造方案

## 1. 目标

在不破坏当前本地优先架构的前提下，新增一套可发布到 Cloudflare 的架构。

最终保留两种运行形态：

| 形态 | 运行环境 | 数据库 | 适用场景 |
|---|---|---|---|
| 本地 / VPS 架构 | Node.js 24 + 本地进程 | better-sqlite3 + SQLite 文件 | 本地分析、批量同步、私有部署、开发调试 |
| Cloudflare 架构 | Pages + Workers | D1 | 在线访问、轻量同步、公开或半公开产品化部署 |

## 2. 当前架构判断

当前项目不能直接原样部署为 Cloudflare Worker，主要原因：

- 后端使用 `node:http` 创建长驻服务，并通过 `server.listen()` 监听端口。
- 数据库使用 `better-sqlite3` native 模块，依赖本地 Node ABI。
- 数据持久化依赖本地文件系统 `data/starway.db`。
- 配置读取依赖本地 `.env` 和 `process.env`。
- 部分同步、导入和导出逻辑默认面向本地运行环境。

这些能力适合本地 / VPS，但不适合 Worker 的请求驱动运行模型。

## 3. 改造原则

1. 保留当前架构，不把现有 `backend` 强行改成 Worker。
2. 新增 Cloudflare 适配层，避免影响本地稳定性。
3. 前端 API 协议尽量保持一致，通过环境变量切换 API 地址。
4. 抽出纯业务逻辑，复用分类、评分、导出、AI prompt 等不依赖运行时的模块。
5. 数据访问层分离：本地 SQLite 一套，Cloudflare D1 一套。
6. Cloudflare 版先做 MVP，不一次性迁移全部能力。

## 4. 推荐目录结构

```text
backend/
  src/
    api/                 # 当前 Node API，继续保留
    db/                  # better-sqlite3 数据访问
    classification/      # 可逐步抽成共享逻辑
    sync/                # 当前 GitHub 同步逻辑

frontend/
  src/                   # 共享前端

shared/
  classification/        # 纯分类规则和标签逻辑
  scoring/               # 仓库评分逻辑
  api-contracts/         # API 类型定义
  prompts/               # AI prompt 模板

cloudflare/
  worker/
    src/
      index.ts           # Worker fetch 入口
      routes.ts          # Worker API 路由
      d1-repository.ts   # D1 数据访问实现
      github-sync.ts     # Worker 版 GitHub 同步
    wrangler.toml
  d1/
    migrations/
    seed/
```

## 5. API 层改造

当前 Node 后端：

```text
IncomingMessage + ServerResponse
```

Cloudflare Worker 后端：

```text
Request -> Response
```

建议新增一个运行时无关的 API 处理层：

```text
ApiRequest
ApiResponse
RepositoryPort
```

本地 Node API 和 Worker API 分别负责适配输入输出：

| 层级 | 本地架构 | Cloudflare 架构 |
|---|---|---|
| HTTP 适配 | `node:http` | Worker `fetch()` |
| 请求对象 | `IncomingMessage` | `Request` |
| 响应对象 | `ServerResponse` | `Response` |
| 路由逻辑 | 可复用一部分 | 可复用一部分 |
| 数据访问 | better-sqlite3 repository | D1 repository |

## 6. 数据库改造

本地版本继续使用：

```text
better-sqlite3 + data/starway.db
```

Cloudflare 版本使用：

```text
Cloudflare D1
```

需要把当前 SQL 操作按业务接口封装，例如：

```ts
interface StarRepository {
  listUsers(): Promise<UserSummary[]>
  getOverview(): Promise<Overview>
  listRepos(params: RepoQuery): Promise<RepoQueryResult>
  upsertSyncedRepos(input: SyncReposInput): Promise<SyncResult>
}
```

然后分别实现：

- `BetterSqliteStarRepository`
- `D1StarRepository`

注意事项：

- D1 是异步 API，当前 `better-sqlite3` 是同步 API，调用链需要改为 `async`。
- D1 支持 SQL，但事务、批量写入和 prepared statement 写法需要单独适配。
- 迁移脚本要独立存放在 `cloudflare/d1/migrations/`。

## 7. 配置与密钥

本地架构继续使用：

```text
.env
STARWAY_GITHUB_TOKEN
STARWAY_AI_BASE_URL
STARWAY_AI_API_KEY
STARWAY_AI_MODEL
```

Cloudflare 架构使用：

```text
wrangler secret put STARWAY_GITHUB_TOKEN
wrangler secret put STARWAY_AI_API_KEY
```

Worker 运行时通过 `env` 读取：

```ts
export interface Env {
  DB: D1Database
  STARWAY_GITHUB_TOKEN?: string
  STARWAY_AI_BASE_URL?: string
  STARWAY_AI_API_KEY?: string
  STARWAY_AI_MODEL?: string
}
```

## 8. 前端改造

前端保持一套代码，通过构建环境区分 API 地址：

```text
VITE_API_BASE_URL=http://localhost:3210
VITE_API_BASE_URL=https://api.example.workers.dev
```

建议前端只依赖 API contract，不感知后端运行形态。

部署方式：

- 本地开发：`corepack pnpm run dev`
- Cloudflare 发布：Cloudflare Pages 构建 `frontend/dist`

## 9. Cloudflare MVP 范围

第一阶段只迁移必要能力：

| 功能 | 是否进入 MVP | 说明 |
|---|---|---|
| 用户列表 | 是 | 从 D1 查询 |
| 全局概览 | 是 | 从 D1 聚合 |
| 星标仓库列表 | 是 | 支持分页、搜索、排序 |
| 标签统计 | 是 | 支持分析页基础图表 |
| GitHub 同步 | 是 | 限制单用户、分页、错误处理 |
| 分类 | 是 | 复用规则分类 |
| AI 摘要 | 可选 | 依赖外部 API，建议放第二阶段 |
| CSV / Markdown 导出 | 可选 | Worker 可做，但先不阻塞 MVP |
| 本地 CSV 导入 | 否 | 保留在本地架构 |

## 10. 迁移步骤

### 阶段 1：边界整理

- 抽出共享类型：用户、仓库、标签、同步结果、统计结果。
- 梳理现有 API 返回结构，形成 `api-contracts`。
- 把分类规则从后端 Node 依赖中剥离为纯函数。

验收标准：

- 本地后端测试通过。
- 前端调用结构不变。
- 分类逻辑在本地和 Worker 中可以共用。

### 阶段 2：D1 Schema 与数据访问

- 将当前 SQLite schema 改写为 D1 migration。
- 新增 `D1StarRepository`。
- 为核心查询补测试或最小验证脚本。

验收标准：

- D1 可创建表。
- 能写入用户、仓库、星标、标签。
- 能读取概览、仓库列表和标签统计。

### 阶段 3：Worker API

- 新建 `cloudflare/worker/src/index.ts`。
- 实现 `/api/users`、`/api/overview`、`/api/users/:login/repos` 等核心路由。
- 接入 D1 repository。

验收标准：

- 本地 `wrangler dev` 可返回核心 API。
- 前端切换 `VITE_API_BASE_URL` 后能读取 Worker API。

### 阶段 4：GitHub 同步

- 实现 Worker 版 GitHub 同步。
- 使用 Worker Secrets 管理 token。
- 增加 GitHub API 限流错误提示。

验收标准：

- 能同步真实 GitHub 用户公开 star 数据。
- D1 中生成一致的用户、仓库、星标记录。
- API 限流时返回明确错误。

### 阶段 5：Cloudflare Pages 发布

- 配置 Pages 构建 `frontend`。
- 配置环境变量 `VITE_API_BASE_URL`。
- Worker 与 Pages 分别发布。

验收标准：

- 线上页面可打开。
- 线上页面可访问 Worker API。
- 不依赖本地后端。

## 11. 风险与取舍

| 风险 | 影响 | 处理方案 |
|---|---|---|
| D1 与 SQLite 行为差异 | 查询结果或事务行为不同 | 数据访问层分离，补核心查询验证 |
| Worker 执行时间限制 | 大量 star 同步可能超时 | 分页同步、分批写入、后续引入 Queue |
| GitHub API 限流 | 同步失败 | 强制支持 token，显示 rate limit |
| AI API 成本与超时 | 页面响应慢 | AI 分析异步化或缓存 |
| 双架构维护成本 | 代码重复 | 只共享纯逻辑，不共享运行时适配 |

## 12. 不建议的方案

不建议把现有 `backend` 直接改造成兼容 Node 和 Worker 的单一后端，原因：

- `better-sqlite3` 与 D1 的调用模型差异很大。
- `node:http` 与 Worker `fetch()` 模型差异明显。
- 强行统一会引入大量条件分支，降低本地架构稳定性。

更稳妥的路线是：

```text
共享业务逻辑 + 两套运行时适配 + 两套数据访问实现
```

## 13. 最终结论

项目可以保留双架构：

- 当前架构作为本地优先版本继续演进。
- Cloudflare 架构作为独立发布版本新增。

第一阶段不要追求完整迁移，先完成 Cloudflare MVP：Pages 前端、Worker API、D1 数据库、真实 GitHub 同步、基础查询与分类。
