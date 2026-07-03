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

## 4. 开发者页生成 DNA/学习路径时白屏

### 现象

在一个用户正在生成 Star DNA 画像或学习路径时，搜索并添加另一个用户，开发者页面可能白屏。

### 根因

前端部分页面默认后端响应一定是完整数组或完整统计结构。例如时间线接口异常、用户不存在、接口短暂不可用时，页面仍直接执行 `.map()`、`.reduce()` 或读取嵌套字段，React 渲染阶段抛错后会导致整页白屏。

另一个关联问题是 API 可用性探测曾把离线状态永久缓存在前端进程里。后端恢复后，页面仍可能继续走离线兜底，造成搜索、添加和刷新状态不一致。

### 当前修复

- `frontend/src/lib/api.ts` 统一归一化 API 响应：
  - 仓库列表始终返回 `{ items, total }`。
  - 用户统计、全局概览始终返回可读数组字段。
  - 标签、同步记录、时间线和已移除星标统一用空数组兜底。
- `frontend/src/pages/Developers.tsx` 对 Star 时间线、标签和统计加载增加防御。
- `frontend/src/pages/RepositoryAnalysis.tsx` 和 `frontend/src/pages/StarExplorer.tsx` 对仓库列表和标签结果增加防御。
- `frontend/src/components/ErrorBoundary.tsx` 捕获渲染异常，避免单个页面状态异常导致整站白屏。
- API 可用性探测只缓存成功状态；失败状态会在后续调用继续重试。

### 验证命令

```powershell
cd "C:\Users\patde\Documents\GitHub\the-star-way\frontend"
pnpm test
pnpm build

cd "C:\Users\patde\Documents\GitHub\the-star-way\backend"
pnpm test
pnpm build
```

当前期望：

- 前端 UI 校验通过 47 项。
- 后端测试通过 111 项。

## 5. 异常 URL 编码导致 API 500

### 现象

访问包含非法百分号编码的仓库通配路径时，后端可能因为 `decodeURIComponent` 抛错返回 500。

### 根因

部分通配路由直接调用 `decodeURIComponent`，没有复用安全解码函数。

### 当前修复

通配路由统一使用 `decodePathParam()`。编码异常时保留原始路径段继续走正常查询，最终返回 404，而不是内部错误。

### 验证

后端测试已覆盖：

```text
路径参数编码异常时不应返回 500
```
