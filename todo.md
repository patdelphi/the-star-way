# 修复任务清单

## 2026-07-02

1. [完成] 检查前端硬编码展示内容，改为来自 API 或当前状态的真实动态内容。
2. [完成] 检查不准确说明文字，尤其是开发者页、星标仓库页、分析页，并补齐语言切换。
3. [完成] 在开发者标签页的同步星标旁增加“查看星标仓库”按钮。
4. [完成] 统一图表 tooltip / popup 的暗色主题样式，避免亮色数字标签。
5. [完成] 解释并修正星标仓库“分数”的业务含义和展示文案。
6. [完成] 复查各业务页面的内容逻辑，删除或替换误导性说明。
7. [完成] 补充测试并执行验证。

---

## 2026-07-03 设置页功能开发

### 范围
A/B/C/D 四组全部实现,存储用统一 namespace localStorage `starway-settings`(JSON 对象,不碰 `.env`)。老的 `starway-github-token`、`starway-lang` 已迁移到统一 namespace 并删除老 key(用户确认"老的去掉")。提供"重置为默认值"按钮。

### 完成状态(2026-07-03)
- Phase 1 前端基础设施:完成(settings.ts 新建、api.ts 改造、Settings.tsx 重写、i18n 追加)
- Phase 2 应用设置到调用方:完成(StarExplorer/RepositoryAnalysis/Developers/TopBar/i18n)
- Phase 3 后端业务阈值可配置:完成(repo-queries.ts 参数化、routes.ts query 解析、threshold.test.ts 16 测试全过)
- Phase 4 验证:前端 verify-ui 47 项通过、前端 build 通过、后端 tsc 通过、后端 threshold 测试通过;后端全部测试 126 passed / 4 failed(4 个失败为 HEAD 版本预先存在的 translations 表测试隔离问题,与 Phase 3 无关,待用户确认是否修复)

### 详细任务

#### Phase 1: 前端基础设施(A/B/C 组前端部分)

- [ ] 1.1 新建 `frontend/src/lib/settings.ts`
  - 类型定义:`AppSettings { aiTimeout, syncTimeout, apiTimeout, pageSize, defaultSort, language, theme, autoGenSummary, confirmForceRegen, sleepDays, gemStarsMin, gemStarsMax }`
  - 默认值常量 `DEFAULT_SETTINGS`(aiTimeout=60000, syncTimeout=180000, apiTimeout=8000, pageSize=20, defaultSort='starred_at:desc', language='auto', theme='auto', autoGenSummary=true, confirmForceRegen=true, sleepDays=90, gemStarsMin=50, gemStarsMax=1000)
  - `getSettings()` / `saveSettings(partial)` / `resetSettings()` / `getSetting(key)`
  - 合并存储值与默认值,保证向后兼容(新增字段时自动取默认)
- [ ] 1.2 修改 `frontend/src/lib/api.ts`
  - 把 `API_TIMEOUT` / `AI_TIMEOUT` / `SYNC_TIMEOUT` 常量改为运行时从 settings 读取,默认值不变
  - `fetchWithTimeout(url, options, timeoutMs?)` 不传 timeoutMs 时按 URL 前缀判定:含 `/sync` 用 syncTimeout,含 `readme-summary|star-dna|learning-path` 用 aiTimeout,其他用 apiTimeout
  - 调用 `getStats/getUserSummary/getGlobalOverview` 时传入 sleepDays / gemStarsMin / gemStarsMax 作为 query 参数
- [ ] 1.3 重构 `frontend/src/pages/Settings.tsx`,新增卡片:
  - **超时类**:`AI 超时(s)` 数字输入(范围 30-180,步进 10) / `同步超时(s)` 数字输入(60-600,步进 30) / `普通 API 超时(s)` 数字输入(3-30,步进 1)
  - **浏览体验**:`默认每页数量` 下拉(20/50/100) / `默认排序` 下拉(starred_at desc / stars desc / pushed_at desc / full_name asc) / `界面语言` 下拉(中文/英文/跟随系统) / `主题` 下拉(浅色/深色/跟随系统)
  - **AI 行为**:`仓库详情自动生成摘要` Switch / `强制重生成二次确认` Switch
  - **业务阈值**:`Sleep Stars 天数` 数字(30-365) / `Hidden Gems stars 区间` 两个数字(min/max,带校验 min<max)
  - 底部"重置为默认值"按钮(二次确认弹窗)
  - 所有字段 onChange 即保存(无独立提交按钮),保存后 toast 提示
- [ ] 1.4 i18n 新增 settings.* 子树(zh-CN.json / en-US.json 同步追加)
  - `settings.timeouts.*`、`settings.browsing.*`、`settings.ai.*`、`settings.thresholds.*`、`settings.reset.*`
  - 保证 `verify-ui.mjs` 静态校验通过(无中文 string literal)

#### Phase 2: 应用设置到调用方

- [ ] 2.1 修改 `frontend/src/pages/StarExplorer.tsx`:初始 pageSize / sort 从 settings 读取
- [ ] 2.2 修改 `frontend/src/pages/RepositoryAnalysis.tsx`(仓库详情页):
  - 自动生成摘要开关生效:关闭时不自动调 `getReadmeSummary`,改为显示"点击生成"按钮
  - 强制重生成二次确认:点击"重新生成"按钮时弹 confirm
- [ ] 2.3 修改 Star DNA / Learning Path 重新生成按钮,同样接入"强制重生成二次确认"开关
- [ ] 2.4 主题切换扩展:
  - `frontend/src/components/layout/TopBar.tsx` 把 `light|dark` 扩展为 `light|dark|auto`
  - `auto` 模式监听 `prefers-color-scheme`,系统切换时自动跟随
  - 主题选择从 settings 读取,与 TopBar 共享状态(可用 useState + window 事件)
- [ ] 2.5 界面语言切换:settings 中 `language` 改变时调用 `i18n.changeLanguage(lng)`,auto 模式跟随 navigator

#### Phase 3: 后端业务阈值可配置(D 组)

- [ ] 3.1 `backend/src/repository/repo-queries.ts`:`getUserSummary` / `getGlobalOverview` / `getHiddenGems` 等接受可选参数 `options?: { sleepDays?, gemStarsMin?, gemStarsMax? }`,无参数时用现有常量(向后兼容)
- [ ] 3.2 `backend/src/api/routes.ts`:`/api/users/:login/summary`、`/api/overview` 解析 query 参数 `sleepDays / gemStarsMin / gemStarsMax`,转 number 后传入,带范围校验(非法值回退到默认)
- [ ] 3.3 后端测试更新:`backend/src/__tests__` 或对应 `__tests__/` 加测试用例,验证自定义阈值生效
- [ ] 3.4 前端 api.ts 调用 summary / overview 时带上 settings 中的阈值参数

#### Phase 4: 验证

- [ ] 4.1 前端 `pnpm run verify-ui` 通过
- [ ] 4.2 前端 `pnpm run build` 通过
- [ ] 4.3 后端 `pnpm test` 全部通过(原 111 + 新增)
- [ ] 4.4 后端 `pnpm run build` 通过
- [ ] 4.5 手动验证:改设置→刷新→设置保留;改超时→触发对应接口生效;改阈值→Hidden Gems/Sleep Stars 数量变化;主题/语言跟随系统切换

### 关键假设(需要你确认)

1. **存储方式**:统一 `starway-settings` JSON key(若你坚持分散多 key,告知后改)
2. **保存策略**:onChange 即保存,无提交按钮;如果想要"保存"按钮集中提交,告知后改
3. **业务阈值生效范围**:仅影响前端展示的统计数(Sleep Stars/Hidden Gems 计数),不影响数据存储;后端 query 参数向后兼容,无参数时行为不变
4. **主题 auto 模式**:监听 `prefers-color-scheme`,系统主题变化时自动切换
5. **语言 auto 模式**:跟随 `navigator.language`,但用户手动选过的语言优先(已存在的 `starway-lang` 不动)
6. **强制重生成二次确认**:仅对"重新生成"类按钮(Star DNA / Learning Path / README 摘要),不影响首次自动生成

### 风险与注意

- D 组需要前后端联动 + 后端测试更新,改动较大,放最后做
- `verify-ui.mjs` 严格扫中文 string literal,所有新文案必须走 i18n
- 老的 `starway-lang` / `starway-github-token` 不迁移,避免破坏现有 TopBar 语言切换和 GitHub Token 卡片
- 主题 `auto` 模式需要监听 `matchMedia`,组件卸载时清理监听器避免内存泄漏
