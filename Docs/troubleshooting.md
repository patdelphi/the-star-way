# the-star-way 故障排查手册

## 1. 启动时报 `bindings.js:121`

### 现象

启动脚本输出：

```text
Starting...
Checking native modules...

STARTUP FAILED: C:\Users\patde\Documents\GitHub\the-star-way\backend\node_modules\bindings\bindings.js:121
```

完整错误通常是：

```text
better_sqlite3.node was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 137.
```

### 根因

`better-sqlite3` 是 native 模块，会按当前 Node.js ABI 编译。

- Node.js v22 对应 `NODE_MODULE_VERSION 127`。
- Node.js v24 对应 `NODE_MODULE_VERSION 137`。
- 如果安装或 rebuild 时使用 Node v22，但启动时使用 Node v24，就会在加载 `better_sqlite3.node` 时失败。

本机还出现过第二层问题：`pnpm.cmd` 来自 Codex runtime，而启动使用系统 Node。这样 rebuild 可能继续走错 Node，导致问题反复出现。

### 当前修复

`start-project.ps1` 已做以下处理：

- 固定解析系统 `node.exe` 路径。
- 优先使用系统 Node 同目录的 `corepack.cmd pnpm` 执行 `pnpm rebuild better-sqlite3`。
- 后端和前端子进程都使用同一个 Node 路径启动。
- native 检查失败时打印完整尾部错误，不再只显示 `bindings.js:121`。

### 手动修复命令

如果再次遇到 native ABI 报错，在项目根目录执行：

```powershell
cd "C:\Users\patde\Documents\GitHub\the-star-way\backend"
corepack pnpm rebuild better-sqlite3
node -e "const Database = require('better-sqlite3'); new Database(':memory:').close(); console.log('native-ok')"
```

看到 `native-ok` 表示 native 模块已按当前 Node ABI 可加载。

### 验证启动

```powershell
cd "C:\Users\patde\Documents\GitHub\the-star-way"
.\start-project.ps1
```

如果启动成功，应看到后端和前端 URL。

## 2. GitHub API rate limit 仍按匿名限额

### 现象

即使根目录 `.env` 已配置 GitHub token，同步仍返回：

```json
{"message":"API rate limit exceeded for ..."}
```

### 根因

后端从 `backend` 目录启动时，默认 `dotenv/config` 只读取 `backend/.env`，不会自动读取项目根目录 `.env`。因此后端进程可能没有拿到 `STARWAY_GITHUB_TOKEN`。

### 当前修复

后端已新增统一 env loader：

- 先读取 `backend/.env`。
- 再读取项目根目录 `.env`。
- 不覆盖系统环境变量。

API 启动脚本和真实 GitHub 样本导入脚本都使用这套加载逻辑。

### 验证 token 来源

启动后端后访问：

```text
http://localhost:3210/api/token-source
```

期望返回：

```json
{"data":{"source":"STARWAY_GITHUB_TOKEN","hasToken":true,"envVar":"STARWAY_GITHUB_TOKEN"}}
```

如果 `hasToken` 为 `false`，检查根目录 `.env` 是否有：

```text
STARWAY_GITHUB_TOKEN=...
```
