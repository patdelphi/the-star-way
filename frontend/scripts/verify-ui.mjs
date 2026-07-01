/**
 * verify-ui.mjs
 * 前端静态功能校验脚本，检查页面能力入口和中英文 i18n 文案是否覆盖核心 Demo 功能。
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")

const readText = (path) => readFileSync(resolve(root, path), "utf8")
const readJson = (path) => JSON.parse(readText(path))

const files = {
  app: readText("src/App.tsx"),
  topbar: readText("src/components/layout/TopBar.tsx"),
  sidebar: readText("src/components/layout/Sidebar.tsx"),
  analysis: readText("src/pages/RepositoryAnalysis.tsx"),
  explorer: readText("src/pages/StarExplorer.tsx"),
  developers: readText("src/pages/Developers.tsx"),
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

const requiredLocaleKeys = [
  "topBar.searchPlaceholder",
  "topBar.searchResults",
  "topBar.noResults",
  "nav.developers",
  "nav.starExplorer",
  "nav.repoAnalysis",
  "developers.syncStatus",
  "developers.syncStates.rateLimit",
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
]

const requiredChineseTexts = [
  "搜索仓库",
  "星标仓库",
  "单个仓库",
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
]

const checks = [
  ["中英文 locale 可解析", Boolean(locales.zh.app && locales.en.app)],
  ["核心 locale key 完整", requiredLocaleKeys.every((key) => getByPath(locales.zh, key) && getByPath(locales.en, key))],
  ["中文文案覆盖核心功能", requiredChineseTexts.every((text) => zhText.includes(text))],
  ["顶部搜索使用 i18n", files.topbar.includes("topBar.searchPlaceholder") && files.topbar.includes("topBar.searchResults")],
  ["侧边栏导航使用 i18n", files.sidebar.includes("nav.starExplorer") && files.sidebar.includes("nav.repoAnalysis")],
  ["顶部无旧二级导航", !getByPath(locales.zh, "nav.starExplorer").includes("探索者") && !getByPath(locales.zh, "nav.repoAnalysis").includes("仓库分析")],
  ["单个仓库路由", files.app.includes('path="/analysis"')],
  ["星标仓库导航命名", getByPath(locales.zh, "nav.starExplorer") === "星标仓库"],
  ["单个仓库导航命名", getByPath(locales.zh, "nav.repoAnalysis") === "单个仓库"],
  ["星标仓库接入真实 API", ["getRepos", "getStats", "getTags", "exportData", "classifyRepos"].every((name) => files.explorer.includes(name))],
  ["星标仓库保留 Demo 兜底", files.explorer.includes("sampleRepos") && files.explorer.includes("usingFallback")],
  ["星标仓库筛选排序状态", ["selectedLanguage", "selectedTopic", "selectedLicense", "sortKey", "quickFilter"].every((name) => files.explorer.includes(name))],
  ["星标仓库导出弹窗", files.explorer.includes("exportOpen") && files.explorer.includes("exportPreview")],
  ["星标仓库列表可跳单仓库", files.explorer.includes("selected-star-repo") && files.explorer.includes("/analysis")],
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
  ["单个仓库接入真实 API", ["getRepos", "getStats", "getTags"].every((name) => files.analysis.includes(name))],
  ["单个仓库保留本地选择", files.analysis.includes("selected-star-repo")],
  ["开发者页接入同步 API", files.developers.includes("getUsers") && files.developers.includes("syncStars")],
  ["开发者同步状态", files.developers.includes("syncStatus") && getByPath(locales.zh, "developers.syncStates.rateLimit") === "GitHub API 限流"],
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
