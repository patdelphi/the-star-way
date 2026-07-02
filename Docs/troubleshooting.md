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

- 固定要求 Node.js `v24.15.0`，版本不一致时直接终止启动。
- 固定解析系统 `node.exe` 路径。
- 优先使用系统 Node 同目录的 `corepack.cmd pnpm` 执行 `pnpm rebuild better-sqlite3`。
- 后端和前端子进程都使用同一个 Node 路径启动。
- native 检查失败时打印完整尾部错误，不再只显示 `bindings.js:121`。

项目根目录已提供版本声明：

```text
.node-version
.nvmrc
```

两者都固定为：

```text
24.15.0
```

`backend/package.json` 和 `frontend/package.json` 也声明：

```json
"engines": {
  "node": ">=24.15.0 <25"
}
```

因此安装依赖、rebuild native 模块、启动服务必须使用同一个 Node 主版本：Node.js v24。

本项目所有开发命令统一使用：

```powershell
corepack pnpm <command>
```

不要直接使用：

```powershell
pnpm <command>
```

原因是 PATH 中可能存在其他运行时附带的 `pnpm.cmd`，它可能绑定不同 Node 版本，导致 native 模块再次按错误 ABI 编译。

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

## 3. 直接运行 `pnpm` 出现 Node 版本不一致

### 现象

执行测试或构建时出现：

```text
Unsupported engine: wanted: {"node":">=24.15.0 <25"} (current: {"node":"v24.14.0","pnpm":"11.7.0"})
```

同时直接检查系统 Node 又显示：

```powershell
node -p "process.versions.node"
```

结果为：

```text
24.15.0
```

### 根因

Windows PATH 中可能优先命中其他运行时附带的 `pnpm.cmd`。该 `pnpm.cmd` 自己绑定的 Node 版本可能不是系统 Node，因此会出现：

- `node` 是 `24.15.0`。
- `pnpm` 内部实际使用 `24.14.0` 或其他版本。
- native rebuild、test、build 使用的 Node 与启动 Node 不一致。

### 当前结论

本项目后续统一使用：

```powershell
corepack pnpm <command>
```

常用命令：

```powershell
corepack pnpm install
corepack pnpm test
corepack pnpm run build
corepack pnpm rebuild better-sqlite3
```

不要直接使用：

```powershell
pnpm install
pnpm test
pnpm run build
pnpm rebuild better-sqlite3
```

### 验证命令

```powershell
node -p "process.versions.node"
corepack pnpm exec node -p "process.versions.node"
```

两者都应输出：

```text
24.15.0
```
