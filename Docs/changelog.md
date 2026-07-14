# the-star-way 变更记录

## 2026-07-14

- 重构本地后端 Star DNA / 学习路径生成链路：抽出用户级 AI 内容服务，统一缓存读取、数据准备、中文生成、英文翻译、事务写入和错误回退。
- 修正本地同步后的 AI 缓存策略：星标同步成功后清理该用户 `dna-zh`、`dna-en`、`learning-zh`、`learning-en` 缓存，避免继续展示基于旧星标数据生成的内容；仓库 README 摘要缓存不受影响。
- 收紧开发者页当前用户归属：以 `currentLogin` 作为唯一选中来源，后台同步完成时不再把成功/失败状态写到已经切换走的当前页面。
- 更新前端静态校验，覆盖“后台同步完成不污染当前开发者状态”的新语义。
- 验证通过：后端 173 项测试、后端 TypeScript 构建、前端 66 项 UI 静态校验、前端生产构建。
- 修复 5174 本地开发者页同步状态无法结束的问题：列表刷新时从真实 `synced_at` 兜底恢复同步成功状态；同步中的当前开发者仍会加载统计和同步历史；详情请求按最后请求 login 归属，避免 HMR 或重复请求把成功结果误丢弃。
- 修复本地开发者页在 React dev/StrictMode 下异步响应被吞的问题：组件重新挂载时会恢复 `isMountedRef`，同步、Star DNA 和学习路径接口返回 200 后能写回 UI。
- 同步按钮改为 `/api/sync` 返回后立即退出 `syncing`；列表、同步历史和 AI 后处理改为后台刷新，不再阻塞同步状态。
- Star DNA / 学习路径新增本地统计兜底生成：外部 AI 超时或不可用且无缓存时，仍基于已同步语言、标签和代表仓库生成可展示内容，并以 `local` provider 写入缓存。
- 后端 AI 请求超时改为 `STARWAY_AI_TIMEOUT_MS` 可配置，默认 55 秒；`sample.env` 已补充配置项。
- 5174 浏览器复测通过：同步星标返回“同步成功（已使用 Token）”；Star DNA 与学习路径缓存显示正常；两个“重新生成”按钮均触发 force 请求并返回 200。
- 验证通过：后端 175 项测试、后端 TypeScript 构建、前端 75 项 UI 静态校验、前端 TypeScript 构建、前端生产构建。

## 2026-07-13

- Cloudflare Worker 星标同步改为有界分批续传；通过 `syncId`、`nextPage` 和 D1 同步任务标识支持超过 2000 条 starred repos，只有最终批次才标记 removed。
- 修复开发者页同步历史并发请求造成的旧响应覆盖问题；历史区域始终显示，重新生成失败时保留已有 Star DNA 与学习路径。
- 修复本地同步成功后删除 Star DNA/学习路径缓存的问题；已有 AI 缓存会保留，AI 重生成成功后再更新，并为本地 AI 请求增加 30 秒超时。
- 简化本地同步流程：前端只请求一次本地同步接口；同步完成后立即结束同步状态，Star DNA 和学习路径改为独立后台刷新。Cloudflare 续传逻辑保持不变。
- 修复本地 GitHub 请求无超时导致同步按钮永久显示“同步中”的问题；用户资料和星标分页请求统一在 30 秒后返回可识别的超时错误。
- 修复开发者页同步结果被当前用户上下文守卫吞掉的问题；同步请求结束后无论当前选中用户是否变化，页面都不会继续停留在“同步中”。

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
- 修复 Star DNA / 学习路径中英文生成链路：中文请求不再等待英文翻译，英文请求在只有中文缓存时直接翻译缓存，避免首次生成被长耗时翻译拖垮。
- 修复顶部语言切换未同步写入统一 settings 的问题，确保 AI 接口 `lang` 参数跟随当前 UI 语言。
- 2026-07-13：Cloudflare Worker 星标同步改为有界分批续传；通过 `syncId`、`nextPage` 和 D1 同步任务标识支持超过 2000 条 starred repos，只有最终批次才标记 removed。
