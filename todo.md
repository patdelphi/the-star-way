# 发布项目（自有仓库）功能完善 - Todo

## 背景
现有"自有仓库"（user_repos）已支持抓取、统计、产出画像，但只在开发者页"我的项目"区块做了简易展示。本次按用户确认的方案完善为完整的"发布项目"一级功能。

## 已确认方案
- 发布项目页：**独立新页面**
- 分类目录：**来源切换 + 标签云过滤**
- 仓库分析下拉：**合并星标 + 发布项目**

## 任务清单

### 1. 开发者页区块精简（需求1）
- [ ] `frontend/src/pages/Developers.tsx`：删除"自有公开项目列表"渲染，仅保留产出画像卡片 + 统计摘要 badges
- [ ] i18n：`developers.myProjectsTitle` "我的项目" → "发布项目"（zh-CN.json / en-US.json）

### 2. 独立"发布项目"页（需求2）
- [ ] 后端：确认 `owned-stats` / `owned-repos` 接口已可用（已存在）
- [ ] 前端：新建 `frontend/src/pages/PublishedProjects.tsx`，复用 StarExplorer 的列表/筛选/分页/统计逻辑，数据源改用 `getOwnedRepos` + `getOwnedStats`，去掉星标特有功能（removed stars、星标 DNA、share 卡片等）
- [ ] `frontend/src/App.tsx`：注册路由 `/published`
- [ ] `frontend/src/components/layout/Sidebar.tsx`：在"星标仓库"下新增菜单"发布项目"
- [ ] i18n：新增 `nav.publishedProjects` 及页面文案（zh-CN.json / en-US.json）

### 3. 分类目录包含发布项目（需求3）
- [ ] 后端：`backend/src/classification/classifier.ts` 扩展 `classifyReposForUser` 支持自有仓库（scope=owned），新增 `classifyOwnedReposForUser`
- [ ] 后端：`backend/src/api/routes.ts` 新增 `POST /api/users/:login/classify-owned`（或给 classify 加 scope 参数）
- [ ] 前端：`frontend/src/pages/StarCatalog.tsx` 加"来源"切换（星标/发布项目/汇总），按来源拉取数据 + 标签云过滤
- [ ] 前端：`frontend/src/lib/api.ts` 新增自有仓库分类接口（如 `classifyOwned(login)`）
- [ ] i18n：分类来源切换文案

### 4. 仓库分析支持发布项目（需求4）
- [ ] 后端：`backend/src/repository/repo-queries.ts` 扩展 `queryRepoByNameForUser`，stars 查不到时回退 user_repos（`starred_at=null`）
- [ ] 前端：`frontend/src/pages/RepositoryAnalysis.tsx` 下拉列表合并 `getRepos` + `getOwnedRepos`（按 full_name 去重）
- [ ] i18n：如需要新增文案

### 5. 测试与验证
- [ ] 全量测试：跑后端 lint/test/build、前端 tsc + build + UI verify
- [ ] 本地启动前后端，人工验证 4 项功能

## 备注
- 分析接口（readme-summary）按 full_name 查 repos 表，不区分来源，自有仓库分析天然可用，无需改动后端该路由
- repo_tags 为全局表，星标/自有仓库分类标签按来源集合清除，需避免误删（分类时严格限定来源仓库集合）