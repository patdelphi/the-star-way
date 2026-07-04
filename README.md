# the-star-way

> 你的 GitHub Stars 可视化管理工具

把混乱的 GitHub 星标仓库变成结构化的技术资产地图。

## 功能特性

- **星标同步** — 支持匿名和 Token 模式同步 GitHub 星标仓库，增量更新，标记已取消星标的仓库
- **智能分类** — 基于 Topic、仓库名称、描述的规则自动打标签（AI/LLM、前端框架、DevOps、工具等 60+ 分类）
- **多维筛选** — 按语言、标签、关键词搜索、排序和分页浏览
- **统计分析** — 语言分布、主题聚类、协议分布、活跃/沉睡仓库统计
- **仓库详情** — 单个仓库的深度信息页
- **数据导出** — 支持 CSV、JSON、Markdown、HTML 格式导出
- **AI 增强** — Star DNA 画像、学习路径推荐、README 智能摘要（OpenAI-compatible / Ollama）
- **多语言 UI** — 中文/英文切换（react-i18next）
- **主题三态** — 浅色/深色/跟随系统
- **Demo 模式** — 内置真实星标仓库数据，无后端也能体验

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + Vite + TypeScript + Tailwind CSS 4 + Radix UI + Lucide Icons + recharts |
| 后端 | Node.js + TypeScript + better-sqlite3（WAL 模式） |
| API | Node.js 内置 http 模块（零依赖 HTTP 服务） |
| 测试 | Vitest（后端 132 个测试通过） |

## 环境要求

- **Node.js** `v24.15.0`（必须，native 模块 ABI 一致性要求）
- **pnpm** `11.7.0`（通过 corepack 启用，无需单独安装）
- **操作系统**：Windows / macOS / Linux

### Node 版本管理

项目根目录已提供 `.nvmrc` 和 `.node-version`，固定为 `24.15.0`。

```bash
# 使用 nvm（macOS/Linux）
nvm install 24.15.0
nvm use 24.15.0

# 使用 fnm（Windows/macOS/Linux）
fnm install 24.15.0
fnm use 24.15.0
```

启用 corepack（Node.js 自带）：

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
```

## 快速开始

本项目统一通过 `corepack pnpm` 执行依赖安装、测试、构建和 native rebuild。**不要直接使用 `npm` 或 PATH 中的 `pnpm.cmd`**，避免 `better-sqlite3` 按错误 Node ABI 编译。

### 一键启动（推荐）

项目根目录提供启动脚本，自动检查 Node 版本、native 模块、清理旧进程并启动前后端。

#### Windows（PowerShell）

```powershell
.\start.ps1
```

#### macOS / Linux（Bash）

```bash
./start.sh
```

可选参数：

```bash
# 指定端口 + 自动打开浏览器
./start.sh --backend-port 3210 --frontend-port 5173 --open-browser
```

启动后：
- 后端 API：`http://localhost:3210`
- 前端 UI：`http://localhost:5173`

### 手动安装与启动

#### 1. 安装依赖

```bash
# 前端
cd frontend
corepack pnpm install

# 后端
cd ../backend
corepack pnpm install
```

#### 2. 环境变量

根目录提供 `sample.env`。需要 GitHub Token 或 AI Provider 时，复制为 `.env` 后按需填写；基础本地功能不依赖 AI。

```bash
cp sample.env .env
# 按需编辑 .env
```

#### 3. 初始化数据库（导入 Demo 数据）

```bash
cd backend
corepack pnpm exec tsx src/db/seed.ts
```

将 GitHub 星标仓库导入 SQLite（`backend/data/starway.db`）。

#### 4. 启动后端 API

```bash
cd backend
corepack pnpm exec tsx src/api/start.ts
```

API 服务运行在 `http://localhost:3210`。

#### 5. 启动前端开发服务器

```bash
cd frontend
corepack pnpm run dev
```

前端运行在 `http://localhost:5173`，自动连接本地 API。

### 生产构建

```bash
cd frontend
corepack pnpm run build
```

构建产物在 `frontend/dist/` 目录。

## 平台差异说明

### native 模块（better-sqlite3）

`better-sqlite3` 是 native 模块，必须与启动时使用的 Node.js ABI 一致。

- **Windows**：若启动报 `NODE_MODULE_VERSION` 不匹配，运行 `cd backend && corepack pnpm rebuild better-sqlite3`
- **macOS / Linux**：首次安装或切换 Node 版本后，可能需要 `cd backend && corepack pnpm rebuild better-sqlite3`

### 启动脚本差异

| 平台 | 脚本 | 说明 |
|---|---|---|
| Windows | `start.ps1` | PowerShell 脚本，固定 Node 路径、检查 native、后台启动 |
| macOS / Linux | `start.sh` | Bash 脚本，功能等价，使用 `ss`/`lsof`/`curl` 探测端口和就绪状态 |

两个脚本共享相同的 PID 文件格式（`.runtime/pids.json`）和日志目录（`.runtime/`）。

## 项目结构

```
the-star-way/
├── start.ps1                     # Windows 一键启动脚本
├── start.sh                      # macOS/Linux 一键启动脚本
├── .nvmrc                        # Node 版本固定
├── .node-version                 # Node 版本固定
├── sample.env                    # 环境变量示例
├── backend/                      # 后端服务
│   ├── src/
│   │   ├── db/                   # 数据库连接、Schema、类型
│   │   ├── import/               # CSV 导入
│   │   ├── repository/           # 仓库查询与统计
│   │   ├── sync/                 # GitHub 同步（client + syncer）
│   │   ├── classification/       # 规则分类（60+ 标签规则）
│   │   ├── api/                  # HTTP API 服务（端口 3210）
│   │   ├── export/               # CSV/JSON/Markdown/HTML 导出
│   │   └── ai/                   # AI Provider 配置和缓存框架
│   ├── data/                     # SQLite 数据库文件
│   └── ...
├── frontend/                     # 前端应用
│   ├── src/
│   │   ├── pages/                # 页面组件
│   │   │   ├── Dashboard.tsx     # 概览页
│   │   │   ├── Developers.tsx    # 开发者管理
│   │   │   ├── StarExplorer.tsx  # 星标仓库浏览
│   │   │   ├── RepositoryAnalysis.tsx # 仓库分析
│   │   │   └── Settings.tsx      # 设置页
│   │   ├── components/           # UI 组件
│   │   ├── lib/api.ts            # API 客户端
│   │   ├── lib/settings.ts       # 统一设置管理
│   │   └── i18n/                 # 多语言配置
│   └── ...
└── Docs/                         # 项目文档
    ├── requirements.md
    ├── design.md
    ├── tasks.md
    ├── api.md
    ├── deployment.md
    ├── troubleshooting.md
    ├── changelog.md
    └── roadmap.md
```

## API 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/users` | 用户列表 |
| GET | `/api/users/:login/repos` | 仓库列表（支持筛选/排序/分页） |
| GET | `/api/users/:login/repos/:fullName` | 单仓库详情 |
| GET | `/api/users/:login/stats` | 统计数据 |
| GET | `/api/users/:login/summary` | 用户摘要（含 Sleep Stars / Hidden Gems） |
| GET | `/api/users/:login/tags` | 标签列表 |
| GET | `/api/users/:login/star-timeline` | 按月星标时间轴 |
| GET | `/api/users/:login/star-dna` | Star DNA 画像（AI 生成） |
| GET | `/api/users/:login/learning-path` | 学习路径推荐（AI 生成） |
| GET | `/api/repos/:fullName/readme-summary` | README 智能摘要（AI 生成） |
| GET | `/api/repos/:fullName/similar` | 相似项目推荐 |
| POST | `/api/users/:login/classify` | 触发规则分类 |
| POST | `/api/sync` | 触发 GitHub 同步 |
| DELETE | `/api/users/:login` | 删除用户 |
| GET | `/api/overview` | 全局概览（支持业务阈值参数） |
| GET | `/api/export?format=...` | 导出数据（CSV/JSON/Markdown/HTML） |

## 测试

```bash
cd backend
corepack pnpm test             # 运行全部测试
```

测试覆盖：
- 数据库初始化（WAL 模式、事务、建表）
- CSV 导入（解析、防重复、JSON 格式）
- 仓库查询（筛选、排序、分页、业务阈值参数化）
- GitHub 同步（mock 测试，不调用真实 API）
- 规则分类（topic/name/description 三级规则）
- API 路由（所有端点 + 阈值参数解析）
- 导出功能（CSV/JSON/Markdown/HTML）
- AI 缓存框架（Star DNA / Learning Path / README 摘要）
- 启动脚本校验

## 数据库 Schema

| 表 | 说明 |
|---|---|
| `users` | GitHub 用户信息 |
| `repos` | 仓库信息 |
| `stars` | 用户-仓库星标关系（含 starred_at、removed_at） |
| `repo_tags` | 仓库标签（含 tag_source、confidence） |
| `translations` | 翻译缓存（README 摘要 / Star DNA / Learning Path） |
| `analysis_reports` | 分析报告缓存 |
| `sync_runs` | 同步运行记录 |

## 路线图

- **V0.1** 本地数据层、GitHub 同步、规则分类、本地 API、前端对接、导出 ✓
- **V0.2** AI 增强：Star DNA 画像、学习路径推荐、README 摘要、双语缓存 ✓
- **V0.3** 设置页：超时/主题/阈值可配置、三态主题切换、统一存储 ✓
- **V0.4** 星标趋势图：全量时间范围、Brush 缩放、年份智能显示 ✓
- **V0.5** 分享卡片、GitHub Profile Badge、Compare Users、Awesome-list 自动生成

## 开源协议

MIT License
