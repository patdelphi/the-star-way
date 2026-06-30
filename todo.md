# the-star-way todo

## 当前任务：项目具体规划

- [x] 阅读 `init-idea.md`。
- [x] 检查 Demo CSV 数据规模和主要分布。
- [x] 创建 `Docs` 项目文档目录。
- [x] 编写需求文档。
- [x] 编写设计文档。
- [x] 编写任务拆解。
- [x] 编写 API/CLI 规划。
- [x] 编写部署规划。
- [x] 编写优化计划。
- [x] 编写路线图和变更记录。

## 已完成：Web UI 风格原型

- [x] 新增 pps/web/index.html 静态入口。
- [x] 新增 pps/web/styles.css 工具型 Dashboard 样式。
- [x] 新增 pps/web/app.js Demo 数据和筛选交互。
- [x] 新增 scripts/verify-ui.mjs 本地 UI 校验脚本。
- [x] 新增 package.json 和 
pm test 校验命令。
- [x] 使用 Playwright 打开本地 HTML，检查桌面和移动视口渲染。
## 下一步待确认

- [ ] 是否按 `Docs/tasks.md` 从 Phase 1 开始创建项目骨架。
- [ ] 是否采用 TypeScript 全栈方案：Node.js + pnpm + React/Vite + SQLite。
- [ ] SQLite ORM 选择 Drizzle、Kysely，或直接使用 sqlite API。
- [x] UI 首版先做本地 Web 风格原型，而不是纯 CLI。
- [ ] 是否把当前 CSV 作为内置 Demo 数据导入源。

## 后续执行规则

- 新功能先写测试。
- 外部网络、安装依赖、GitHub API 调用、git commit/push 需要先确认。
- 数据库写入必须用事务。
- SQLite 必须启用 WAL 和 synchronous=NORMAL。
- 所有 API 调用必须有异常处理。

