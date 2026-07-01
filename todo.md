# the-star-way todo

## 已完成：项目规划阶段

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
- [x] 前端 Demo（React + Vite + TypeScript + Tailwind CSS 4 + Radix UI）。

## 已完成：Web UI 风格原型

- [x] 新增 apps/web/index.html 静态入口。
- [x] 新增 apps/web/styles.css 工具型 Dashboard 样式。
- [x] 新增 apps/web/app.js Demo 数据和筛选交互。
- [x] 新增 scripts/verify-ui.mjs 本地 UI 校验脚本。
- [x] 使用 Playwright 打开本地 HTML，检查桌面和移动视口渲染。

## 已确认：技术决策

- [x] 后端技术栈：Node.js + TypeScript
- [x] 项目结构：保持 frontend/ + backend/ 当前结构
- [x] SQLite 库：better-sqlite3
- [x] Demo CSV 作为内置种子数据，首次启动自动导入

---

## Phase 1：本地数据层 ✅ 已完成

### 1.1 后端项目初始化 ✅
- [x] 清理 backend 目录（移除 Python 骨架）
- [x] 初始化 backend 为 Node.js + TypeScript 项目
- [x] 安装 better-sqlite3、typescript、vitest 等依赖
- [x] 配置 tsconfig.json
- [x] 创建 data/ 目录用于存放 SQLite 数据库文件

### 1.2 数据库 Schema ✅
- [x] 定义 SQLite schema：users、repos、stars、repo_tags、translations、analysis_reports
- [x] 实现数据库初始化脚本（PRAGMA WAL + synchronous=NORMAL）
- [x] 实现事务封装工具函数 withTransaction
- [x] 创建索引加速查询

### 1.3 测试先行 ✅
- [x] 编写数据库初始化测试（11 个测试：WAL 模式、表创建、索引、重复初始化）
- [x] 编写事务封装测试（成功提交、异常回滚、返回值、批量写入）

### 1.4 Demo CSV 导入 ✅
- [x] 解析 CSV 文件结构，13 个字段映射
- [x] 实现导入逻辑（用户默认 demo-user，upsert 防重复）
- [x] 编写导入测试（22 个测试：解析、导入、防重复、JSON 格式）

### 1.5 基础查询 ✅
- [x] 实现 repo 查询：列表、按语言/标签/关键词筛选、排序、分页
- [x] 实现单仓库详情查询
- [x] 实现统计查询：语言分布、主题聚类、协议分布、仓库总数、活跃仓库数

### 1.6 种子数据集成 ✅
- [x] 创建种子数据导入脚本 pnpm db:seed
- [x] 验收：691 条仓库数据成功导入

### 验收结果
- [x] 33 个测试全部通过
- [x] 本地测试能创建数据库（WAL + NORMAL）
- [x] Demo CSV 可导入 691 条数据
- [x] 基础查询可返回正确结果

---

## Phase 2：GitHub Star 同步 ✅ 已完成

### 已完成任务
- [x] 实现 GitHub client（GitHubClient 类）
- [x] 支持匿名模式和 token 模式（Bearer token）
- [x] 支持分页抓取（每页 100，最多 1000 页）
- [x] 支持 starred_at media type（application/vnd.github.star+json）
- [x] 支持增量同步（upsert 用户/仓库/星标）
- [x] 对本次未返回的历史仓库标记 removed_at（不删除）
- [x] 实现 API 异常处理（401/403/404/429/5xx/网络错误，GitHubSyncError 类）
- [x] 实现 rate limit 解析和透传
- [x] 8 个 mock 测试全部通过（同步/查询/重复/removed_at/rate limit/错误分类）

---

## Phase 3：规则分类与统计 ✅ 已完成

### 已完成任务
- [x] 建立一级/二级标签字典（AI/Web/DevOps/工具/语言/移动端/数据/安全/游戏/底层/设计等分类）
- [x] 基于 topic 打标签（精确匹配，置信度 0.95）
- [x] 基于仓库名称打标签（包含匹配，置信度 0.85）
- [x] 基于描述打标签（包含匹配，置信度 0.80）
- [x] 保存 tag_source 和 confidence 到 repo_tags 表
- [x] 批量分类 classifyAllRepos，自动清除旧规则标签保留手动标签
- [x] 支持按标签筛选仓库
- [x] 实现语言分布、主题聚类、协议分布统计
- [x] 实现活跃仓库统计（90 天 pushed_at）
- [x] 16 个分类与统计测试全部通过

---

## Phase 4：本地 API 服务 ✅ 已完成

### 已完成任务
- [x] 创建 backend/src/api/ 目录（api-server.ts、routes.ts、index.ts）
- [x] HTTP 服务端口 3210（Node.js 内置 http 模块，无额外依赖）
- [x] 路由定义：
  - [x] GET /api/users — 用户列表
  - [x] GET /api/users/:login/repos — 仓库列表（支持 q/language/tag/sort/direction/page/pageSize）
  - [x] GET /api/users/:login/repos/*fullName — 单仓库详情（支持 owner/repo 格式）
  - [x] GET /api/users/:login/stats — 统计数据
  - [x] GET /api/users/:login/tags — 标签列表
  - [x] POST /api/users/:login/classify — 触发规则分类
  - [x] POST /api/sync — 触发同步
  - [x] GET /api/export?format=csv|json|markdown&login=xxx — 导出
- [x] CORS 支持、JSON 错误格式 { error: { code, message } }
- [x] 全局异常处理
- [x] 14 个 API 路由测试全部通过

---

## Phase 5：导出功能 ✅ 已完成

### 已完成任务
- [x] 创建 backend/src/export/ 目录（exporter.ts、index.ts）
- [x] exportCsv — CSV 导出（UTF-8 BOM、CRLF 换行）
- [x] exportJson — JSON 导出
- [x] exportMarkdown — Markdown 表格导出
- [x] 导出结果与当前筛选条件一致
- [x] 导出不修改业务数据
- [x] 12 个导出测试全部通过

---

## Phase 6：多语言 UI ✅ 已完成

### 已完成任务
- [x] 安装 react-i18next + i18next + i18next-browser-languagedetector
- [x] 创建 frontend/src/i18n/ 目录
- [x] i18n 初始化配置（LanguageDetector + localStorage 持久化）
- [x] 中文语言包 locales/zh-CN.json
- [x] 英文语言包 locales/en-US.json
- [x] Sidebar 导航文案抽离到语言包
- [x] TopBar 搜索/主题切换/语言下拉框文案抽离到语言包
- [x] 语言偏好保存到 localStorage（starway-lang）
- [x] 仓库原始数据不翻译，保持原文
- [x] 前端 TypeScript 编译通过

---

## Phase 7：AI 增强功能框架 ✅ 已完成

### 已完成任务
- [x] 创建 backend/src/ai/ 目录（config.ts、cache.ts、index.ts）
- [x] AI Provider 配置类型（openai-compatible，base_url + api_key + model）
- [x] 环境变量加载配置（STARWAY_AI_BASE_URL / STARWAY_AI_API_KEY / STARWAY_AI_MODEL）
- [x] AI 翻译结果缓存（translations 表，UPSERT）
- [x] AI 分析报告缓存（analysis_reports 表，UPSERT）
- [x] 缓存读取函数（getCachedTranslation / getCachedAnalysisReport）
- [x] 仅框架定义，不实现具体 AI 调用
- [x] 8 个 AI 模块测试全部通过

---

## 前端 API 客户端 ✅ 已完成

### 已完成任务
- [x] 创建 frontend/src/lib/api.ts
- [x] 封装 fetch 调用后端 API（getUsers / getRepos / getRepo / getStats / getTags / classifyRepos / syncStars / exportData）
- [x] Demo 模式兜底：API 不可用时返回静态 mock 数据
- [x] 类型定义（Repo / RepoQueryParams / RepoListResult / UserStats / UserInfo / ApiError）
- [x] 带超时的 fetch 封装（8 秒超时）
- [x] API 可用性自动检测

---

## 前端页面接入真实 API ✅ 已完成

### 已完成任务
- [x] StarExplorer.tsx 接入真实 API（列表/筛选/排序/分页/统计/导出/分类）
- [x] Developers.tsx 接入真实 API（用户列表/同步状态）
- [x] RepositoryAnalysis.tsx 接入真实 API（统计/标签融合）
- [x] RepoDetail.tsx 接入真实 API（单仓库详情，useParams 路由）
- [x] App.tsx 添加 `/repo/:owner/:name` 和 `/settings` 路由
- [x] Sidebar.tsx 设置菜单链接改为 `/settings`
- [x] 前端 TypeScript 编译通过
- [x] 前端生产构建验证通过（npm run build，1.02s）

---

## 标签云 ✅ 已完成

- [x] StarExplorer 添加标签云区块（62 个分类动态字号）
- [x] seed.ts 导入后自动触发规则分类（691 仓库 → 1889 标签）
- [x] 标签覆盖率、隐藏宝石、沉睡星标、协议风险从真实数据计算

---

## GitHub Token 支持 ✅ 已完成

- [x] api.ts 添加 getGitHubToken / setGitHubToken / clearGitHubToken（localStorage）
- [x] Settings.tsx 添加 GitHub Token 输入框（密码显示/隐藏切换）
- [x] Developers.tsx 同步时自动读取 token 传入 syncStars
- [x] 同步状态显示是否使用了 Token

---

## 设置页 ✅ 已完成

- [x] 创建 Settings.tsx 页面
- [x] 后端连接状态检测（在线/离线）
- [x] 数据库信息展示（SQLite WAL、Demo 数据）
- [x] 导出格式说明（CSV/JSON/Markdown）
- [x] AI 增强框架状态（已就绪，需配置 API Key）

---

## 未完成 / 后续

- [ ] 前端 i18n 覆盖所有页面 body 内容（当前仅覆盖导航和顶部栏）
- [ ] 具体 AI 调用实现（GPT / Claude / Ollama 集成）
- [ ] StarCatalog / Dashboard 页面接入路由（视需求启用）
- [ ] GitHub OAuth 设备流认证（完整 CLI 认证流程）

## 当前问题修复清单（2026-07-01）

- [x] 删除 demo-user 相关默认数据/兜底展示。
- [x] 修复开发者列表标签/星标 icon 后数字为 0 的问题。
- [x] Dashboard 改为全库多用户汇总概览，而不是单用户概览。
- [x] 优化星标仓库语言分布展示，取消过长 bar。
- [x] 单仓库 AI 智能分析和复用建议改为中立评价。
- [x] 梳理仓库点击跳转，明确列表点击进入单仓库详情页。
- [x] 自查其他明显问题并验证。
- [ ] 物理删除数据库内 demo-user 记录：未执行，属于数据删除，需要单独确认。

## 页面职责与视觉二次优化（2026-07-01）

- [x] 概览页优化星标趋势样式，替换低质折线图。
- [x] 概览页标签云改为清晰的 Top 标签展示。
- [x] 概览页说明宝藏项目选取逻辑，并删除快速入口。
- [x] 开发者列表改为 5 列、4 行、每页 20 个。
- [x] 开发者详情去掉静态技术人格、雷达和写死宝藏项目，改为真实数据说明。
- [x] 星标仓库页标签云改为矩阵式标签筛选。
- [x] 星标仓库页协议分布改为与语言分布一致的紧凑样式。
- [x] 星标仓库页删除导出一致性区块，调整同步状态提示位置和文案。
- [x] 仓库分析页增加返回星标仓库列表入口，并说明数据来源与容错机制。
- [x] 构建、测试、自查 review，直到没有明显问题。

---

---

## 执行规则

- 新功能先写测试。
- 外部网络、安装依赖、GitHub API 调用、git commit/push 需要先确认。
- 数据库写入必须用事务。
- SQLite 必须启用 WAL 和 synchronous=NORMAL。
- 所有 API 调用必须有异常处理。
