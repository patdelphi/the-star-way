# the-star-way 设计文档

## 1. 关键假设

- 技术栈优先 TypeScript 全栈，便于 CLI、Web UI 和类型复用。
- 数据默认本地优先，SQLite 是主存储。
- AI 能力是增强项，不能阻塞基础功能。
- GitHub API 只作为数据源，不把用户数据写回 GitHub。
- Demo CSV 是首版展示数据源之一。

## 2. 推荐架构

```text
the-star-way/
  apps/
    cli/              # 命令行入口
    web/              # 本地 Web UI
  packages/
    core/             # GitHub 同步、分类、分析、导出核心逻辑
    db/               # SQLite schema、migration、repository
    ui/               # 可复用 UI 组件
    config/           # 配置读取与校验
  data/               # 本地 SQLite 和 Demo 数据
  Docs/               # 项目文档
```

## 3. 模块边界

| 模块 | 职责 | 不负责 |
|---|---|---|
| CLI | 接收命令、读取配置、调用 core | 直接操作 UI 组件 |
| Web UI | 浏览、筛选、展示报告 | 直接调用 GitHub API |
| Core | 同步、分类、分析、导出 | 存储细节 |
| DB | SQLite schema、事务、查询 | 业务分类规则 |
| Config | token、路径、语言、provider 配置 | 存储业务数据 |
| Exporter | CSV、JSON、Markdown、HTML 输出 | 决定分析结论 |

## 4. 数据库设计

SQLite 必须启用：

```sql
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
```

所有数据库写操作必须使用事务。

核心表：

```sql
users(login, avatar_url, profile_url, synced_at)
repos(github_id, full_name, owner, name, html_url, description, language, license, stars, forks, open_issues, topics_json, created_at, updated_at, pushed_at, archived, fork, homepage)
stars(user_login, repo_full_name, starred_at, first_seen_at, last_seen_at, removed_at)
repo_tags(repo_full_name, tag, tag_source, confidence)
translations(repo_full_name, target_lang, translated_description, translated_readme_summary, provider, updated_at)
analysis_reports(user_login, report_type, lang, content_json, created_at)
```

## 5. 同步流程

```text
1. 读取 username 和配置。
2. 请求 GitHub starred repos。
3. 标准化 repo metadata。
4. 在事务中 upsert repos。
5. 在事务中 upsert stars。
6. 对本地存在但本次未返回的 repo 标记 removed_at。
7. 运行规则分类。
8. 更新 synced_at。
```

## 6. 分类策略

首版使用规则优先：

- GitHub topics 强匹配，置信度 0.95。
- repo name 关键词匹配，置信度 0.85。
- description 关键词匹配，置信度 0.80。
- 用户手动确认，置信度 1.00。

AI 分类延后到 P1/P2。

## 7. API 异常处理

所有 API 调用必须捕获并分类处理：

| 异常 | 处理 |
|---|---|
| 401/403 | 提示 token 无效或权限不足 |
| 404 | 提示用户不存在或仓库不可见 |
| 429/限流 | 展示 reset 时间，停止重试 |
| 5xx | 指数退避重试，最多 3 次 |
| 网络错误 | 提示网络状态，允许重新执行 |
| 数据字段缺失 | 使用默认值并记录 warning |

## 8. UI 信息架构

MVP 页面：

- Dashboard：总数、Top Language、Top Topics、最近同步时间。
- Star List：主列表、筛选、排序、导出。
- Repo Detail：仓库元数据、标签、license、外链。
- Settings：GitHub token、本地数据库路径、语言。

P1 页面：

- Map：标签云、兴趣时间线。
- Reports：Star DNA、Hidden Gems、Dead Stars。
- Learning Path：学习路径建议。

## 9. 测试策略

- Core：用 fixture 测 GitHub 响应解析、同步差异、分类规则。
- DB：用临时 SQLite 测事务、WAL、upsert、removed_at。
- Exporter：用固定输入校验 CSV/JSON/Markdown 输出。
- CLI：用 mock core 校验参数解析和错误提示。
- UI：用 Demo 数据校验筛选、排序和导出入口。

## 10. 安全策略

- Token 只存本地配置，不上传。
- 日志不输出 token。
- 生产环境使用最小权限 token。
- 外部 API 调用必须可关闭。
- Demo 模式不能依赖网络。
