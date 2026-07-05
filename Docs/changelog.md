# the-star-way 变更记录

## 2026-06-30

- 基于 `init-idea.md` 创建项目规划文档。
- 基于 691 条 Demo Star 数据补充语言和 topic 观察。
- 明确 MVP 聚焦 GitHub 同步、SQLite、本地 UI、规则分类和导出。
- 将 AI 翻译、兴趣报告、学习路径、分享功能放入后续版本。

## 2026-07-01

- 同步当前静态前端 Demo 状态：星标仓库全局分析、单个仓库分析、开发者同步状态和顶部搜索。
- 将星标仓库顶部信息块记录为 8 个，并把 `Dead Stars` 调整为 `Sleep Stars / 沉睡星标`。
- 补充后续 UI 多语言切换方案：`react-i18next + i18next`、`localStorage` 保存语言偏好、先抽离 UI 文案。
- 新增 `feature-list.md`，区分不需要 AI API、可选 AI API、需要 AI API 的功能边界。
- 新增 `development-plan.md`，作为正式代码开发的阶段计划和第一轮开发入口。
- 修正后端开发状态文档：API 路由、V0.1 完成状态、测试状态和 SQLite 实现状态与当前代码保持一致。
- 修复后端构建错误、用户数据隔离、AI 配置启用条件，并在重编译 better-sqlite3 后通过后端 94 个测试。
- 前端新增当前开发者上下文，开发者页、星标仓库、单个仓库、仓库详情、概览和分类目录统一跟随当前 login。
- 新增当前功能与显示优化清单，明确真实数据、CSV 快照、同步状态、指标口径和 AI 功能的后续整理顺序。
- 新增 `sample.env`，覆盖 GitHub Token、AI API、后端端口和前端 API 地址。

## 2026-07-02

- 修复 `start-project.ps1` 的 Node native ABI 问题：启动脚本固定解析 Node/pnpm 路径，并用同一个 Node 进程检查 `better-sqlite3` native binary。
- 清理前端硬编码 Demo 内容：星标仓库、概览、仓库分析、分类目录、仓库详情和顶部搜索不再展示旧静态样例仓库。
- 新增统一图表 Tooltip，修复暗色主题下 Recharts popup 数字标签可读性问题。
- 仓库详情、仓库分析、星标仓库和开发者页面补齐中英文 i18n；新增静态校验，除 locale 文件外前端源码不允许出现中文字符串字面量。
- 新增真实 GitHub 样本导入脚本，可导入真实用户和真实 starred repo 样本用于本地端到端验证。
- 修复后端 GitHub Token 加载问题：后端从 `backend` 目录启动时会同时加载 `backend/.env` 与项目根目录 `.env`，确保 `/api/sync` 使用 `STARWAY_GITHUB_TOKEN` 等环境变量。
- 当前本地真实数据验证样本：34 个真实用户、3632 个真实仓库、3779 条星标关系、64 个标签分类。
- 验证通过：后端 99 个测试、后端 TypeScript 构建、前端 40 项 UI 静态校验、前端生产构建。
- 新增 `troubleshooting.md`，记录 `better-sqlite3` native ABI 不匹配、系统 Node/Corepack pnpm 修复方式，以及 GitHub token 未加载导致匿名限流的排查步骤。
- 统一项目 Node.js 版本到 `v24.15.0`：新增 `.node-version`、`.nvmrc`，后端和前端 `package.json` 声明 Node engines，启动脚本增加版本硬检查。
- 统一开发命令为 `corepack pnpm`：更新 README、部署文档、故障排查文档和启动脚本依赖缺失提示，避免 PATH 中其他 pnpm 绑定不同 Node 版本。

## 2026-07-03

- 修复开发者搜索添加用户链路：GitHub 用户名统一规范化，支持 `@login`、GitHub 用户主页 URL 和首尾空白。
- 修复同步失败污染用户列表的问题：只有 GitHub 用户资料验证成功后才写入本地 `users` 和 `sync_runs`。
- 恢复 GitHub token fallback 顺序：请求 token 优先，其次读取 `STARWAY_GITHUB_TOKEN`、`GITHUB_TOKEN`、`GH_TOKEN`。
- 修复 DNA 画像/学习路径生成中切换或添加其他用户导致白屏的问题：前端对时间线、标签、统计和列表响应增加空值兜底。
- 新增全局 React `ErrorBoundary`，单页渲染异常不再导致整站白屏。
- 前端 API 客户端增加集中响应归一化：仓库列表、用户统计、全局概览、标签、同步记录和已移除星标都返回稳定结构。
- 修复 API 可用性探测缓存问题：后端曾短暂离线后，前端不会永久停留在 Demo/离线判断，会在后续调用继续重试。
- 修复后端通配路径参数解码异常：异常 URL 编码不再触发 500。
- 更新前端静态校验规则，移除旧 `RepoDetail` 页面检查，改为校验当前仓库分析页和跨页面开发者上下文。
- 验证通过：前端 47 项 UI 静态校验、前端生产构建、后端 111 个测试、后端 TypeScript 构建。

## 2026-07-04

- 修复开发者页新增/同步用户后的 Star DNA 画像和学习路径长耗时竞态：切换用户或页面时，旧请求不再覆盖当前用户 UI。
- 开发者列表刷新支持显式保持本次同步用户选中，避免新增用户同步完成后被旧 `currentLogin` 切走。
- Star DNA 和学习路径首次生成也进入 loading 状态；同步后若用户已切走，仅触发后端缓存写入，不污染当前页面状态。
- 补充前端静态校验，覆盖开发者 AI 长任务归属、刷新选中用户保持和首次 AI loading。
- 修复 Dashboard / Developers 趋势缩放按钮的中文 title 硬编码，改为中英文 i18n 文案。

## 2026-07-05

- 修复 Cloudflare Worker 同步不完整时仍被当作成功数据的问题：达到页数上限时写入 `partial`，返回 `complete: false` 和 warning。
- Worker GitHub starred repos 默认同步上限从 10 页调整为 20 页，并支持 `STARWAY_GITHUB_MAX_PAGES` 配置。
- partial 同步不再执行 removed 标记，避免把未拉取到的星标误判为已取消收藏。
- 同步后清理用户级 Star DNA / 学习路径缓存；最新同步非 `success` 时拒绝生成新的用户级 AI 内容。
- 前端识别 partial 同步状态，显示提示并跳过自动刷新 Star DNA / 学习路径。
- 更新 Cloudflare 双架构文档和部署指南，记录本地 Wrangler CLI 已安装并授权，以及 Worker partial 同步语义。
- 抽出 `shared/ai` 和 `shared/sync`：本地后端、前端和 Cloudflare Worker 共用 Star DNA / 学习路径 prompt、用户级 AI 缓存 key、同步状态语义和 AI 生成前置判断。
- 本地同步完成后也清理用户级 AI 缓存；本地 AI 路由也按最新同步状态阻止基于不完整数据生成新缓存。
