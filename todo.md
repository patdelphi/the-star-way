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
