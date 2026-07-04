# the-star-way 部署与运行规划

## 1. 首版运行方式

项目开发环境固定使用 Node.js `24.15.0`，并统一通过 `corepack pnpm` 执行依赖安装、测试、构建和 native rebuild。

本地开发启动：

```powershell
cd "C:\Users\patde\Documents\GitHub\the-star-way"
.\start.ps1
```

Linux/macOS：

```bash
./start.sh
```

手动启动：

```powershell
cd "C:\Users\patde\Documents\GitHub\the-star-way\backend"
corepack pnpm install
corepack pnpm exec tsx src/api/start.ts
```

```powershell
cd "C:\Users\patde\Documents\GitHub\the-star-way\frontend"
corepack pnpm install
corepack pnpm run dev
```

未来 npm 包形态：

```bash
npx the-star-way import-demo
npx the-star-way ui
```

或：

```bash
npx the-star-way sync <github-username>
npx the-star-way ui
```

## 2. 本地数据目录

默认数据目录建议：

```text
~/.the-star-way/
  the-star-way.sqlite
  config.json
  exports/
```

项目开发目录可保留 Demo 数据，但用户真实数据应写入用户目录。

## 3. 权限策略

- 匿名模式：只访问公开 GitHub API。
- Token 模式：只需要读取公开信息，不要求 repo 写权限。
- 日志禁止输出 token。
- 配置文件权限尽量限制为当前用户可读写。

## 4. 发布策略

MVP 发布目标：

- npm 包：提供 CLI 和本地 UI 启动命令。
- GitHub Release：提供版本说明和 Demo 截图。
- README：提供 3 分钟快速上手。

## 5. 未来部署形态

| 形态 | 用途 | 优先级 |
|---|---|---|
| 本地 CLI + UI | 默认使用方式 | P0 |
| 静态 Demo 页面 | 展示产品效果 | P1 |
| GitHub Action | 定时生成报告 | P2 |
| Cloudflare Pages | 托管公开报告 | P2 |
| SaaS | 多用户在线服务 | 暂不做 |

## 6. 生产注意事项

- 依赖安装和构建统一使用 `corepack pnpm`，避免 PATH 中其他 pnpm 绑定不同 Node 版本。
- 生产环境必须使用 sandbox 和最小权限 token。
- 部署前必须跑 lint、test、type-check、build。
- 数据库迁移必须单独确认并备份。
- 外部 API provider 必须可配置、可关闭。
