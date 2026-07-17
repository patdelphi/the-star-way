# Share Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (not used because the user prohibited subagents) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 Developers 页为 Star DNA 增加基于现有数据的分享卡片预览与 PNG 下载能力。

**Architecture:** 新增独立的 ShareCard 组件，使用浏览器原生 SVG 字符串生成卡片并通过 Blob 下载 PNG；组件只接收开发者资料、摘要统计、标签、Star DNA 和学习路径，不新增后端接口。Developers 页负责组装数据与打开预览弹窗，现有 AI 请求和状态流保持不变。

**Tech Stack:** React 19、TypeScript、Tailwind CSS、浏览器原生 SVG/Canvas/Blob API、react-i18next。

## Global Constraints

- 只修改分享卡片相关前端文件，不顺手重构 Developers 页面。
- 不新增第三方依赖，不改后端 API，不执行 Git commit/push。
- 所有新增 UI 文案同时加入 zh-CN 和 en-US。
- 下载失败必须有可见错误提示，不能静默失败。
- 新增逻辑先写可执行校验，再实现。

---

### Task 1: Add failing static regression checks

**Files:**
- Modify: frontend/scripts/verify-ui.mjs
- Test: frontend/scripts/verify-ui.mjs via corepack pnpm test

- [x] 增加检查：Developers 页面包含 ShareCard 组件、分享按钮 i18n key 和下载处理函数。
- [x] 增加检查：中英文语言包同时包含分享卡片标题、预览、下载、失败提示和统计字段文案。
- [x] 运行测试，确认新检查因目标代码尚不存在而失败；由于 Corepack 版本漂移，使用本地 pnpm 11.7.0 完成校验。

### Task 2: Implement pure SVG card builder

**Files:**
- Create: frontend/src/lib/share-card.ts

**Interfaces:**
- ShareCardData：login、displayName、avatarUrl、repoCount、hiddenGemsCount、sleepStarsCount、topInterests、learningPath、starDna、language。
- buildShareCardSvg(data: ShareCardData): string：返回包含 1080x1080 根 SVG 和转义文本的字符串。
- downloadShareCard(data: ShareCardData, filename: string): void：生成 SVG Blob，通过 Canvas 转换为 PNG 并触发浏览器下载；Canvas/Blob 错误向上抛出。

- [x] 通过静态回归校验锁定 SVG builder 和 PNG 下载函数入口。
- [x] 实现最小 SVG builder，沿用已确认的深色渐变、圆角玻璃面板、标签和统计块布局。
- [x] 实现 PNG 下载：SVG 图片加载失败、Canvas 为空或 toBlob 返回 null 时抛出明确错误。
- [x] 运行前端测试并确认通过。

### Task 3: Add ShareCard preview dialog to Developers

**Files:**
- Create: frontend/src/components/ShareCard.tsx
- Modify: frontend/src/pages/Developers.tsx
- Modify: frontend/src/i18n/locales/zh-CN.json
- Modify: frontend/src/i18n/locales/en-US.json

- [x] 在 Star DNA 卡片标题栏增加分享按钮，仅在当前开发者存在时显示。
- [x] 打开预览弹窗，展示 1080x1080 SVG 卡片；弹窗提供下载 PNG 和关闭按钮。
- [x] 组装现有 activeDev、developerStats、developerTags、starDna、learningPath 数据，并复用用户摘要统计。
- [x] top interests 取本地标签按 count 降序前 5 个；无标签时使用语言统计前 5 个；无 AI 内容时显示稳定占位文案。
- [x] 下载期间禁用按钮；失败使用现有页面错误提示样式和本地化文案。
- [x] 运行前端测试，确认静态校验通过。

### Task 4: Verify build and inspect diff

**Files:**
- No additional files.

- [x] 运行前端构建，确认 TypeScript 和 Vite 构建通过。
- [x] 运行 git diff --check，确认无空白错误。
- [x] 运行 git status --short，确认只包含分享卡片相关文件、Mockup 和实施计划。
- [x] 汇报修改文件、验证结果和未执行的 Git 操作。
