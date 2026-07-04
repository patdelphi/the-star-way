# the-star-way 双架构 Cloudflare 改造方案

## 1. 目标

在不破坏当前本地优先架构的前提下，新增一套可发布到 Cloudflare 的运行形态。

最终保留两种架构：

| 形态 | 运行环境 | 数据库 | 适用场景 |
|---|---|---|---|
| 本地 / VPS 架构 | Node.js 24.15.0 + 本地进程 | better-sqlite3 + SQLite 文件 | 本地分析、批量同步、私有部署、开发调试 |
| Cloudflare 架构 | Pages + Workers | D1 | 在线访问、轻量同步、公开或半公开产品化部署 |

当前结论：Cloudflare 不是替代本地后端，而是新增一条独立发布路径。

## 2. 当前最新状态

截至 2026-07-04，项目当前状态如下：

- 前端是 `frontend` 下的 React 19 + Vite + TypeScript 应用，API 地址由 `VITE_API_BASE` 控制；未配置时默认同源请求。
- 后端是 `backend` 下的 Node.js + TypeScript 服务，使用 `node:http`、`IncomingMessage`、`ServerResponse`。
- 数据库使用 `better-sqlite3`，默认文件为 `backend/data/starway.db`，连接时启用 `PRAGMA journal_mode = WAL` 和 `PRAGMA synchronous = NORMAL`。
- `.nvmrc` 与 `.node-version` 固定为 `24.15.0`；README 要求 Node.js `v24.15.0`。但 `backend/package.json` 与 `frontend/package.json` 的 `engines.node` 当前仍是 `>=24.14.0 <25`，后续应统一。
- 包管理器声明为 `pnpm@11.7.0`，项目文档要求统一使用 `corepack pnpm`。
- 本机已安装 Wrangler CLI，并已完成 Cloudflare 授权；后续可直接用于 `wrangler dev`、D1 管理和发布流程，但实际部署前仍需单独确认。
- 后端当前 API 已覆盖用户、仓库、统计、标签、同步、AI 分析、相似项目、导出、报告、状态检测等能力。
- GitHub Token fallback 顺序为：请求 body token、`STARWAY_GITHUB_TOKEN`、`GITHUB_TOKEN`、`GH_TOKEN`。
- AI 功能使用 OpenAI-compatible 配置：`STARWAY_AI_BASE_URL`、`STARWAY_AI_API_KEY`、`STARWAY_AI_MODEL`，三项齐全才启用。

## 3. 为什么不能直接部署为 Worker

当前 `backend` 不能原样部署到 Cloudflare Workers，原因是：

- `node:http` 服务依赖长驻进程和 `server.listen()`，Worker 是请求驱动的 `fetch()` 模型。
- `better-sqlite3` 是 native 模块，依赖本地 Node ABI，不能在 Worker 运行时加载。
- SQLite 文件依赖本地文件系统，Worker 不能直接持久化 `backend/data/starway.db`。
- 当前同步、导出、AI 缓存和部分批处理逻辑默认面向本地进程。
- 后端路由大量直接接收 `IncomingMessage` / `ServerResponse`，需要先抽象请求响应边界。

这些限制不影响本地 / VPS 架构，但决定了 Cloudflare 必须走适配层和 D1 数据访问实现。

## 4. 改造原则

1. 保留当前 `backend`，不把 Node 后端强行改成 Worker。
2. Cloudflare 版新增独立入口和适配层，避免影响本地稳定性。
3. 前端保持一套代码，通过 `VITE_API_BASE` 切换 API 地址。
4. 优先共享纯业务逻辑：分类规则、标签字典、API 类型、评分口径、AI prompt。
5. 数据访问层分离：本地 `better-sqlite3` 一套，Cloudflare D1 一套。
6. Cloudflare MVP 先覆盖只读查询和轻量同步，不一次性迁移全部本地能力。
7. 外部 API、AI 调用、同步任务都要有明确超时、异常响应和限流提示。

## 5. 推荐目录结构

```text
backend/
  src/
    api/                 # 当前 Node API，继续保留
    db/                  # better-sqlite3 数据访问与 schema
    repository/          # 当前查询与统计逻辑
    classification/      # 可抽成共享逻辑
    sync/                # 当前 GitHub 同步逻辑
    ai/                  # 当前 AI client 与缓存逻辑
    export/              # 当前本地导出逻辑

frontend/
  src/                   # 共享前端

shared/
  api-contracts/         # 前后端共享类型与响应结构
  classification/        # 纯分类规则和标签逻辑
  scoring/               # Sleep Stars / Hidden Gems 等评分口径
  prompts/               # AI prompt 模板

cloudflare/
  worker/
    src/
      index.ts           # Worker fetch 入口
      routes.ts          # Worker API 路由
      d1-repository.ts   # D1 数据访问实现
      github-sync.ts     # Worker 版 GitHub 同步
      env.ts             # Worker env 类型与配置读取
    wrangler.toml
  d1/
    migrations/
    seed/
```

## 6. API 边界

当前 Node 后端使用：

```text
IncomingMessage + ServerResponse
```

Cloudflare Worker 使用：

```text
Request -> Response
```

建议新增运行时无关的核心处理层：

```ts
interface ApiRequest {
  method: string
  pathname: string
  query: URLSearchParams
  body?: unknown
}

interface ApiResponse<T = unknown> {
  status: number
  body: T
  headers?: Record<string, string>
}

interface StarRepository {
  listUsers(): Promise<UserSummary[]>
  getOverview(options?: ThresholdOptions): Promise<Overview>
  listRepos(login: string, params: RepoQueryParams): Promise<RepoQueryResult>
  getRepo(login: string, fullName: string): Promise<RepoDetail | null>
  listTags(login: string, lang: 'zh' | 'en'): Promise<TagSummary[]>
}
```

本地 Node API 和 Worker API 分别负责把运行时对象适配为上述结构。

| 层级 | 本地架构 | Cloudflare 架构 |
|---|---|---|
| HTTP 适配 | `node:http` | Worker `fetch()` |
| 请求对象 | `IncomingMessage` | `Request` |
| 响应对象 | `ServerResponse` | `Response` |
| 数据访问 | `better-sqlite3` repository | D1 repository |
| 配置读取 | `.env` + `process.env` | Worker `env` + secrets |

## 7. 当前 API 面与 Cloudflare 优先级

| API | 当前状态 | Cloudflare MVP |
|---|---|---|
| `GET /api/users` | 已有 | 是 |
| `GET /api/overview` | 已有，支持阈值参数 | 是 |
| `GET /api/users/:login/repos` | 已有，支持筛选、排序、分页 | 是 |
| `GET /api/users/:login/repos/:fullName` | 已有 | 是 |
| `GET /api/users/:login/stats` | 已有 | 是 |
| `GET /api/users/:login/summary` | 已有，支持阈值参数 | 是 |
| `GET /api/users/:login/tags` | 已有，支持中英文 label | 是 |
| `GET /api/users/:login/star-timeline` | 已有 | 是 |
| `GET /api/repos/:fullName/similar` | 已有 | 第二阶段 |
| `POST /api/sync` | 已有，真实 GitHub 同步 | 是，但限制单用户和批次 |
| `GET /api/status` | 已有，会探测 GitHub 和 AI | 是，但避免长阻塞 |
| `GET /api/token-source` | 已有 | 是 |
| `GET /api/users/:login/sync-runs` | 已有 | 是 |
| `GET /api/users/:login/removed-stars` | 已有 | 第二阶段 |
| `POST /api/users/:login/classify` | 已有 | 是 |
| `GET /api/repos/:fullName/readme-summary` | 已有，AI | 第二阶段 |
| `GET /api/users/:login/star-dna` | 已有，AI | 第二阶段 |
| `GET /api/users/:login/learning-path` | 已有，AI | 第二阶段 |
| `GET /api/export` | 已有，CSV/JSON/Markdown/HTML | 第二阶段 |
| `GET /api/users/:login/report` | 已有，Markdown 报告 | 第二阶段 |
| `POST /api/repos/:fullName/tags` | 已有 | 第二阶段 |
| `DELETE /api/repos/:fullName/tags/:tag` | 已有 | 第二阶段 |
| `DELETE /api/users/:login` | 已有，逻辑删除 | 第二阶段 |

## 8. 数据库改造

本地版本继续使用：

```text
better-sqlite3 + backend/data/starway.db
```

Cloudflare 版本使用：

```text
Cloudflare D1
```

当前本地表：

| 表 | 用途 |
|---|---|
| `users` | GitHub 用户资料，含 `deleted_at` 逻辑删除 |
| `repos` | 仓库基础信息 |
| `stars` | 用户与仓库的星标关系，含 `removed_at` |
| `repo_tags` | 仓库标签 |
| `translations` | README 摘要、Star DNA、学习路径等缓存 |
| `analysis_reports` | 分析报告缓存 |
| `sync_runs` | 同步运行记录 |

D1 migration 应从当前 `backend/src/db/schema.ts` 生成，但需要单独审查：

- D1 是异步 API，当前 `better-sqlite3` 是同步 API，调用链要改为 `async`。
- D1 支持事务和 batch，但写法与 `db.transaction()` 不同。
- `PRAGMA journal_mode = WAL` 和 `synchronous = NORMAL` 只属于本地 SQLite，不迁移到 D1。
- `translations` 当前复用 `repo_full_name = user:login` 存储用户级 AI 文本，迁移前应决定是否拆表。
- Worker 同步大量 star 时可能超过执行时间，MVP 应限制同步页数，后续再引入 Queue。

## 9. 配置与密钥

本地架构继续使用：

```text
STARWAY_GITHUB_TOKEN
GITHUB_TOKEN
GH_TOKEN
STARWAY_AI_BASE_URL
STARWAY_AI_API_KEY
STARWAY_AI_MODEL
VITE_API_BASE
```

Cloudflare 架构使用 Worker secrets 和 Pages 环境变量：

```text
wrangler secret put STARWAY_GITHUB_TOKEN
wrangler secret put STARWAY_AI_API_KEY
```

本地前置条件：

- Wrangler CLI 已安装并授权，可作为 Cloudflare Worker / D1 / Pages 操作入口。
- 文档中的 Wrangler 命令只作为后续实施命令示例；执行 `wrangler dev`、创建 D1、写入 secret、发布部署前，需要按操作风险再次确认。

Worker 运行时建议类型：

```ts
export interface Env {
  DB: D1Database
  STARWAY_GITHUB_TOKEN?: string
  STARWAY_AI_BASE_URL?: string
  STARWAY_AI_API_KEY?: string
  STARWAY_AI_MODEL?: string
}
```

前端 API 地址示例：

```text
VITE_API_BASE=http://localhost:3210
VITE_API_BASE=https://api.example.workers.dev
```

## 10. Cloudflare MVP 范围

第一阶段迁移必要能力：

| 功能 | 是否进入 MVP | 说明 |
|---|---|---|
| Pages 前端发布 | 是 | 构建 `frontend/dist` |
| 用户列表 | 是 | D1 查询 |
| 全局概览 | 是 | D1 聚合，保留阈值参数 |
| 星标仓库列表 | 是 | 支持分页、搜索、排序 |
| 单仓库详情 | 是 | 支持当前前端详情页 |
| 用户统计 / 摘要 / 标签 / 趋势 | 是 | 支持当前仪表盘和分析页 |
| GitHub 同步 | 是 | 单用户、分页、错误处理、限流提示 |
| 分类 | 是 | 复用规则分类 |
| 同步历史 | 是 | 写入 `sync_runs` |
| 状态检测 | 是 | 返回 GitHub / AI 配置状态，但限制超时 |
| AI 摘要 / DNA / 学习路径 | 第二阶段 | 依赖外部 API 和缓存策略 |
| 相似项目推荐 | 第二阶段 | 查询逻辑较重，先不阻塞 MVP |
| CSV / Markdown / HTML 导出 | 第二阶段 | Worker 可做，但先不阻塞 MVP |
| 本地 CSV 导入 | 否 | 保留在本地架构 |

## 11. 迁移步骤

### 阶段 0：运行时与文档校准

- 将 `backend/package.json` 与 `frontend/package.json` 的 `engines.node` 统一到 README、`.nvmrc`、`.node-version` 的 `24.15.0` 要求。
- 确认所有安装、构建、测试命令都使用 `corepack pnpm`。
- 保留本地 `better-sqlite3` native load 检查。
- 记录本机 Wrangler CLI 已安装并授权，后续 Cloudflare 命令可从当前环境继续。

验收标准：

- README、package engine、启动脚本、故障排查文档的 Node 版本一致。
- 本地后端和前端幂等校验通过。
- Wrangler 版本与登录状态在执行 Cloudflare 实施前完成只读确认。

### 阶段 1：边界整理 ✓ (2026-07-04 完成)

- 抽出共享类型：用户、仓库、标签、同步结果、统计结果、错误响应。
- 梳理当前 API 返回结构，形成 `shared/api-contracts`。
- 把分类规则和标签 label 从后端 Node 依赖中剥离为纯函数。
- 将 Sleep Stars、Hidden Gems 等阈值口径抽成共享模块。

实施结果：

- 新建 `shared/` 目录，包含 `api-contracts/`、`classification/`、`scoring/` 三个子模块。
- `shared/api-contracts/` 导出所有跨端共用的类型（user/repo/star/stats/tag/sync/cache/error）。
- `shared/scoring/thresholds.ts` 导出阈值常量、`ThresholdOptions` 接口、`resolveThresholds` 纯函数和校验函数。
- `shared/classification/` 导出标签字典、双语映射表和 `classifyRepo` 纯函数。
- backend 的 `db/types.ts`、`repository/repo-queries.ts`、`classification/` 改为从 shared re-export，行为零变更。
- backend tsconfig.json 和 vitest.config.ts 配置 `@shared` alias 解析 shared 目录。
- frontend vite.config.ts 和 tsconfig.app.json 配置 `@shared` alias（前端类型保留本地定义，因与 shared 结构有差异，后续 Worker 接入时统一）。
- 新增 `shared/__tests__/threshold.test.ts`（16 测试）和 `shared/__tests__/classifier.test.ts`（10 测试）。
- 修复 `classifyRepo` 在无效 topicsJson 时的空指针问题（safeJsonParse 返回 null 时改为空数组）。

验收标准：

- ✓ 本地 API 返回结构不变（backend 132/132 测试通过）。
- ✓ 前端无需感知本地后端或 Worker 差异（tsc + build 通过）。
- ✓ 分类和标签逻辑可在 Node 与 Worker 中共用（shared/ 无 Node 依赖）。
- ✓ shared/ 不依赖 better-sqlite3、node:http（纯类型和纯函数）。
- ✓ 总测试 158/158 通过（132 backend + 26 shared）。

### 阶段 2：D1 Schema 与数据访问

- 从 `backend/src/db/schema.ts` 生成 D1 migration 初稿。
- 新增 `D1StarRepository`。
- 为核心查询补最小验证：用户列表、概览、仓库列表、标签、趋势、同步历史。
- 明确 `translations` 是否保持兼容结构，或拆分为 repo 缓存与 user 缓存。

验收标准：

- D1 可创建所有 MVP 所需表和索引。
- 能写入用户、仓库、星标、标签、同步记录。
- 能读取 MVP 查询结果。

### 阶段 3：Worker API

- 新建 `cloudflare/worker/src/index.ts`。
- 实现 Worker 路由和统一 JSON 错误格式。
- 接入 `D1StarRepository`。
- 保持 CORS 与前端当前 API 客户端兼容。

验收标准：

- `wrangler dev` 可返回 MVP API。
- 前端设置 `VITE_API_BASE` 后能读取 Worker API。
- API 错误格式与当前前端兼容。

### 阶段 4：Worker 版 GitHub 同步

- 实现 Worker 版 GitHub client 与同步流程。
- 使用 Worker secrets 管理 token。
- 保留 username 规范化、rate limit 信息和 `sync_runs` 记录。
- 对单次同步页数设置上限，避免 Worker 超时。

验收标准：

- 能同步真实 GitHub 用户公开 star 数据。
- D1 中生成一致的用户、仓库、星标记录。
- 限流、用户不存在、网络失败时返回明确错误。

### 阶段 5：Cloudflare Pages 发布

- 配置 Pages 构建 `frontend`。
- 配置 `VITE_API_BASE` 指向 Worker API。
- 使用已授权的 Wrangler CLI 发布 Worker，并通过 Cloudflare Pages 发布前端。

验收标准：

- 线上页面可打开。
- 线上页面可访问 Worker API。
- 不依赖本地后端。

## 12. 风险与取舍

| 风险 | 影响 | 处理方案 |
|---|---|---|
| D1 与 SQLite 行为差异 | 查询结果、事务行为或索引性能不同 | 数据访问层分离，补核心查询验证 |
| 同步超过 Worker 执行时间 | 大量 star 用户同步失败 | MVP 限制页数，后续引入 Queue |
| AI API 成本与超时 | 页面响应慢或费用不可控 | AI 功能放第二阶段，使用缓存和超时 |
| `translations` 表语义混杂 | D1 迁移后缓存难维护 | 迁移前决定是否拆表 |
| 双架构维护成本 | 代码重复 | 只共享纯逻辑，不共享运行时适配 |
| package engine 与 README 不一致 | 本地 native ABI 风险 | 先统一 Node 版本声明 |

## 13. 不建议的方案

不建议把现有 `backend` 直接改造成同时兼容 Node 和 Worker 的单一后端，原因：

- `better-sqlite3` 与 D1 的调用模型差异很大。
- `node:http` 与 Worker `fetch()` 模型差异明显。
- 强行统一会引入大量运行时条件分支，降低本地架构稳定性。
- 本地批量同步、导入、导出和 AI 缓存不必全部搬到 Worker。

更稳妥的路线是：

```text
共享业务逻辑 + 两套运行时适配 + 两套数据访问实现
```

## 14. 最终结论

项目可以保留双架构：

- 当前 Node + SQLite 架构继续作为本地优先版本演进。
- Cloudflare 架构作为独立发布版本新增，使用 Pages + Workers + D1。

下一步应先完成运行时与文档校准，再进入共享 API contract、D1 migration 和 Worker MVP。
