# the-star-way 正式开发计划

## 1. 当前判断

当前已有 `tasks.md`、`roadmap.md`、`optimization-plan.md`，但它们分别是任务拆解、版本路线和优化方向，不是面向正式代码开发的执行计划。

因此新增本文件作为正式开发入口，后续代码开发按本文档推进。

## 2. 关键假设

- 首版目标是本地可运行 MVP，不做在线 SaaS。
- 核心功能不依赖 AI API：同步、存储、查询、筛选、排序、规则分类、统计和导出必须本地可用。
- AI API 只作为增强能力，后置接入 README 摘要、Star DNA、学习路径、复用建议、简介翻译等功能。
- 当前前端 Demo 已验证信息架构，后续要逐步替换静态数据为真实本地数据。
- GitHub API、安装依赖、数据库迁移、commit、push 均需单独确认后执行。

## 3. 技术路线

| 模块 | 建议方案 | 说明 |
|---|---|---|
| 前端 | React + Vite + TypeScript | 沿用当前 `frontend`。 |
| 本地服务 | Node.js + TypeScript | 给前端提供本地 API。 |
| 数据库 | SQLite | 本地优先，必须启用 WAL。 |
| 数据访问 | 先直接封装 sqlite repository | 避免过早引入复杂 ORM。 |
| 测试 | 先补核心单元测试和 UI 静态校验 | 新功能先写测试。 |
| 导出 | 本地 CSV / JSON / Markdown / HTML | 导出文件使用 UTF-8 BOM。 |

SQLite 初始化必须执行：

```sql
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
```

所有数据库写操作必须使用事务。

## 4. 开发阶段

### Phase 1：本地数据层

目标：把 Demo CSV 导入 SQLite，并能稳定查询。

任务：

- 建立 SQLite schema：`users`、`repos`、`stars`、`repo_tags`、`analysis_reports`。
- 实现数据库初始化。
- 实现事务封装。
- 实现 Demo CSV 导入。
- 实现基础 repository 查询。
- 添加数据库初始化、导入、查询测试。

验收：

- 本地测试能创建数据库。
- Demo CSV 可导入。
- 可查询 691 条星标仓库。
- WAL 和事务测试通过。

### Phase 2：GitHub Star 同步

目标：可以同步一个公开 GitHub 用户的 starred repos。

任务：

- 实现 GitHub client。
- 支持匿名模式和 token 模式。
- 支持分页。
- 支持 `starred_at`。
- 支持增量同步。
- 对本次未返回的历史仓库标记 `removed_at`。
- 实现 401、403、404、限流、5xx、网络失败异常处理。

验收：

- 重复同步不产生重复数据。
- 限流和网络异常有明确错误。
- 不直接删除取消星标的仓库。

### Phase 3：规则分类与统计

目标：生成星标仓库全局分析需要的基础数据。

任务：

- 建立标签字典。
- 基于 topic 打标签。
- 基于仓库名称打标签。
- 基于描述打标签。
- 保存 `tag_source` 和 `confidence`。
- 实现语言分布、主题聚类、协议分布、兴趣时间线、隐藏宝石、沉睡星标、已取消星标统计。

验收：

- 星标仓库页 8 个顶部信息块可由真实查询驱动。
- 列表筛选、排序和统计结果一致。
- 不需要 AI API。

### Phase 4：本地 API 与前端接线

目标：把当前静态 Demo 替换为真实本地数据。

任务：

- 实现本地 API：用户列表、用户摘要、仓库列表、单仓库详情、标签统计、导出。
- 星标仓库页接入真实列表和统计。
- 单个仓库页接入真实仓库详情。
- 开发者页接入真实用户和同步状态。
- 保留 Demo 模式作为无数据兜底。

验收：

- 前端不再依赖写死的主要仓库列表。
- 无数据库时仍能进入 Demo 模式。
- `/explorer`、`/analysis`、`/developers` 均可正常打开。

### Phase 5：导出

目标：导出结果与当前筛选条件一致。

任务：

- 实现 CSV 导出。
- 实现 JSON 导出。
- 实现 Markdown 导出。
- 实现 HTML 导出。
- 导出历史写入数据库。

验收：

- CSV、Markdown 使用 UTF-8 BOM。
- 导出内容与筛选结果一致。
- 导出命令不修改业务数据。

### Phase 6：多语言 UI

目标：支持中文和英文 UI 切换。

任务：

- 引入 `react-i18next + i18next`。
- 创建 `zh-CN`、`en-US` 语言包。
- 抽离导航、按钮、标题、状态、空状态、错误提示和弹窗文案。
- 语言偏好保存到 `localStorage`。

验收：

- 中文模式和英文模式都可完整浏览。
- 仓库原始数据不进入 UI 语言包。
- 不依赖 AI API。

### Phase 7：AI 增强

目标：在核心 MVP 稳定后接入 AI API。

任务：

- 配置 OpenAI-compatible provider。
- 增加 AI 功能开关。
- 实现 README 摘要。
- 实现 Star DNA。
- 实现学习路径。
- 实现项目复用建议。
- 实现仓库简介翻译。
- 缓存 AI 结果，避免重复调用。

验收：

- 关闭 AI 后基础功能不受影响。
- AI 调用失败有明确错误提示。
- 生成结果写入缓存。

## 5. 第一轮开发建议

第一轮只做 Phase 1，不接 GitHub API，不安装额外服务，不做 AI。

建议任务顺序：

1. 确认 SQLite Node 库选择。
2. 创建数据库初始化脚本。
3. 写 schema 测试。
4. 写 Demo CSV 导入测试。
5. 实现导入逻辑。
6. 实现基础查询。
7. 更新前端或脚本读取真实数据的最小验证入口。

## 6. 完成标准

正式开发开始后，每个阶段必须满足：

- 有可复现测试。
- 有明确验收命令。
- 文档同步更新。
- 不引入未确认的外部 API 或依赖。
- 不自动 commit、push、merge。

## 7. 当前待确认事项

- SQLite Node 库选择：`better-sqlite3`、`sqlite3`、`node:sqlite`，或其他。
- 是否保持当前 `frontend` 单包结构，还是改为 monorepo。
- 后端本地 API 使用独立 `backend`，还是放入 Node 本地服务。
- Demo CSV 是否作为正式内置种子数据。
