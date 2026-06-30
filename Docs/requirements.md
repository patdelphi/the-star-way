# the-star-way 需求文档

## 1. 项目目标

把任意 GitHub 用户的 starred repositories 转化为可浏览、可分析、可导出的开发者兴趣地图。

首版目标是做出一个可演示、可本地使用、可持续迭代的 MVP，而不是一次性完成所有 AI 分析能力。

## 2. 目标用户

| 用户 | 核心需求 |
|---|---|
| 初级开发者 | 从优秀开发者 Star 中找到学习路线 |
| 中高级开发者 | 管理长期收藏的开源项目 |
| AI 工具爱好者 | 分析 AI、Agent、MCP、RAG 等方向项目 |
| 开源作者 | 研究热门项目和潜在机会 |
| 技术博主 | 生成可分享的 GitHub 技术兴趣报告 |
| 团队负责人 | 了解候选人或团队成员的技术关注方向 |

## 3. MVP 范围

### P0 必须实现

- 输入 GitHub username。
- 抓取公开 starred repos。
- 写入本地 SQLite。
- 支持增量同步，不直接删除已取消 star 的记录。
- Star List 页面支持浏览、筛选、排序。
- 支持按 stars、forks、updated_at、starred_at、language、license 排序。
- 支持按 language、license、topic、自动标签筛选。
- 支持 CSV、JSON、Markdown 导出。
- 支持基于 topics、repo name、description 的规则分类。
- 内置 Demo 数据，用户不配置 token 也能查看效果。

### P1 后续实现

- 项目详情页。
- 中文/英文简介翻译。
- 标签云和基础 Dashboard。
- Star DNA 技术画像。
- Hidden Gems 和 Dead Stars。
- README 摘要。

### P2 后续实现

- 学习路径生成。
- 项目复用建议。
- License 风险提示。
- 用户对比。
- 分享卡片。
- GitHub Action 定时更新。

## 4. 非目标

- 首版不做在线 SaaS 账户系统。
- 首版不做团队协作权限。
- 首版不依赖外部 AI API 才能运行。
- 首版不做法律意见，只做 license 工程提醒。
- 首版不做复杂图谱推荐。

## 5. Demo 数据观察

当前 CSV 共 691 条记录，适合作为内置 Demo。

Top Languages：

| Language | Count |
|---|---:|
| Python | 254 |
| TypeScript | 125 |
| 未知 | 50 |
| JavaScript | 45 |
| C# | 27 |
| C++ | 26 |
| Rust | 21 |
| Go | 20 |

Top Topics：

| Topic | Count |
|---|---:|
| ai | 71 |
| llm | 65 |
| python | 59 |
| openai | 39 |
| windows | 35 |
| chatgpt | 32 |
| mcp | 31 |
| agent | 30 |
| claude-code | 26 |
| rag | 22 |
| cli | 20 |
| pdf | 18 |

## 6. 完成标准

MVP 完成时，应满足：

- 可以通过 CLI 同步一个公开 GitHub 用户的 Star 列表。
- SQLite 中能查询用户、仓库、star 关系、标签和导出记录。
- UI 能打开 Demo 数据并完成列表浏览、筛选和排序。
- 导出的 CSV、JSON、Markdown 内容与 UI 筛选结果一致。
- 无 GitHub token 时可运行 Demo；有 token 时提高请求额度。
- GitHub API 失败、限流、网络异常都有明确错误提示和重试策略。
