# 当前功能与显示优化清单

## 背景

当前系统已经能跑通本地 API、SQLite、CSV 快照、真实 GitHub starred 同步、规则分类和前端页面接入。

---

## 第一轮开发成果（2026-07-01）

### P0：核心数据透明化（全部完成）

| 状态 | 问题 | 成果 |
|---|---|---|
| ✅ | CSV 快照数据和 GitHub 实时同步数据没有明显区分 | `GET /api/users/:login/summary` 统一返回 7 项统计，前端 MetricCard 全部使用后端计算值 |
| ✅ | 开发者页 star 数不稳定 | summary API 返回 `repoCount`、`activeRepoCount`、`lastSyncedAt`，前端全部使用 API 字段 |
| ✅ | 同步状态不够透明 | 新增 `sync_runs` 表记录每次同步明细；前端同步后展示 `reposUpserted`、`starsUpserted`、`pagesFetched`、`rateLimit` |
| ✅ | 星标仓库页顶部 8 个指标仍有 fallback 常量 | Hidden Gems / Sleep Stars / License 风险等指标全部改为后端计算 |
| ✅ | `classifyAllRepos` 当前是全库分类 | 改为 `classifyReposForUser(login)`，只处理当前用户星标仓库 |
| ✅ | 前端 token 与后端 env token 优先级不明 | Settings 页显示 Token 来源：浏览器 localStorage / 后端环境变量 / 匿名模式 |

### P1：提升真实数据可读性（全部完成）

| 状态 | 问题 | 成果 |
|---|---|---|
| ✅ | 语言、License、Topic 筛选没有展示命中数量 | 筛选项旁实时显示数量，按 count 降序，基于当前其他筛选条件动态计算 |
| ✅ | 列表分页固定每页 5 条 | 增加每页 20/50/100 选项，默认 20 |
| ✅ | 同步长任务没有进度 | 同步按钮禁用 + 旋转图标 + "同步可能需要数分钟，请勿关闭页面"提示 |
| ✅ | 仓库详情页和单个仓库页职责重叠 | RepoDetail 标注"原始数据"Badge + "查看分析"链接；RepositoryAnalysis 标注"分析结果"Badge |

### P2：功能补强（全部完成）

| 状态 | 问题 | 成果 |
|---|---|---|
| ✅ | 没有同步历史 | `sync_runs` 表 + `GET /api/users/:login/sync-runs` API + 前端同步历史列表 |
| ✅ | 没有手动标签修正 | `POST/DELETE /api/repos/:fullName/tags` + 前端标签编辑弹窗（manual 实心 Badge / 规则空心 Badge） |
| ✅ | Removed Stars 只有标记，没有独立视图 | `GET /api/users/:login/removed-stars` + 前端弹窗展示已移除仓库列表 |
| ✅ | License 风险缺少解释 | 点击 License 风险指标卡片弹出风险说明弹窗 + 对应仓库列表 |

---

## 第二轮开发成果（2026-07-01 续）

### 1. Markdown 报告导出

| 成果 | 说明 |
|---|---|
| `GET /api/users/:login/report` | 生成面向阅读的分析报告（Markdown） |
| 报告内容 | 概览（总数/活跃/沉睡/风险/Gems）、技术栈（语言/标签/License 分布）、风险分析、隐藏宝石、完整仓库列表 |
| 前端 | StarExplorer 页面"生成报告"按钮，点击直接下载 `.md` 文件 |

### 2. Dashboard 导航重构

| 成果 | 说明 |
|---|---|
| Sidebar 分组 | 总览（Dashboard/Developers）、数据浏览（StarExplorer/StarCatalog）、分析工具（RepoAnalysis）、系统（Settings） |
| Dashboard 快速入口 | 底部新增 3 个卡片：星标仓库（检索分析）、分类目录（标签浏览）、单个仓库（深度分析） |

### 3. 学习路径 AI

| 成果 | 说明 |
|---|---|
| `GET /api/users/:login/learning-path` | AI 基于用户语言和标签生成个性化学习路径 |
| 输出格式 | Markdown：阶段一（巩固基础）→ 阶段二（深入实践）→ 阶段三（拓展前沿）→ 学习建议 |
| 前端 | Dashboard 页面展示学习路径卡片 |
| 缓存 | 结果缓存到 `translations` 表（target_lang = 'learning'） |

### 4. 批量中文摘要

| 成果 | 说明 |
|---|---|
| `GET /api/users/:login/cn-summaries` | 批量返回用户所有星标仓库中已有缓存的中文摘要 |
| 前端 | StarExplorer 表格中，仓库名称下方显示中文摘要（`text-xs text-primary line-clamp-2`） |
| 数据来源 | 复用 README 摘要的 `translations` 表缓存 |

---

## 后端新增 API 汇总

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/users/:login/summary` | GET | 用户统计概览（7 项指标） |
| `/api/users/:login/sync-runs` | GET | 同步历史记录 |
| `/api/users/:login/removed-stars` | GET | 已移除的星标仓库 |
| `/api/users/:login/star-dna` | GET | AI 开发者画像 |
| `/api/users/:login/learning-path` | GET | AI 学习路径推荐 |
| `/api/users/:login/report` | GET | Markdown 分析报告 |
| `/api/users/:login/cn-summaries` | GET | 批量中文摘要 |
| `/api/token-source` | GET | Token 来源信息 |
| `/api/repos/:fullName/readme-summary` | GET | 单仓库 README 中文摘要 |
| `/api/repos/:fullName/tags` | POST/DELETE | 手动标签增删 |

---

## 第三轮开发成果（2026-07-01 续）

### 数据可视化增强（全部完成）

| 状态 | 功能 | 成果 |
|---|---|---|
| ✅ | 语言分布饼图 | Dashboard 新增 SVG Donut 饼图 + 图例，展示 Top 8 语言占比 |
| ✅ | 标签云 | Dashboard 新增标签云卡片，30 个标签按数量缩放字体大小，彩色圆角标签 |
| ✅ | 最近星标列表 | Dashboard 新增最近星标卡片，按 `starred_at` 倒序展示前 10 个仓库 |

---

## 验证状态

- 后端测试：96 测试全部通过
- 前端编译：零 TypeScript 错误
- 总 commit 数：17

---

## 后续可选方向

| 方向 | 价值 | 复杂度 |
|---|---|---|
| 仓库相似度推荐 | 高 — 基于标签/语言的相似项目推荐 | 高（需要 embedding 或更复杂的规则） |
| 批量 README 摘要预生成 | 中 — 后台批量为所有仓库生成中文摘要 | 中（需要异步队列） |
| 团队协作功能 | 中 — 多用户共享分析结果 | 高（需要权限和分享机制） |
| 数据可视化增强（续） | 中 — 星标时间趋势图、技术栈雷达图等 | 中 |
| 邮件/通知提醒 | 低 — 沉睡仓库提醒、新 Hidden Gems 发现 | 低 |
