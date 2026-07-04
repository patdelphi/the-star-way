# 双架构 Cloudflare 改造 - 阶段 2-5 执行计划

> 创建时间: 2026-07-04
> 状态: 待用户确认
> 参考文档: Docs/dual-architecture-cloudflare-plan.md

## 关键决策

1. **`translations` 表保持兼容结构**：当前 `repo_full_name = user:login` 复用模式已稳定，D1 中保持相同结构，不拆表，避免引入迁移复杂度。
2. **D1 异步 API**：所有查询改为 `async/await`，与 better-sqlite3 同步 API 并存。
3. **Worker 同步页数上限**：单次同步最多 10 页（1000 条 star），超过返回 `SYNC_PAGE_LIMIT` 错误，避免 Worker 超时。
4. **AI 功能放第二阶段**：Worker MVP 不实现 AI 接口，前端调用时返回 `NOT_IMPLEMENTED` 错误。
5. **部署阶段（阶段5）需用户确认**：涉及 `wrangler deploy`、创建 D1 数据库、写入 secrets，属危险操作，必须停下来确认。

## 阶段 2: D1 Schema 与数据访问

### 2.1 生成 D1 migration
- [ ] 新建 `cloudflare/d1/migrations/0001_init.sql`
- 从 `backend/src/db/schema.ts` 转换为 D1 兼容 SQL
- 移除 `PRAGMA journal_mode = WAL` 和 `synchronous = NORMAL`（D1 不支持）
- 移除 `AUTOINCREMENT`（D1 用 AUTOINCREMENT 语法但行为略异，保留以兼容）
- 保留所有表结构和索引

### 2.2 新建 D1 数据访问层
- [ ] 新建 `cloudflare/worker/src/d1-repository.ts`
- 定义 `D1StarRepository` 类，封装核心查询方法（异步）
- 方法清单：
  - `listUsers()` - 用户列表
  - `getOverview(options)` - 全局概览
  - `listRepos(login, params)` - 仓库列表（分页、筛选、排序）
  - `getRepo(login, fullName)` - 单仓库详情
  - `getUserStats(login)` - 用户统计
  - `getUserSummary(login, options)` - 用户摘要
  - `listTags(login, lang)` - 标签列表
  - `getUserStarTimeline(login)` - 星标时间轴
  - `listSyncRuns(login)` - 同步历史
  - `getRepoTags(fullName)` - 仓库标签
  - `upsertUser/profile/repos/stars` - 同步写入
  - `insertSyncRun/updateSyncRun` - 同步记录

### 2.3 核心查询验证
- [ ] 新建 `cloudflare/worker/src/__tests__/d1-repository.test.ts`
- 使用 Miniflare 或 D1 模拟器测试
- 覆盖：用户列表、概览、仓库列表、标签、趋势、同步历史

### 验收标准
- D1 可创建所有 MVP 所需表和索引
- 能写入用户、仓库、星标、标签、同步记录
- 能读取 MVP 查询结果

## 阶段 3: Worker API

### 3.1 Worker 入口与路由
- [ ] 新建 `cloudflare/worker/src/index.ts` - fetch 入口
- [ ] 新建 `cloudflare/worker/src/routes.ts` - 路由匹配
- [ ] 新建 `cloudflare/worker/src/env.ts` - Worker env 类型
- [ ] 新建 `cloudflare/worker/wrangler.toml` - Wrangler 配置

### 3.2 MVP API 实现
- 路由清单（与 Node 后端对齐）：
  - `GET /api/users` ✓
  - `GET /api/overview` ✓
  - `GET /api/users/:login/repos` ✓
  - `GET /api/users/:login/repos/*fullName` ✓
  - `GET /api/users/:login/stats` ✓
  - `GET /api/users/:login/summary` ✓
  - `GET /api/users/:login/tags` ✓
  - `GET /api/users/:login/star-timeline` ✓
  - `GET /api/users/:login/sync-runs` ✓
  - `POST /api/sync` ✓（调用阶段4的同步逻辑）
  - `POST /api/users/:login/classify` ✓
  - `GET /api/status` ✓（限制超时）
  - `GET /api/token-source` ✓
  - `GET /api/repos/*fullName` ✓
  - 第二阶段 API（AI、相似、导出、删除）：返回 501 NOT_IMPLEMENTED

### 3.3 统一 JSON 错误格式
- [ ] 错误响应格式：`{ error: { code, message } }`，与 Node 后端一致
- [ ] CORS 头：`Access-Control-Allow-Origin: *` 等

### 验收标准
- `wrangler dev` 可返回 MVP API
- 前端设置 `VITE_API_BASE` 后能读取 Worker API
- API 错误格式与当前前端兼容

## 阶段 4: Worker 版 GitHub 同步

### 4.1 Worker 版 GitHub client
- [ ] 新建 `cloudflare/worker/src/github-client.ts`
- 复用 shared 层逻辑
- 使用 Worker `fetch()`（与 Node 版一致）
- 解析 rate limit headers

### 4.2 Worker 版同步流程
- [ ] 新建 `cloudflare/worker/src/github-sync.ts`
- 单次同步页数上限：10 页（1000 条）
- 使用 D1 batch 替代 `db.transaction()`
- 写入 `sync_runs` 记录
- token 从 `env.STARWAY_GITHUB_TOKEN` 读取

### 4.3 Worker secrets 配置
- [ ] 在 `wrangler.toml` 声明 secrets
- 不写入实际值，部署时由用户通过 `wrangler secret put` 写入

### 验收标准
- 能同步真实 GitHub 用户公开 star 数据
- D1 中生成一致的用户、仓库、星标记录
- 限流、用户不存在、网络失败时返回明确错误

## 阶段 5: Cloudflare Pages 发布（需用户确认）

> ⚠️ 本阶段涉及部署操作，必须先获得用户确认后才能执行

### 5.1 文档准备（可先完成）
- [ ] 新建 `cloudflare/worker/README.md` - Worker 部署说明
- [ ] 更新 `Docs/deployment.md` - Cloudflare 部署章节
- [ ] 更新 `README.md` - 项目结构说明

### 5.2 部署配置（可先完成）
- [ ] 完善 `wrangler.toml` 配置
- [ ] 新建 `cloudflare/pages/` 配置目录
- [ ] 前端构建脚本适配 Pages

### 5.3 实际部署（⚠️ 需用户确认）
- [ ] 创建 D1 数据库
- [ ] 执行 migration
- [ ] 写入 Worker secrets
- [ ] 发布 Worker
- [ ] 发布 Pages

### 验收标准
- 线上页面可打开
- 线上页面可访问 Worker API
- 不依赖本地后端

## 执行顺序

1. **阶段 2**：纯代码开发，可立即执行
2. **阶段 3**：纯代码开发，可立即执行
3. **阶段 4**：纯代码开发，可立即执行
4. **阶段 5.1-5.2**：文档和配置，可立即执行
5. **阶段 5.3**：⚠️ 暂停，等待用户确认是否部署

## 测试策略

- 阶段 2：D1 查询用 Miniflare 模拟器测试
- 阶段 3：Worker 路由用 Miniflare 测试
- 阶段 4：GitHub 同步用 mock fetch 测试
- 阶段 5：本地 `wrangler dev` 验证后再部署

## 风险

1. **D1 与 SQLite 行为差异**：数据访问层分离，补核心查询验证
2. **Worker 执行时间限制**：同步页数上限 10 页
3. **Miniflare 测试复杂度**：先用最小测试集覆盖核心查询
4. **shared 代码引用**：Worker 通过相对路径引用 shared，不依赖 @shared alias（Wrangler 不支持）

## 预计产出文件

```
cloudflare/
  worker/
    src/
      index.ts
      routes.ts
      env.ts
      d1-repository.ts
      github-client.ts
      github-sync.ts
      errors.ts
      __tests__/
        d1-repository.test.ts
        routes.test.ts
        github-sync.test.ts
    wrangler.toml
    package.json
    tsconfig.json
    README.md
  d1/
    migrations/
      0001_init.sql
  pages/
    README.md
```
