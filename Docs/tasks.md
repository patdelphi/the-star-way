# the-star-way 任务拆解

## 0. 当前阶段

目标：维护规划文档，并让文档与当前前端 Demo 状态保持一致。

完成标准：

- `Docs` 目录存在。
- 需求、设计、任务、API、部署、优化、路线图文档完整。
- 根目录 `todo.md` 可作为后续执行清单。
- 文档记录当前静态前端 Demo、星标仓库全局分析和后续多语言方案。

## 1. Phase 1：项目骨架与数据层

- [ ] 确认技术栈：Node.js、TypeScript、pnpm、SQLite、Drizzle 或 Kysely。
- [ ] 创建 monorepo 目录结构。
- [ ] 配置 lint、test、type-check、build。
- [ ] 建立 SQLite schema。
- [ ] 数据库初始化时启用 WAL 和 synchronous=NORMAL。
- [ ] 所有写操作包裹事务。
- [ ] 导入 Demo CSV 到 SQLite。

验收：本地测试能创建数据库并查询 691 条 Demo Star 数据。

## 2. Phase 2：GitHub 同步 CLI

- [ ] 实现 `the-star-way sync <username>`。
- [ ] 支持匿名模式。
- [ ] 支持 token 模式。
- [ ] 支持分页抓取。
- [ ] 支持 starred_at media type。
- [ ] 支持增量同步和 removed_at 标记。
- [ ] 实现 API 异常处理。

验收：可以同步一个公开用户，重复执行不会产生重复数据。

## 3. Phase 3：规则分类与查询

- [ ] 建立一级/二级标签字典。
- [ ] topics 映射标签。
- [ ] repo name 关键词分类。
- [ ] description 关键词分类。
- [ ] 保存 confidence 和 tag_source。
- [ ] 实现 language、license、topic、tag 查询。

验收：Demo 数据能生成 AI、LLM、MCP、Agent、RAG、CLI 等标签统计。

## 4. Phase 4：本地 Web UI

- [ ] 创建本地 Web 应用。
- [ ] Dashboard 展示总数、Top Languages、Top Topics。
- [ ] Star List 支持分页、排序、筛选。
- [ ] Repo Detail 展示元数据和标签。
- [ ] Settings 支持 token 和数据库路径。
- [x] 静态 Demo 区分 `星标仓库` 全局分析和 `单个仓库` 分析。
- [x] 静态 Demo 增加星标仓库 8 个顶部信息块。
- [x] 静态 Demo 增加筛选、排序、导出预览、无结果和限流提示状态。

验收：用户能打开 UI 浏览 Demo 数据并完成筛选排序。

## 5. Phase 5：导出

- [ ] 导出 CSV。
- [ ] 导出 JSON。
- [ ] 导出 Markdown。
- [ ] 导出 HTML。
- [ ] 导出内容与当前筛选条件一致。

验收：导出文件使用 UTF-8 BOM，Markdown 可直接阅读。

## 6. Phase 6：P1 增强

- [ ] 翻译缓存表和 provider 配置。
- [ ] 简介翻译。
- [ ] 前端 UI 多语言资源抽离。
- [ ] 语言切换状态保存到 localStorage。
- [ ] 标签云。
- [ ] Star DNA。
- [x] 静态 Demo 展示 Hidden Gems / 隐藏宝石。
- [x] 静态 Demo 展示 Sleep Stars / 沉睡星标。
- [ ] 基于真实数据计算 Hidden Gems 和 Sleep Stars。

验收：AI 功能关闭时基础功能不受影响。

## 7. Phase 7：P2 增强

- [ ] 学习路径生成。
- [ ] 项目复用建议。
- [ ] license 风险提示。
- [ ] Compare Users。
- [ ] 分享卡片。
- [ ] GitHub Action 定时更新。

验收：增强功能可独立开启，不破坏本地 MVP。
