# the-star-way 推广任务清单

> 基于 `Docs/starway promote.md` 方案，按顺序执行。
> 截图/GIF 需用户手动制作，代码层无法自动截图（项目无 Playwright 等工具）。

## 第一阶段：提高 GitHub 页面转化率（代码/文件层）

| # | 任务 | 状态 | 输出 |
|---|---|---|---|
| 1 | README.md 首屏重做 | ☐ | slogan + 链接 + 截图占位 |
| 2 | README.en.md 首屏重做 | ☐ | 同上英文版 |
| 3 | 创建 `Docs/assets/` 目录 | ☐ | `.gitkeep`，待用户放截图 |
| 4 | 创建 `Docs/topics.md` | ☐ | 19 个建议 topics |
| 5 | 创建 `Docs/about.md` | ☐ | About 区域英文卖点 |
| 6 | 创建 `Docs/release-v0.1.0.md` | ☐ | release notes 草稿 |
| 7 | 创建 5 个 issue 模板 | ☐ | `Docs/issues/` |
| 8 | 创建 `Docs/promotion-copy.md` | ☐ | V2EX/X/HN 文案 |
| 9 | README 路线图更新 | ☐ | 补充 Share Card 等传播功能 |
| 10 | CRLF 换行符统一 | ☐ | 所有新建 .md 文件 |

## 第二阶段：需用户操作（社交/网页）

| # | 任务 | 说明 |
|---|---|---|
| A | 制作 10 秒 GIF + 3-5 张截图 | 放入 `Docs/assets/` |
| B | GitHub 网页设置 topics | 复制 `Docs/topics.md` |
| C | GitHub 网页设置 About | 复制 `Docs/about.md` |
| D | 发布 v0.1.0 Release | 复制 `Docs/release-v0.1.0.md` |
| E | 创建 5 个 issues | 复制 `Docs/issues/` |
| F | 确认 Demo 普通访客可访问 | `https://starway.patdelphi.xyz` |
| G | 找 20-30 朋友试用 | 收集反馈 |
| H | 发 V2EX 互动贴 | 复制 `Docs/promotion-copy.md` |
| I | 发微信群/即刻/朋友圈 | 同上 |
| J | 发掘金/SegmentFault 技术文章 | 同上 |
| K | 发 X/Reddit | 同上 |
| L | 发 Show HN | 同上 |

## 第三阶段：传播型功能开发（暂不启动）

| # | 功能 | 优先级 | 状态 |
|---|---|---|---|
| P0 | Share Card（Star DNA 图片导出） | 高 | 暂不开发 |
| P1 | Compare Users（对比两用户） | 中 | 暂不开发 |
| P2 | GitHub Profile Badge | 中 | 暂不开发 |

## 2026-07-13：Cloudflare D1 同步报错

- [x] 将生产 D1 `starway-db` 执行 `cloudflare/d1/migrations/0002_star_sync_continuation.sql`
- [x] 迁移后验证 `sync_runs.next_page` 和 `stars.sync_run_id` 字段存在
- [x] 重新验证 Worker `/api/sync` 分批续传
- [x] 修复仓库改名导致的 `repos.github_id` 唯一键冲突
- [x] 部署修复并验证 `syncId=134` 续传成功
- [x] 修复仓库转移导致的 `repos.full_name` 唯一键冲突
- [x] 部署版本 `2c725b4f-4a66-4b9b-b6a5-7ac25665012c` 并验证 `syncId=137` 续传成功

## 2026-07-13：冗余与过度设计清理

- [x] 移除前端每次请求前重复执行的 `/api/users` 可用性预探测
- [x] 合并 Worker AI 配置就绪判断，统一委托 `loadAiConfig(env).enabled`
- [x] 移除前端和 Worker 路由的冗余 `startPage` 入参，续传页码只读取 D1 `sync_runs.next_page`
- [x] 删除未使用的旧版 `markRemovedStars`，保留按 `sync_run_id` 的最终批次处理
- [x] 更新前端静态 UI 校验规则，覆盖新的 API 请求设计
- [x] 验证 Worker 测试、TypeScript、前端 UI 校验和生产构建
- [ ] 后端与 Worker 的同名用户名规范化函数暂不合并：两者属于独立运行时且均被实际使用

## 2026-07-13：英文错误信息本地化

- [x] 保留 API 错误码，避免同步错误降级为普通 `Error`
- [x] 新增中英文 API 错误文案
- [x] 前端错误展示统一按当前语言翻译，不直接渲染后端中文 message
- [x] 设置页移除服务端原始中文状态 message，改用本地化配置提示
- [x] 验证前端 UI 校验、生产构建和 Worker 测试
- [ ] 提交、推送并部署本次多语言修复

## 2026-07-14：本地开发者页星标同步与 AI 推荐重构

### 关键假设

- 只处理本地版本链路：`frontend/src/pages/Developers.tsx`、`frontend/src/lib/api.ts`、`backend/src/api/routes.ts`、`backend/src/ai/*`、`backend/src/sync/*`；Cloudflare Worker 不纳入本次重构。
- 保留现有 UI 形态，不做视觉重设计；目标是修正状态归属、缓存、同步后刷新和长耗时 AI 请求逻辑。
- 不执行部署、迁移、commit、push、pull；测试只跑幂等的 backend test、frontend build / verify-ui。

### 待执行计划

- [x] 梳理当前本地端到端链路：添加/选择开发者 -> 同步星标 -> 刷新用户列表与统计 -> 生成 Star DNA -> 生成学习路径。
- [x] 先写失败测试，覆盖本地后端 AI 生成缓存、同步中/同步后缓存失效、强制刷新、用户不存在/无星标/不完整同步状态。
- [x] 抽出后端用户级 AI 服务函数，统一 DNA 与学习路径的缓存读取、数据准备、生成、翻译、事务写入和错误回退。
- [x] 重构前端开发者页状态机，明确 active login 归属，避免旧请求覆盖、切换页面/用户后误清空或误写入。
- [x] 同步成功后只刷新目标用户相关数据，清理目标用户 AI 缓存并重新拉取当前可见用户数据。
- [x] 更新 `Docs/changelog.md` 记录根因、改动和验证结果。
- [x] 运行幂等验证：backend 相关测试、frontend 静态 UI 校验、frontend build。

## 2026-07-27：Cloudflare 安全防护只读审计

### 完成标准

- [x] 确认 `starway.patdelphi.xyz` 是否经过 Cloudflare 代理，且不存在明显源站绕过入口。
- [x] 核验 Cloudflare 当前可见的 DDoS、WAF、Bot、限流与 TLS 配置，区分平台默认能力和项目显式配置。
- [x] 检查 Pages、Worker 与应用代码中的安全响应头、CORS、鉴权、防爆破及高成本接口保护。
- [ ] 仅做正常频率的只读请求，不执行压力测试、漏洞利用、部署或配置修改。
- [x] 输出当前防护结论、风险等级和最小加固建议，并说明无法从现有权限确认的项目。

### 执行状态

- [x] 用户已授权访问公开站点，并允许通过 Wrangler CLI 读取 Worker/Pages 状态。
- [x] 读取当前部署、域名与安全相关配置。
- [x] 对照公开响应和项目实现交叉验证。
- [x] 汇总结论并记录验证证据。

### 审计结论

- Pages 与 Worker 均由 Cloudflare 边缘直接承载，已具备 Cloudflare 默认的自动 DDoS 防护和 HTTPS 重定向。
- WAF Managed Rules、Bot Fight Mode 与自定义 Rate Limiting 的实际开关状态无法通过 Wrangler 确认；控制台只读页面连续超时，未将“功能可用”误报为“已启用”。
- Worker 没有鉴权或应用层限流，且 CORS 允许任意来源。公开调用方可触发 GitHub 同步、分类以及带 `force=1` 的 AI 重新生成，存在配额、费用与可用性风险。
- Pages 与 Worker 响应缺少 CSP、HSTS、点击劫持防护和 Permissions Policy；Pages 的 `pages.dev` 生产及历史部署地址仍可直接访问。

## 2026-07-27：Cloudflare 应用层安全加固

### 完成标准

- [x] 保留现有公开只读 API 和前端功能，不引入登录系统或数据库迁移。
- [x] Worker 仅向正式前端、Pages 项目域名和本地开发地址返回 CORS 授权。
- [x] GitHub 同步、分类和 AI 生成接口通过 Cloudflare Workers Rate Limiting binding 按来源 IP 限流。
- [x] Pages 与 Worker 补齐 CSP、HSTS、点击劫持防护、MIME 嗅探防护、Referrer Policy 和 Permissions Policy。
- [ ] 先补安全回归测试，再通过 Worker test/build、Wrangler dry-run、前端校验和生产构建。
- [x] 更新 `Docs/changelog.md` 与对话记录；验证通过后创建独立 commit，不 push、不部署。

### 实施边界与恢复方式

- Worker 使用两个可选 Rate Limiting binding：写操作和 AI 操作分别计数；本地测试缺少 binding 时保持兼容。
- CORS 白名单由 `STARWAY_ALLOWED_ORIGINS` 配置，并显式允许 `starway.patdelphi.xyz`、本项目 `pages.dev` 域名和本地开发端口。
- 不新增 secret，不把管理 Token 放入前端，不改变 D1 schema。
- 如需回滚，删除 `wrangler.toml` 的 `ratelimits` 与允许来源变量，并还原 Worker 安全包装及 `frontend/public/_headers`；不涉及数据恢复。

### 待执行计划

- [x] 新增失败测试，覆盖允许/拒绝来源、安全响应头和高成本接口 429。
- [x] 实现 Worker 统一安全响应包装与高成本路由限流。
- [x] 配置 Wrangler Rate Limiting bindings 与 CORS 允许来源。
- [x] 新增 Cloudflare Pages `_headers`。
- [x] 更新 changelog，运行可用的幂等验证。
- [x] 审查最终 diff 并提交安全加固改动。

### 验证结果

- 独立安全策略测试：9 项通过。
- Worker TypeScript 类型检查通过；Wrangler dry-run 通过并列出两个 `ratelimit` binding。
- 前端静态校验 97 项通过，TypeScript 类型检查和 Vite 生产构建通过，`dist/_headers` 已生成。
- 完整 Worker 路由测试在 Miniflare 启动 D1 时触发 Windows `0xc0000005` 原生进程异常，51 项测试在执行断言前被跳过；因此完整 Worker test 完成标准暂未勾选。
