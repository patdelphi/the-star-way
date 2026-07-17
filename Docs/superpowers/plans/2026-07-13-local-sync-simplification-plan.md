# 本地星标同步简化实施计划

> **For agentic workers:** 本计划不使用 Subagent；按任务逐项执行，每项先测试再修改。

**目标：** 恢复本地应用“获取全部星标后立即结束”的简单同步流程，解除本地同步与 Cloudflare 续传、AI 生成之间的耦合。

**架构：** 本地后端负责一次请求内完成 GitHub 全部分页、SQLite 事务写入并返回 `complete: true`。本地前端收到同步完成响应后立即结束同步状态并刷新数据；Star DNA/学习路径作为独立的后处理，不阻塞同步按钮。Cloudflare 续传代码不进入本地流程，也不修改 Cloudflare 端。

**技术栈：** Node.js、TypeScript、better-sqlite3、React、Vite、Vitest。

## 全局约束

- 只修改本地 `backend/`、`frontend/` 和本地文档，不修改 `cloudflare/`。
- 本地同步只允许一个 `POST /api/sync` 请求；前端不得循环续传。
- 本地后端分页结束条件保留：GitHub 返回空页、返回数量小于 100，或达到 1000 页安全上限。
- SQLite 写入继续使用现有事务、WAL 和 `synchronous=NORMAL` 配置。
- 同步完成不得等待 AI；AI 失败不得把同步状态改回失败或 syncing。
- 不删除已有 Star DNA、学习路径或其他历史缓存。
- 不执行数据库迁移、commit、push 或部署。

---

### 任务 1：固定本地同步接口为一次请求

**文件：**

- 修改：`frontend/src/lib/api.ts` 的 `syncStars`
- 测试：`frontend/scripts/verify-ui.mjs`

**接口：**

- 输入：`username: string`、可选 `token: string`
- 输出：`Promise<SyncStarsResult | null>`
- 本地接口：一次 `POST /api/sync`，返回后直接结束，不读取 `syncId`、`nextPage`，不执行前端续传循环。

- [ ] 写失败校验：断言本地 `syncStars` 不包含 `for (let batch = 0; batch < 1000; batch++)`、`syncId` 续传赋值和二次 POST 逻辑。
- [ ] 运行 `corepack pnpm test`，预期 UI 校验失败。
- [ ] 删除前端 Cloudflare 续传循环，保留一次请求、响应体超时、非 2xx 错误转换和返回结果。
- [ ] 运行 `corepack pnpm test`，预期 UI 校验通过。

### 任务 2：让同步完成立即结束，AI 独立运行

**文件：**

- 修改：`frontend/src/pages/Developers.tsx`
- 测试：`frontend/scripts/verify-ui.mjs`

**流程：**

```ts
const result = await syncStars(name, token || undefined)
if (!result) throw new Error('SYNC_FAILED')

setSyncStatus(result.complete === false ? 'partial' : 'successToken')
await refreshDevelopers(name)
await loadSyncRuns(name)

// AI 是独立后处理，不阻塞同步按钮和同步状态。
void refreshDeveloperAi(name)
```

- [ ] 写失败校验：断言同步完成分支在 `loadStarDna`/`loadLearningPath` 之前设置成功状态，并且不存在 `await loadStarDna(..., true)` 或 `await loadLearningPath(..., true)` 阻塞同步主流程。
- [ ] 运行 `corepack pnpm test`，预期 UI 校验失败。
- [ ] 将 AI 后处理拆为独立函数：内部自行处理 loading、错误和当前用户校验；不得修改 `syncStatus`。
- [ ] 删除不再需要的同步专用请求序号和同步期间保护状态；只保留切换用户时必要的当前 login 校验。
- [ ] 运行 `corepack pnpm test` 和 `corepack pnpm run build`，预期均通过。

### 任务 3：验证本地后端完成状态

**文件：**

- 检查：`backend/src/sync/star-syncer.ts`
- 检查：`backend/src/sync/github-client.ts`
- 测试：`backend/src/sync/__tests__/sync.test.ts`

- [ ] 增加测试：模拟 2 页数据，第二页少于 100 条，断言同步结果 `complete === true`、`sync_runs.status === 'success'`、`ended_at` 非空。
- [ ] 增加测试：模拟整页数据后返回空页，断言不会继续请求下一页。
- [ ] 运行 `corepack pnpm test -- --run backend/src/sync/__tests__/sync.test.ts`，预期通过。
- [ ] 只在测试失败时修复后端分页；若测试已通过，不改后端实现。

### 任务 4：清理文档与最终验证

**文件：**

- 修改：`Docs/changelog.md`
- 修改：`chat_history.md`

- [ ] 记录本地与 Cloudflare 流程边界、同步与 AI 解耦、没有执行数据库迁移。
- [ ] 运行 `corepack pnpm test`（frontend）。
- [ ] 运行 `corepack pnpm run build`（frontend）。
- [ ] 运行 `corepack pnpm test`（backend）。
- [ ] 运行 `git diff --check`。
- [ ] 检查 `git status --short`，不执行 commit 或 push。

## 预期结果

用户点击“同步星标”后，流程只有：

```text
点击同步
  -> 本地后端分页获取 GitHub 全部星标
  -> SQLite 事务写入
  -> 返回 complete=true
  -> 前端立即停止同步动画并显示成功
  -> 刷新用户数量和同步历史
  -> AI 如需生成，独立显示自己的 loading，不影响同步状态
```

Cloudflare 的 `syncId`、`nextPage`、分批续传只留在 Cloudflare 代码路径，不再影响本地应用。
