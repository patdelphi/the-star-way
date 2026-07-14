/**
 * verify-ui.mjs
 * 前端静态功能校验脚本，检查页面能力入口和中英文 i18n 文案是否覆盖核心 Demo 功能。
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")

const readText = (path) => {
  const fullPath = resolve(root, path)
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : ""
}
const readJson = (path) => JSON.parse(readText(path))

function listSourceFiles(dir) {
  const result = []
  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      if (!fullPath.includes(`${resolve(root, "src/i18n/locales")}`)) {
        result.push(...listSourceFiles(fullPath))
      }
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      result.push(fullPath)
    }
  }
  return result
}

function findChineseStringLiterals() {
  const sourceRoot = resolve(root, "src")
  const hits = []
  for (const file of listSourceFiles(sourceRoot)) {
    // 标签字典是业务数据，不是页面硬编码文案。
    if (file.endsWith(resolve(root, "src/lib/tag-labels.ts"))) continue
    const text = readFileSync(file, "utf8")
    const withoutBlockComments = text.replace(/\/\*[\s\S]*?\*\//g, "")
    const lines = withoutBlockComments.split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, ""))
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      // Language self-names intentionally remain in their native language.
      if (file.endsWith(resolve(root, "src/components/layout/TopBar.tsx")) && line.includes('label: "中文"')) continue
      const re = /(['"])(?:\\.|(?!\1).)*?\1/g
      let match
      while ((match = re.exec(line))) {
        if (/[\u4e00-\u9fff]/.test(match[0])) {
          hits.push(`${file}:${i + 1}`)
        }
      }
    }
  }
  return hits
}

const files = {
  app: readText("src/App.tsx"),
  topbar: readText("src/components/layout/TopBar.tsx"),
  sidebar: readText("src/components/layout/Sidebar.tsx"),
  api: readText("src/lib/api.ts"),
  settings: readText("src/lib/settings.ts"),
  settingsPage: readText("src/pages/Settings.tsx"),
  developerContext: readText("src/contexts/DeveloperContext.tsx"),
  analysis: readText("src/pages/RepositoryAnalysis.tsx"),
  explorer: readText("src/pages/StarExplorer.tsx"),
  developers: readText("src/pages/Developers.tsx"),
  dashboard: readText("src/pages/Dashboard.tsx"),
  catalog: readText("src/pages/StarCatalog.tsx"),
  chartTooltip: readText("src/components/ui/chart-tooltip.tsx"),
  shareCard: readText("src/components/ShareCard.tsx"),
  shareCardBuilder: readText("src/lib/share-card.ts"),
}

const locales = {
  zh: readJson("src/i18n/locales/zh-CN.json"),
  en: readJson("src/i18n/locales/en-US.json"),
}

function getByPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj)
}

function flattenValues(obj) {
  return Object.values(obj).flatMap((value) => {
    if (value && typeof value === "object") return flattenValues(value)
    return typeof value === "string" ? [value] : []
  })
}

const zhText = flattenValues(locales.zh).join("\n")
const allPageText = Object.values(files).join("\n")
const chineseStringLiterals = findChineseStringLiterals()

const requiredLocaleKeys = [
  "topBar.searchPlaceholder",
  "topBar.searchResults",
  "topBar.noResults",
  "nav.developers",
  "nav.starExplorer",
  "nav.repoAnalysis",
  "developers.syncStatus",
  "developers.syncStates.rateLimit",
  "apiErrors.AI_TIMEOUT",
  "starExplorer.title",
  "starExplorer.desc",
  "starExplorer.designatedDev",
  "starExplorer.starCount",
  "starExplorer.lastSync",
  "starExplorer.tagCoverage",
  "starExplorer.hiddenGems",
  "starExplorer.sleepingStars",
  "starExplorer.activeRepos",
  "starExplorer.removedStars",
  "starExplorer.licenseRisk",
  "starExplorer.allRepos",
  "starExplorer.exportReport",
  "starExplorer.updateAnalysis",
  "starExplorer.exportPreview",
  "starExplorer.noResults",
  "starExplorer.sortByStarredAt",
  "repoAnalysis.title",
  "repoAnalysis.readmeSummary",
  "repoAnalysis.activityAnalysis",
  "repoAnalysis.techStack",
  "repoAnalysis.licenseRisk",
  "repoAnalysis.similarRepos",
  "developers.shareCard",
  "developers.shareCardPreview",
  "developers.downloadShareCard",
  "developers.shareCardDownloadFailed",
  "developers.shareCardProjectName",
  "developers.shareCardProjectDescription",
  "developers.shareCardSystemUrlLabel",
  "developers.shareCardGithubProfileLabel",
  "developers.shareCardUserTitleSuffix",
  "developers.shareCardDnaLabel",
  "developers.shareCardFullReportHint",
  "developers.shareCardCtaTitle",
  "developers.shareCardCtaSubtitle",
  "developers.shareCardBasedOnStars",
]

const requiredChineseTexts = [
  "搜索仓库",
  "星标仓库",
  "仓库分析",
  "指定开发者",
  "开发者星标全局分析",
  "星标仓库概览",
  "最近同步",
  "自动标签覆盖",
  "隐藏宝石",
  "沉睡星标",
  "活跃仓库",
  "已取消星标",
  "协议风险",
  "全部星标仓库列表",
  "导出报告",
  "更新星标仓库分析",
  "导出预览",
  "无搜索结果",
  "GitHub API 限流",
  "排序：标星时间",
  "README 摘要",
  "活跃度分析",
  "技术栈解析",
  "维护信号",
  "相似项目",
  "分享卡片",
  "下载分享卡片",
]

const forbiddenTexts = [
  "Dead Stars",
  "Demo error state",
  "Demo Only",
  "Repository Intelligence",
  "Python tool for converting files",
  "Reference implementations and community servers",
  "An extremely fast Python package",
  "Build resilient language agents as graphs",
  "Vim-fork focused on extensibility",
  "Convert any URL to an LLM-friendly input",
  "A once-popular admin template",
  "Package Manager",
  "Virtualenv",
  "detected",
  "Tech",
  "AI/ML",
  "原圆环图并非 100% 占比",
  "静态评分用于呈现未来分析结果",
  "模拟 README",
  "演示结论",
  "模拟分析",
  "内置 Demo 数据",
  "DEMO_TAGS",
  "DEMO_REPOS",
]

const checks = [
  ["中英文 locale 可解析", Boolean(locales.zh.app && locales.en.app)],
  ["前端源码无中文字符串硬编码（locale 除外）", chineseStringLiterals.length === 0],
  ["核心 locale key 完整", requiredLocaleKeys.every((key) => getByPath(locales.zh, key) && getByPath(locales.en, key))],
  ["中文文案覆盖核心功能", requiredChineseTexts.every((text) => zhText.includes(text))],
  ["顶部搜索使用 i18n", files.topbar.includes("topBar.searchPlaceholder") && files.topbar.includes("topBar.searchResults")],
  ["侧边栏导航使用 i18n", files.sidebar.includes("nav.starExplorer") && files.sidebar.includes("nav.repoAnalysis")],
  ["开发者上下文 Provider", files.app.includes("DeveloperProvider") && files.developerContext.includes("useDeveloper")],
  ["开发者上下文归一化 GitHub login", files.developerContext.includes("normalizeGitHubLogin") && files.developerContext.includes("replace(/^@+/")],
  ["开发者选择可跨页面共享", files.developers.includes("setCurrentLogin") && files.explorer.includes("currentLogin") && files.analysis.includes("currentLogin") && files.catalog.includes("currentLogin")],
  ["核心页面不写死 demo-user", ![files.explorer, files.analysis, files.catalog].some((content) => content.includes('"demo-user"') || content.includes("'demo-user'"))],
  ["星标仓库标题显示当前开发者", files.explorer.includes("@{currentLogin}") && !files.explorer.includes("developerProfile.login")],
  ["分类目录跟随当前开发者，概览使用全库汇总", files.catalog.includes("currentLogin") && files.dashboard.includes("getGlobalOverview")],
  ["概览和分类目录不写死 demo-user", ![files.dashboard, files.catalog].some((content) => content.includes('"demo-user"') || content.includes("'demo-user'"))],
  ["默认测试开发者为 patdelphi", files.developerContext.includes('DEFAULT_LOGIN = "patdelphi"') && files.api.includes("login: 'patdelphi'")],
  ["顶部无旧二级导航", !getByPath(locales.zh, "nav.starExplorer").includes("探索者")],
  ["单个仓库路由", files.app.includes('path="/analysis"')],
  ["星标仓库导航命名", getByPath(locales.zh, "nav.starExplorer") === "星标仓库"],
  ["仓库分析导航命名", getByPath(locales.zh, "nav.repoAnalysis") === "仓库分析"],
  ["星标仓库接入真实 API", ["getRepos", "getStats", "getTags", "exportData", "classifyRepos"].every((name) => files.explorer.includes(name))],
  ["星标仓库 API 不可用时不展示样例仓库", files.explorer.includes("usingFallback") && files.explorer.includes("setAllRepos([])")],
  ["星标仓库筛选排序状态", ["selectedLanguage", "selectedTags", "selectedLicense", "sortKey", "quickFilter"].every((name) => files.explorer.includes(name))],
  ["星标仓库导出弹窗", files.explorer.includes("exportOpen") && files.explorer.includes("exportPreview")],
  ["星标仓库列表可跳仓库分析", files.explorer.includes("selected-star-repo") && files.explorer.includes("/analysis?repo=")],
  ["顶部 8 个信息块", [
    "starCount",
    "lastSync",
    "tagCoverage",
    "hiddenGems",
    "sleepingStars",
    "activeRepos",
    "removedStars",
    "licenseRisk",
  ].every((key) => files.explorer.includes(`starExplorer.${key}`))],
  ["星标仓库页不含单仓库深度分析模块", !["仓库价值分析", "选中仓库速览", "协议与维护", "系统雷达"].some((text) => files.explorer.includes(text))],
  ["开发者详情可跳转星标仓库", files.developers.includes('to="/explorer"') && getByPath(locales.zh, "developers.viewStarRepos") && getByPath(locales.en, "developers.viewStarRepos")],
  ["开发者说明全部走 i18n", !["技术人格按该用户", "暂无语言统计", "暂无标签统计", "原圆环图"].some((text) => files.developers.includes(text))],
  ["星标仓库分数说明清晰", getByPath(locales.zh, "starExplorer.score") === "活跃度" && getByPath(locales.zh, "starExplorer.scoreHelp") && files.explorer.includes("scoreHelp")],
  ["图表统一 Tooltip 组件", files.chartTooltip.includes("ThemedChartTooltip") && files.dashboard.includes("ThemedChartTooltip") && !files.dashboard.includes("<Tooltip />")],
  ["图表 Tooltip 暗色主题可读", files.chartTooltip.includes("bg-popover") && files.chartTooltip.includes("text-popover-foreground")],
  ["仓库分析 AI fallback 使用 i18n", [
    "readmeSummary",
    "summaryEmpty",
    "summaryLoading",
    "learningValues",
    "reuseAdvice",
    "noTags",
    "radarActivity",
    "licenseUnknownDetail",
  ].every((key) => files.analysis.includes(`repoAnalysis.${key}`))],
  ["仓库分析不保留中文分析硬编码", ![
    "该项目提供了将各类文档",
    "文档解析",
    "Python 工具链",
    "可作为文档转换",
    "低风险",
    "JupyterLab 交互式计算环境",
  ].some((text) => files.analysis.includes(text))],
  ["单个仓库接入真实 API", ["getRepos", "getStats", "getTags"].every((name) => files.analysis.includes(name))],
  ["仓库分析不再使用内置 Demo 分析数据", !files.analysis.includes("repoAnalyses") && !files.analysis.includes("只有 Demo 数据")],
  ["分类目录不保留内置 Demo 数据", !files.catalog.includes("DEMO_TAGS") && !files.catalog.includes("DEMO_REPOS")],
  ["分类目录仓库详情链接使用 full_name 兜底", files.catalog.includes("repoDetailPath") && files.catalog.includes("encodeURIComponent")],
  ["单个仓库保留本地选择", files.analysis.includes("selected-star-repo")],
  ["开发者页接入同步 API", files.developers.includes("getUsers") && files.developers.includes("syncStars")],
  ["开发者删除走确认和后端逻辑删除", files.developers.includes("window.confirm") && files.developers.includes("deleteUser") && files.api.includes("export async function deleteUser")],
  ["开发者同步状态", files.developers.includes("syncStatus") && getByPath(locales.zh, "developers.syncStates.rateLimit") === "GitHub API 限流"],
  ["本地同步只发送一次请求", !files.api.includes("for (let batch = 0; batch < 1000; batch++)") && !files.api.includes("syncId = result.syncId")],
  ["同步完成不等待 AI 后处理", !files.developers.includes("await loadStarDna(syncedName, true)") && !files.developers.includes("await loadLearningPath(syncedName, true)")],
  ["同步接口返回后状态直接退出 syncing", files.developers.includes("后端返回后必须立即退出 syncing") && files.developers.includes("if (isMountedRef.current) {\n          if (syncComplete)")],
  ["同步状态可从真实 synced_at 兜底恢复", files.developers.includes("activeUser?.synced_at") && files.developers.includes('setSyncStatus("successToken")')],
  ["同步流程使用规范化 login 归属状态", files.developers.includes("const requestedLogin = normalizeGitHubLogin(name)") && files.developers.includes("const syncedName = normalizeGitHubLogin(result.username || requestedLogin)")],
  ["GitHub 同步长超时和错误透出", files.api.includes("resolveTimeout") && files.settings.includes("syncTimeout") && files.developers.includes("syncError") && getByPath(locales.zh, "developers.syncUnknownError")],
  ["本地设置会归一化超时避免请求立即中止", files.settings.includes("function normalizeSettings") && files.settings.includes("apiTimeout: clampNumber") && files.settings.includes("syncTimeout: clampNumber")],
  ["同步响应体读取有超时", files.api.includes("readJsonWithTimeout") && files.api.includes("readJsonWithTimeout<{") && files.api.includes('resolveTimeout(\'/api/sync\')')],
  ["设置页移除 Token 导出 AI 增强配置卡", !["settings.githubToken", "settings.export", "settings.aiEnhance"].some((key) => files.settingsPage.includes(key))],
  ["设置页移除数据库卡", !files.settingsPage.includes("settings.database") && !files.settingsPage.includes("dbModeSynced")],
  ["设置页显示服务有效性", files.settingsPage.includes("getServiceStatus") && files.settingsPage.includes("serviceStatus.githubToken") && files.settingsPage.includes("serviceStatus.aiApi")],
  ["AI 行为使用拨动开关", files.settingsPage.includes('role="switch"') && files.settingsPage.includes("aria-checked")],
  ["全局渲染异常兜底", files.app.includes("ErrorBoundary") && getByPath(locales.zh, "app.errorTitle") && getByPath(locales.en, "app.errorTitle")],
  ["API 客户端集中兜底数组响应", files.api.includes("function safeArray") && files.api.includes("normalizeRepoList") && files.api.includes("normalizeUserStats") && files.api.includes("normalizeGlobalOverview")],
  ["API 请求不重复执行全局可用性预探测", !files.api.includes("checkApiAvailable") && !files.api.includes("apiAvailable")],
  ["API 仓库列表不会返回空结构", !files.api.includes("return data.data as RepoListResult") && files.api.includes("return normalizeRepoList(data.data)")],
  ["API 统计数据不会返回半结构", !files.api.includes("return data.data as UserStats") && files.api.includes("return normalizeUserStats(data.data)")],
  ["开发者搜索结果不复用同步成功提示", !files.developers.includes('setSearchResult(t("developers.starUpdated"')],
  ["开发者星标趋势空值兜底", files.developers.includes("setStarTimeline(Array.isArray(timeline) ? timeline : [])") && !files.developers.includes("then(setStarTimeline)")],
  ["开发者 AI 长任务成功后不依赖共享 login 写回", files.developers.includes("if (!isMountedRef.current) return") && files.developers.includes("setStarDna(result.dna)") && files.developers.includes("setLearningPath(result.path)")],
  ["StrictMode 重新挂载会恢复 mounted ref", files.developers.includes("isMountedRef.current = true") && files.developers.includes("isMountedRef.current = false")],
  ["长任务状态归属使用可见开发者兜底", files.developers.includes("activeDevNameRef") && files.developers.includes("activeDevNameRef.current === normalizedLogin")],
  ["开发者列表刷新保持指定用户选中", files.developers.includes("preferredLogin?: string") && files.developers.includes("normalizeGitHubLogin(preferredLogin || currentLoginRef.current)")],
  ["开发者列表刷新后立即补齐详情和同步历史", files.developers.includes("loadDeveloperDetails(activeLogin)") && files.developers.includes("loadSyncRuns(activeLogin)")],
  ["开发者首次 AI 生成也显示 loading", files.developers.includes("setDnaLoading(true)") && files.developers.includes("setPathLoading(true)") && files.developers.includes("isInitialLoad")],
  ["同步中的当前开发者仍会加载统计和同步历史", !files.developers.includes("if (syncingLoginRef.current !== activeDevName)") && files.developers.includes("const isSyncingActiveDeveloper = syncingLoginRef.current === activeDevName")],
  ["开发者详情和同步历史按最后请求 login 防旧响应", files.developers.includes("detailLoginRef") && files.developers.includes("syncRunsLoginRef") && files.developers.includes("detailLoginRef.current === login") && !files.developers.includes("isCurrentDeveloperRequest(name, requestSeq) && requestSeq === detailRequestSeq.current")],
  ["同步历史不因并发请求竞态丢失", files.developers.includes("syncRunsRequestSeq") && files.developers.includes("syncRunsLoginRef.current = name")],
  ["重新生成失败保留已有 AI 内容", !files.developers.includes("if (force && showLoading) {\\n      setStarDna(null)" ) && !files.developers.includes("if (force && showLoading) {\\n      setLearningPath(null)" )],
  ["同步历史区域始终可见", files.developers.includes("{activeDev && (") && files.developers.includes("syncRuns.length > 0 ?")],
  ["分享卡片组件已接入开发者页", files.developers.includes("ShareCard") && files.shareCard.includes("ShareCard")],
  ["分享卡片预览按视口高度完整缩放", files.shareCard.includes("max-h-[calc(96vh-11rem)]") && files.shareCard.includes("overflow-hidden")],
  ["分享按钮位于开发者顶部操作区", files.developers.indexOf('t("developers.shareCard")') < files.developers.indexOf("Star DNA 画像卡片")],
  ["分享卡片包含 SVG 构建和 PNG 下载", files.shareCardBuilder.includes("buildShareCardSvg") && files.shareCardBuilder.includes("downloadShareCard")],
  ["分享卡片包含网址二维码", files.shareCardBuilder.includes("buildQrMatrix") && files.shareCardBuilder.includes("renderQrSvg") && files.developers.includes("shareUrl: activeDev.profile_url")],
  ["分享卡片长文本使用多行 SVG tspan", files.shareCardBuilder.includes("wrapSvgText") && files.shareCardBuilder.includes("<tspan")],
  ["分享卡片不展示长学习路径正文", !files.shareCardBuilder.includes("summarizeLearningPath") && !files.shareCardBuilder.includes("interestSummary") && !files.shareCardBuilder.includes('fill="url(#accent)"')],
  ["分享卡片 QR 纠错码按多项式求余生成", files.shareCardBuilder.includes("const remainder = [...data, ...new Array(QR_EC_CODEWORDS).fill(0)]") && files.shareCardBuilder.includes("return remainder.slice(-QR_EC_CODEWORDS)")],
  ["分享卡片 QR 格式位包含右上第八格", files.shareCardBuilder.includes("[QR_SIZE - 8, 8]") && !files.shareCardBuilder.includes("[8, QR_SIZE - 8], [8, QR_SIZE - 7]")],
  ["分享卡片展示 Star Way 项目信息", files.shareCardBuilder.includes("projectName") && files.shareCardBuilder.includes("ctaSubtitle") && files.developers.includes("shareCardProjectDescription")],
  ["分享卡片展示线上系统网址", files.shareCardBuilder.includes("https://starway.patdelphi.xyz") && files.shareCardBuilder.includes("systemUrl") && files.developers.includes("systemUrl: STARWAY_PUBLIC_URL")],
  ["分享卡片显示完整 https 网址", files.shareCardBuilder.includes("const systemUrlText = truncate(systemUrl, 44)") && files.shareCardBuilder.includes("const profileText = truncate(shareUrl, 40)")],
  ["分享卡片二维码指向线上系统", files.shareCardBuilder.includes("renderQrSvg(systemUrl") && !files.shareCardBuilder.includes("renderQrSvg(shareUrl")],
  ["分享卡片只展示摘要并引导查看完整内容", files.shareCardBuilder.includes("ctaSubtitle") && files.shareCardBuilder.includes("fullReportHint")],
  ["分享卡片长标题最多两行防溢出", files.shareCardBuilder.includes("const titleLines = wrapTextLines") && files.shareCardBuilder.includes("wrapSvgText(titleLines") && !files.shareCardBuilder.includes("${title}${escapeXml(data.labels.userTitleSuffix)}")],
  ["分享卡片 CTA 文案不被短行硬截断", files.shareCardBuilder.includes("const ctaLines = wrapTextLines(data.labels.ctaSubtitle, 42, 3)")],
  ["分享卡片用户区和项目 CTA 不混杂", files.shareCardBuilder.includes("userTitleSuffix") && !files.shareCardBuilder.includes("systemUrlLabel") && !files.shareCardBuilder.includes("githubProfileLabel)} ·")],
  ["分享卡片使用独立 CTA 二维码区域", files.shareCardBuilder.includes("share-card-cta") && files.shareCardBuilder.includes("renderQrSvg(systemUrl, 730, 744, 166)")],
  ["分享卡片二维码说明不覆盖二维码", files.shareCardBuilder.includes('y="942" text-anchor="middle" font-size="16"') && files.shareCardBuilder.includes('y="958" text-anchor="middle" font-size="13"')],
  ["分享卡片二维码不侵入统计区域", !files.shareCardBuilder.includes("renderQrSvg(systemUrl, 744, 780, 132)") && files.shareCardBuilder.includes("二维码固定在独立 CTA 区")],
  ["分享卡片三项指标横向同排", files.shareCardBuilder.includes("displayValue(data.repoCount), 150, metricY") && files.shareCardBuilder.includes("displayValue(data.hiddenGemsCount), 382, metricY") && files.shareCardBuilder.includes("displayValue(data.sleepStarsCount), 614, metricY")],
  ["分享卡片兴趣标签跟随当前语言", files.developers.includes('import { getTagLabel }') && files.developers.includes("getTagLabel(item.tag, i18n.language)")],
  ["分享卡片增加画像短标签和来源说明", files.shareCardBuilder.includes("profileBadge") && files.shareCardBuilder.includes("basedOnStars") && files.developers.includes("shareCardBasedOnStars")],
  ["分享卡片装饰路径禁止默认黑色填充", files.shareCardBuilder.includes('fill="none" stroke="#9D9AFF"') && !files.shareCardBuilder.includes('M54 270C220 80 470 54 715 110C900 152 1010 270 1044 446" stroke=')],
  ["分享卡片提供双语下载文案", getByPath(locales.zh, "developers.downloadShareCard") && getByPath(locales.en, "developers.downloadShareCard")],
  ["纯英文演示标签已清理", forbiddenTexts.every((text) => !allPageText.includes(text) && !zhText.includes(text))],
]

const failed = checks.filter(([, passed]) => !passed)

if (failed.length > 0) {
  console.error("UI 校验失败：")
  for (const [name] of failed) {
    console.error(`- ${name}`)
  }
  process.exit(1)
}

console.log(`UI 校验通过：${checks.length} 项`)
