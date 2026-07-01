# 当前功能与显示优化清单

## 背景

当前系统已经能跑通本地 API、SQLite、CSV 快照、真实 GitHub starred 同步、规则分类和前端页面接入，但真实数据、Demo fallback、页面显示和同步状态仍混在一起。下一步应先做体验和数据语义整理，再继续增加 AI 功能。

## P0：先修清楚，否则测试会继续混乱

| 优先级 | 问题 | 影响 | 建议动作 | 是否需要 AI API |
|---|---|---|---|---|
| P0 | CSV 快照数据和 GitHub 实时同步数据没有明显区分 | 用户不知道当前看到的是快照还是实时数据 | 给每个用户增加 `data_source` / `last_sync_source` 显示：CSV 快照、GitHub API、Demo fallback | 否 |
| P0 | 开发者页显示的 star 数仍不稳定，部分来自旧静态值 | 切换开发者时列表、概览、顶部数字容易不一致 | 用户列表 API 增加 `star_count`、`active_repo_count`、`last_synced_at`，前端全部用 API 字段 | 否 |
| P0 | 同步状态不够透明 | 用户只能看到成功/失败，不知道同步了几页、多少仓库、剩余额度 | 同步完成后显示 `reposUpserted`、`starsUpserted`、`reposMarkedRemoved`、`rateLimit.remaining` | 否 |
| P0 | 星标仓库页顶部 8 个指标部分仍有 fallback 常量 | 真实用户和 CSV 用户切换时指标语义混乱 | 把 Hidden Gems、Sleep Stars、Removed Stars、License 风险全部改成后端统计接口返回 | 否 |
| P0 | `classifyAllRepos` 当前是全库分类 | 多用户数据变多后，点击单用户分析会重算全部仓库 | 改为支持 `classifyReposForUser(login)`，只处理当前用户星标仓库 | 否 |
| P0 | 前端 token 存在 localStorage，后端也准备支持 env token，但 UI 未说明优先级 | 用户不知道该在设置页填 token 还是用 `.env` | 设置页显示 token 来源：浏览器 Token / 后端环境变量 / 匿名模式 | 否 |

## P1：提升真实数据可读性

| 优先级 | 问题 | 影响 | 建议动作 | 是否需要 AI API |
|---|---|---|---|---|
| P1 | 真实 GitHub 仓库描述是英文，分类标签是中文，视觉上混杂 | 阅读成本高 | 保留原文描述，同时增加可选中文摘要字段，默认关闭 AI | 可选 |
| P1 | 语言、License、Topic 筛选没有展示命中数量 | 筛选时不可预期 | 筛选项旁显示数量，排序按 count 降序 | 否 |
| P1 | 列表分页固定每页 5 条 | 真实用户几百到上千条时效率低 | 增加每页 20/50/100 选项，默认 20 | 否 |
| P1 | 同步长任务没有进度 | 同步大用户时容易误判卡死 | 后端增加同步任务状态表，前端轮询进度；短期先显示“同步可能需要数分钟” | 否 |
| P1 | 仓库详情页和单个仓库页职责重叠 | 用户不清楚该点哪个 | 明确：详情页显示原始 GitHub 数据；单个仓库页显示分析结果 | 否 |
| P1 | Dashboard / StarCatalog / StarExplorer 信息重复 | 导航结构显得乱 | Dashboard 做总览，StarExplorer 做检索分析，StarCatalog 做标签目录 | 否 |

## P2：功能补强

| 优先级 | 问题 | 影响 | 建议动作 | 是否需要 AI API |
|---|---|---|---|---|
| P2 | 没有同步历史 | 无法追踪某次同步发生了什么 | 新增 `sync_runs` 表记录用户、开始/结束时间、状态、错误、rate limit | 否 |
| P2 | 没有手动标签修正 | 规则分类误差无法沉淀 | 增加手动标签编辑，`tag_source=manual` 权重最高 | 否 |
| P2 | Removed Stars 只有标记，没有独立视图 | 无法复盘取消 star 的项目 | 增加 Removed Stars 筛选和复核列表 | 否 |
| P2 | License 风险缺少解释 | 只看到数字，不知道为什么 | 增加 GPL、NOASSERTION、未知协议的解释和仓库列表 | 否 |
| P2 | 导出报告还只是数据导出 | 不是面向阅读的报告 | 增加 Markdown 报告模板：开发者画像、技术栈、风险、推荐仓库 | 可选 |

## AI 功能建议顺序

1. README 摘要：只对用户点开的单个仓库生成，缓存结果。
2. 仓库描述中文摘要：只处理列表当前页或用户主动触发的仓库。
3. Star DNA：基于已有统计和标签生成开发者画像。
4. 学习路径：基于用户选择的标签或仓库集合生成。
5. 替代方案 / 相似项目推荐：需要更完整的 embedding 或规则基线，最后做。

## 下一轮推荐任务

1. 后端补 `GET /api/users/:login/summary`，返回用户级统一统计和数据来源。
2. 前端开发者页、顶部栏、星标仓库页全部使用这个 summary。
3. 后端增加 `sync_runs` 表，前端同步后展示本次同步明细。
4. `classifyAllRepos` 改为按用户分类。
5. 星标仓库页顶部 8 个指标全部改为后端计算。
