# 当前功能与显示优化清单

## 背景

当前系统已经能跑通本地 API、SQLite、CSV 快照、真实 GitHub starred 同步、规则分类和前端页面接入。

## 本轮开发成果（2026-07-01）

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

### AI 功能（完成 2/5）

| 状态 | 功能 | 成果 |
|---|---|---|
| ✅ | README 摘要 | `GET /api/repos/:fullName/readme-summary`，AI 生成中文摘要并缓存到 `translations` 表；RepoDetail 页面展示 |
| ⏳ | 仓库描述中文摘要 | 可由 README 摘要覆盖，待需求明确后实现 |
| ✅ | Star DNA | `GET /api/users/:login/star-dna`，基于语言/标签统计生成开发者画像；Developers 页面展示 |
| ⏳ | 学习路径 | 基于用户选择的标签或仓库集合生成，待设计 |
| ⏳ | 替代方案 / 相似项目推荐 | 需要 embedding 或更完整的规则基线，最后做 |

---

## 遗留任务

| 优先级 | 任务 | 说明 |
|---|---|---|
| P1 | Dashboard 导航结构重构 | Dashboard 做总览，StarExplorer 做检索分析，StarCatalog 做标签目录 |
| P2 | Markdown 报告导出 | 增加面向阅读的报告模板：开发者画像、技术栈、风险、推荐仓库 |
| AI | 仓库描述中文摘要 | 列表页批量翻译或用户主动触发 |
| AI | 学习路径 | 基于用户选择的标签或仓库集合生成学习路线 |
| AI | 替代方案推荐 | 需要 embedding 或更完整的规则基线 |

## 下一轮推荐任务

1. **Dashboard 导航结构重构**：将 Dashboard、StarCatalog、StarExplorer 的职责明确分离
2. **Markdown 报告导出**：基于用户数据生成可读的分析报告
3. **学习路径 AI**：基于用户的星标标签生成学习路线推荐
4. **批量中文摘要**：为列表页仓库批量生成中文描述摘要
