# Cloudflare 星标同步续传设计

## 目标

让 Cloudflare Worker 能通过多个短请求同步超过 2000 个 starred repositories，同时避免把未拉取的数据误标记为 removed。

## 方案

- 每个同步任务使用 `sync_runs.id` 作为游标标识。
- Worker 每次从 `next_page` 开始最多拉取 `STARWAY_GITHUB_MAX_PAGES` 页，返回 `syncId` 和 `nextPage`。
- `stars.sync_run_id` 记录最后一次写入该星标的同步任务；只有最终批次才根据该字段标记 removed。
- 前端 `syncStars` 自动重复请求，直到 `complete=true`，对调用方保持一个 Promise 接口。
- D1 迁移为已有数据库增加 `sync_runs.next_page` 与 `stars.sync_run_id`，新建数据库同步更新初始化 schema。

## 错误处理

- GitHub 拉取或 D1 写入失败，将当前任务标记为 `failed` 并保留错误信息。
- 续传请求必须校验 `syncId` 与用户名一致，防止把一个用户的任务用于另一个用户。
- 未完成批次只写入已获取数据，不执行 removed 标记，也不生成完成态 AI 缓存。

## 验证标准

- Worker 测试验证 2500 条数据跨两次批次请求后全部写入，最终状态为 `success`。
- Worker 测试验证第一批完成时不标记窗口外旧星标，最终批次才标记 removed。
- 前端 API 测试验证收到 `nextPage` 后自动携带 `syncId` 继续请求。
- Worker 测试与前端构建通过。
