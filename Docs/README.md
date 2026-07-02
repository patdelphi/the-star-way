# the-star-way 项目文档

## 项目说明

`the-star-way` 是一个把 GitHub Star 列表转化为开发者兴趣地图、学习路线和开源项目导航器的本地优先工具。

当前规划基于：

- `init-idea.md`：原始产品设想。
- `github_starred_projects_691_COMPLETE.csv`：691 条 Demo Star 数据。

## 文档索引

1. `requirements.md`：需求范围、用户、功能优先级、验收标准。
2. `design.md`：系统架构、模块边界、数据库设计、异常处理策略。
3. `tasks.md`：分阶段执行任务和完成标准。
4. `api.md`：CLI、内部服务接口、数据导出接口规划。
5. `deployment.md`：本地运行、打包、发布和权限策略。
6. `optimization-plan.md`：后续优化方向和性能策略。
7. `roadmap.md`：版本路线图。
8. `feature-list.md`：功能清单与 AI API 依赖划分。
9. `development-plan.md`：正式代码开发计划。
10. `troubleshooting.md`：启动、native 模块和 GitHub token 常见问题排查。
11. `dual-architecture-cloudflare-plan.md`：本地架构与 Cloudflare 架构并存的改造方案。
12. `changelog.md`：规划文档变更记录。

## 当前关键结论

首版不要重 AI，先做可跑通的本地 MVP：GitHub Star 同步、SQLite 存储、列表浏览、筛选排序、基础规则分类、CSV/Markdown 导出。

## 当前前端 Demo 结论

- `星标仓库` 是开发者全部 Star 仓库的全局分析页。
- `单个仓库` 是选中某个仓库后的仓库分析页。
- 当前 Demo 已补齐顶部搜索、筛选排序、导出预览、限流提示、同步状态和 8 个星标仓库顶部信息块。
- 多语言切换后续采用轻量前端方案，优先抽离 UI 文案，仓库原始数据不翻译。
