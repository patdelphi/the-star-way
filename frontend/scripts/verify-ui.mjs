/**
 * verify-ui.mjs
 * 前端静态功能校验脚本，用于确认 Demo 页面包含项目文档要求的关键入口和单个仓库分析模块。
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")

const files = {
  app: readFileSync(resolve(root, "src/App.tsx"), "utf8"),
  topbar: readFileSync(resolve(root, "src/components/layout/TopBar.tsx"), "utf8"),
  sidebar: readFileSync(resolve(root, "src/components/layout/Sidebar.tsx"), "utf8"),
  analysis: readFileSync(resolve(root, "src/pages/RepositoryAnalysis.tsx"), "utf8"),
  explorer: readFileSync(resolve(root, "src/pages/StarExplorer.tsx"), "utf8"),
  developers: readFileSync(resolve(root, "src/pages/Developers.tsx"), "utf8"),
}

const checks = [
  ["顶部无二级导航", !files.topbar.includes("探索者") && !files.topbar.includes("单个仓库")],
  ["顶部搜索仓库占位", files.topbar.includes('placeholder="搜索仓库"')],
  ["顶部搜索结果下拉", files.topbar.includes("搜索结果") && files.topbar.includes("匹配仓库")],
  ["单个仓库路由", files.app.includes('path="/analysis"')],
  [
    "单个仓库导航",
    files.sidebar.includes("单个仓库") &&
      files.sidebar.includes("/analysis") &&
      !files.sidebar.includes("仓库分析"),
  ],
  ["星标仓库导航", files.sidebar.includes("星标仓库") && !files.sidebar.includes("星系探索")],
  ["指定开发者上下文", files.explorer.includes("指定开发者") && files.explorer.includes("@patdelphi")],
  ["开发者全局分析定位", files.explorer.includes("开发者星标全局分析") && files.explorer.includes("组合画像")],
  ["星标仓库概览", files.explorer.includes("星标仓库概览")],
  ["语言分布模块", files.explorer.includes("语言分布")],
  ["主题聚类模块", files.explorer.includes("主题聚类")],
  ["最近同步模块", files.explorer.includes("最近同步")],
  ["规则分类覆盖模块", files.explorer.includes("规则分类覆盖")],
  ["兴趣时间线模块", files.explorer.includes("兴趣时间线")],
  ["协议分布模块", files.explorer.includes("协议分布")],
  ["导出一致性模块", files.explorer.includes("导出一致性")],
  [
    "顶部 8 个信息块",
    [
      "星标仓库概览",
      "最近同步",
      "自动标签覆盖",
      "隐藏宝石",
      "沉睡星标",
      "活跃仓库",
      "已取消星标",
      "协议风险",
    ].every((label) => files.explorer.includes(label)),
  ],
  ["已取消星标模块", files.explorer.includes("已取消星标")],
  ["隐藏宝石模块", files.explorer.includes("隐藏宝石") && !files.explorer.includes("Hidden Gems")],
  ["沉睡星标模块", files.explorer.includes("沉睡星标") && !files.explorer.includes("Sleep Stars")],
  ["旧 Dead Stars 文案已移除", !files.explorer.includes("Dead Stars")],
  [
    "纯英文演示标签已清理",
    [
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
    ].every((text) => !files.explorer.includes(text) && !files.analysis.includes(text) && !files.developers.includes(text)),
  ],
  ["更新星标仓库分析入口", files.explorer.includes("更新星标仓库分析") && !files.explorer.includes("批量分析")],
  ["全部星标仓库列表标题", files.explorer.includes("全部星标仓库列表")],
  ["列表上方导出报告", files.explorer.includes("全部星标仓库列表") && files.explorer.includes("导出报告")],
  ["筛选排序真实状态", files.explorer.includes("selectedLanguage") && files.explorer.includes("sortKey")],
  ["导出预览弹窗", files.explorer.includes("导出预览") && files.explorer.includes("导出格式")],
  ["空状态和错误状态", files.explorer.includes("无搜索结果") && files.explorer.includes("GitHub API 限流")],
  ["排序控件", files.explorer.includes("排序") && files.explorer.includes("排序：标星时间")],
  [
    "星标仓库页不含单仓库分析面板",
    files.explorer.includes("查看单个仓库") &&
      !files.explorer.includes("仓库价值分析") &&
      !files.explorer.includes("选中仓库速览") &&
      !files.explorer.includes("协议与维护") &&
      !files.explorer.includes("系统雷达"),
  ],
  ["README 摘要模块", files.analysis.includes("README 摘要")],
  ["单个仓库页面标题", files.analysis.includes("单个仓库") && !files.analysis.includes("仓库分析")],
  ["单个仓库本地选择", files.analysis.includes("selected-star-repo")],
  ["活跃度分析模块", files.analysis.includes("活跃度分析")],
  ["协议风险模块", files.analysis.includes("协议风险")],
  ["技术栈解析模块", files.analysis.includes("技术栈解析")],
  ["维护信号模块", files.analysis.includes("维护信号")],
  ["相似项目模块", files.analysis.includes("相似项目")],
  ["AI 关闭提示", files.analysis.includes("本页仍为静态演示")],
  ["列表页只保留全局分析", files.explorer.includes("开发者星标全局分析")],
  ["开发者同步状态", files.developers.includes("syncStatus") && files.developers.includes("GitHub API 限流")],
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
