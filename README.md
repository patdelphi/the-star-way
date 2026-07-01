# the-star-way

> 你的 GitHub Stars 可视化管理工具

把混乱的 GitHub 星标仓库变成结构化的技术资产地图。

## 功能特性

- **星标同步** — 支持匿名和 Token 模式同步 GitHub 星标仓库，增量更新，标记已取消星标的仓库
- **智能分类** — 基于 Topic、仓库名称、描述的规则自动打标签（AI/LLM、前端框架、DevOps、工具等 60+ 分类）
- **多维筛选** — 按语言、标签、关键词搜索、排序和分页浏览
- **统计分析** — 语言分布、主题聚类、协议分布、活跃/沉睡仓库统计
- **仓库详情** — 单个仓库的深度信息页
- **数据导出** — 支持 CSV、JSON、Markdown 格式导出
- **多语言 UI** — 中文/英文切换（react-i18next）
- **AI 增强框架** — 预留 OpenAI-compatible / Ollama 接口（V0.2 启用）
- **Demo 模式** — 内置 691 条真实星标仓库数据，无后端也能体验

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + Vite + TypeScript + Tailwind CSS 4 + Radix UI + Lucide Icons |
| 后端 | Node.js + TypeScript + better-sqlite3（WAL 模式） |
| API | Node.js 内置 http 模块（零依赖 HTTP 服务） |
| 测试 | Vitest（后端 94 个测试通过） |

## 快速开始

### 1. 安装依赖

```bash
# 前端
cd frontend
npm install

# 后端
cd backend
npm install
```

### 1.1 环境变量

根目录提供 `sample.env`。需要 GitHub Token 或 AI Provider 时，复制为 `.env` 后按需填写；基础本地功能不依赖 AI。

### 2. 初始化数据库（导入 Demo 数据）

```bash
cd backend
npx tsx src/db/seed.ts
```

将 691 条 GitHub 星标仓库导入 SQLite（`backend/data/starway.db`）。

### 3. 启动后端 API

```bash
cd backend
npx tsx src/api/start.ts
```

API 服务运行在 `http://localhost:3210`。

### 4. 启动前端开发服务器

```bash
cd frontend
npm run dev
```

前端运行在 `http://localhost:5173`，自动连接本地 API。

### 5. 生产构建

```bash
cd frontend
npm run build
```

构建产物在 `frontend/dist/` 目录。

## 项目结构

```
the-star-way/
├── backend/                      # 后端服务
│   ├── src/
│   │   ├── db/                   # 数据库连接、Schema、类型
│   │   ├── import/               # CSV 导入
│   │   ├── repository/           # 仓库查询与统计
│   │   ├── sync/                 # GitHub 同步（client + syncer）
│   │   ├── classification/       # 规则分类（60+ 标签规则）
│   │   ├── api/                  # HTTP API 服务（端口 3210）
│   │   ├── export/               # CSV/JSON/Markdown 导出
│   │   └── ai/                   # AI Provider 配置和缓存框架
│   ├── data/                     # SQLite 数据库文件
│   └── ...
├── frontend/                     # 前端应用
│   ├── src/
│   │   ├── pages/                # 页面组件
│   │   │   ├── Developers.tsx    # 开发者管理
│   │   │   ├── StarExplorer.tsx  # 星标仓库浏览
│   │   │   ├── RepositoryAnalysis.tsx # 仓库分析
│   │   │   └── RepoDetail.tsx    # 仓库详情
│   │   ├── components/           # UI 组件
│   │   ├── lib/api.ts            # API 客户端
│   │   └── i18n/                 # 多语言配置
│   └── ...
└── Docs/                         # 项目文档
    ├── requirements.md
    ├── design.md
    ├── tasks.md
    ├── api.md
    ├── roadmap.md
    └── development-plan.md
```

## API 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/users` | 用户列表 |
| GET | `/api/users/:login/repos` | 仓库列表（支持筛选/排序/分页） |
| GET | `/api/users/:login/repos/:fullName` | 单仓库详情 |
| GET | `/api/users/:login/stats` | 统计数据 |
| GET | `/api/users/:login/tags` | 标签列表 |
| POST | `/api/users/:login/classify` | 触发规则分类 |
| POST | `/api/sync` | 触发 GitHub 同步 |
| GET | `/api/export?format=...` | 导出数据 |

## 测试

```bash
cd backend
npm test          # 运行全部测试（当前 94 个通过）
npm run test:watch # 监听模式
```

测试覆盖：
- 数据库初始化（WAL 模式、事务、建表）
- CSV 导入（解析、防重复、JSON 格式）
- 仓库查询（筛选、排序、分页）
- GitHub 同步（mock 测试，不调用真实 API）
- 规则分类（topic/name/description 三级规则）
- API 路由（所有端点）
- 导出功能（CSV/JSON/Markdown）
- AI 缓存框架

## 数据库 Schema

| 表 | 说明 |
|---|---|
| `users` | GitHub 用户信息 |
| `repos` | 仓库信息 |
| `stars` | 用户-仓库星标关系（含 starred_at、removed_at） |
| `repo_tags` | 仓库标签（含 tag_source、confidence） |
| `translations` | 翻译缓存（V0.2 启用） |
| `analysis_reports` | 分析报告缓存（V0.3 启用） |

## 路线图

- **V0.1** 本地数据层、GitHub 同步、规则分类、本地 API、前端对接、导出仍在联调
- **V0.2** 自动打标、AI 翻译（OpenAI/Ollama）、标签云、项目详情页完善
- **V0.3** Star DNA、兴趣趋势、年度 Wrapped、Hidden Gems / Sleep Stars 分析
- **V0.4** 学习路线生成、技术栈组合建议、Build Ideas from Stars
- **V0.5** 分享卡片、GitHub Profile Badge、Compare Users、Awesome-list 自动生成

## 开源协议

MIT License
