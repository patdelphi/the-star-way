/**
 * StarExplorer.tsx
 * 星标仓库页面，接入真实 API 获取指定开发者的 Star 仓库列表、筛选排序和聚合分析。
 * API 不可用时自动回退到 Demo 数据。
 */
import { useEffect, useMemo, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Filter,
  Flame,
  GitFork,
  Layers3,
  LineChart,
  Radar,
  Search,
  Sparkles,
  Star,
  Tags,
  X,
} from "lucide-react"
import { getRepos, getStats, getTags, exportData, classifyRepos } from "@/lib/api"
import type { UserStats, RepoListResult } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectOption } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type RepoHealth = "active" | "watch" | "stale"

type StarRepo = {
  fullName: string
  description: string
  stars: string
  forks: string
  language: string
  langColor: string
  license: string
  starredAt: string
  updatedAt: string
  topics: string[]
  autoTags: string[]
  category: string
  score: number
  health: RepoHealth
  whyStarred: string
  learningValue: string[]
  reuseAdvice: string
}

const LOGIN = "demo-user"

const developerProfile = {
  login: "patdelphi",
  totalStars: 691,
  syncedAt: "2026-06-30 22:40",
  demoMode: "演示数据：691 条 GitHub 星标仓库",
}

// Demo 数据：API 不可用时作为兜底
const sampleRepos: StarRepo[] = [
  {
    fullName: "microsoft/markitdown",
    description: "用于把文件和办公文档转换为 Markdown 的 Python 工具。",
    stars: "40.2k",
    forks: "1.8k",
    language: "Python",
    langColor: "bg-domain-backend",
    license: "MIT",
    starredAt: "2026-06-18",
    updatedAt: "2026-06-28",
    topics: ["rag", "markdown", "document-ai"],
    autoTags: ["RAG 前置", "文档处理", "AI 工具"],
    category: "文档处理",
    score: 92,
    health: "active",
    whyStarred: "适合把 Office、PDF、网页内容转成 Markdown，作为知识库和 RAG 的入口。",
    learningValue: ["文档解析", "Markdown 生成", "自动化流水线"],
    reuseAdvice: "可作为本地文档处理工具链的前置转换模块。",
  },
  {
    fullName: "modelcontextprotocol/servers",
    description: "Model Context Protocol 的参考实现和社区服务器集合。",
    stars: "18.7k",
    forks: "2.3k",
    language: "TypeScript",
    langColor: "bg-domain-frontend",
    license: "MIT",
    starredAt: "2026-06-11",
    updatedAt: "2026-06-29",
    topics: ["mcp", "agent", "tool-use"],
    autoTags: ["MCP", "Agent", "工具调用"],
    category: "Agent 生态",
    score: 95,
    health: "active",
    whyStarred: "用于理解 MCP Server 的能力边界、工具暴露方式和本地 Agent 集成模式。",
    learningValue: ["MCP 协议", "工具调用", "Agent 基础设施"],
    reuseAdvice: "适合作为自定义 MCP 工具服务器的实现参考。",
  },
  {
    fullName: "astral-sh/uv",
    description: "用 Rust 编写的高速 Python 包管理和项目管理工具。",
    stars: "58.1k",
    forks: "1.6k",
    language: "Rust",
    langColor: "bg-domain-tools",
    license: "MIT / Apache-2.0",
    starredAt: "2026-05-21",
    updatedAt: "2026-06-30",
    topics: ["python", "cli", "packaging"],
    autoTags: ["工具链", "Python 基建", "CLI"],
    category: "开发工具",
    score: 90,
    health: "active",
    whyStarred: "能显著降低 Python 项目的依赖安装和环境管理成本。",
    learningValue: ["包管理", "Rust 工具链", "CI 加速"],
    reuseAdvice: "可替代部分 pip/venv/poetry 工作流，先在新项目中试点。",
  },
  {
    fullName: "langchain-ai/langgraph",
    description: "用图结构构建更可靠的语言智能体。",
    stars: "15.9k",
    forks: "2.7k",
    language: "Python",
    langColor: "bg-domain-ai",
    license: "MIT",
    starredAt: "2026-04-14",
    updatedAt: "2026-06-27",
    topics: ["llm", "agent", "workflow"],
    autoTags: ["LLM", "Agent", "编排"],
    category: "AI 应用框架",
    score: 87,
    health: "active",
    whyStarred: "适合学习多步骤 Agent、状态图和可恢复执行的产品化设计。",
    learningValue: ["状态图", "Agent 编排", "LLM 应用"],
    reuseAdvice: "适合复杂 Agent 流程，简单问答场景不必引入。",
  },
  {
    fullName: "neovim/neovim",
    description: "专注可扩展性和可用性的 Vim 分支编辑器。",
    stars: "82.1k",
    forks: "5.6k",
    language: "C",
    langColor: "bg-domain-tools",
    license: "Apache-2.0",
    starredAt: "2025-12-02",
    updatedAt: "2026-06-30",
    topics: ["editor", "cli", "developer-tools"],
    autoTags: ["编辑器", "CLI", "开发效率"],
    category: "开发工具",
    score: 78,
    health: "active",
    whyStarred: "代表高可扩展编辑器生态，适合研究插件系统和开发者工具体验。",
    learningValue: ["插件生态", "CLI UX", "编辑器架构"],
    reuseAdvice: "可借鉴其配置和插件生态设计，不建议直接嵌入业务系统。",
  },
  {
    fullName: "jina-ai/reader",
    description: "把任意网页链接转换为适合大模型读取的输入。",
    stars: "8.4k",
    forks: "620",
    language: "TypeScript",
    langColor: "bg-domain-frontend",
    license: "Apache-2.0",
    starredAt: "2026-03-09",
    updatedAt: "2026-05-14",
    topics: ["llm", "reader", "web"],
    autoTags: ["网页解析", "LLM 输入", "RAG"],
    category: "数据摄取",
    score: 81,
    health: "watch",
    whyStarred: "可把网页转换为更适合 LLM 的上下文输入，适合内容采集和总结。",
    learningValue: ["网页抽取", "LLM 上下文", "内容清洗"],
    reuseAdvice: "适合做网页转 Markdown 的补充能力，需关注调用稳定性。",
  },
  {
    fullName: "oldtools/archive-ui",
    description: "曾经流行但近期维护有限的后台管理模板。",
    stars: "6.2k",
    forks: "1.1k",
    language: "JavaScript",
    langColor: "bg-domain-frontend",
    license: "GPL-3.0",
    starredAt: "2024-01-22",
    updatedAt: "2024-08-03",
    topics: ["admin", "template", "dashboard"],
    autoTags: ["沉睡星标", "前端模板", "协议关注"],
    category: "前端模板",
    score: 41,
    health: "stale",
    whyStarred: "历史上可能用于后台界面参考，但维护和协议风险都需要重新评估。",
    learningValue: ["后台布局", "旧技术债识别"],
    reuseAdvice: "只作为视觉参考，不建议直接复用代码。",
  },
]

const activeFilters = [
  { key: "tag", label: "RAG 前置" },
]

// 静态 fallback 数据（API 无对应统计时展示）
const fallbackLanguageStats = [
  { label: "Python 生态", count: 254, color: "bg-domain-backend" },
  { label: "TypeScript 生态", count: 125, color: "bg-domain-frontend" },
  { label: "JavaScript 生态", count: 45, color: "bg-domain-frontend" },
  { label: "Rust 工具", count: 21, color: "bg-domain-tools" },
]

const fallbackTopicClusters = [
  { label: "智能应用 / 大模型", count: 143, topics: ["人工智能", "大模型", "OpenAI", "聊天机器人"] },
  { label: "智能体 / MCP", count: 61, topics: ["MCP", "智能体", "Claude Code"] },
  { label: "检索增强 / 文档", count: 40, topics: ["RAG", "PDF", "Markdown"] },
  { label: "命令行 / 工具链", count: 55, topics: ["命令行", "Python", "Windows"] },
]

const starTimeline = [
  { period: "2026 Q2", count: 173, focus: "MCP、Agent、文档 AI" },
  { period: "2026 Q1", count: 148, focus: "RAG、兼容 OpenAI 接口、命令行" },
  { period: "2025 Q4", count: 126, focus: "Python 工具链、Windows 自动化" },
  { period: "2025 Q3", count: 94, focus: "前端框架、仪表盘、编辑器" },
]

const fallbackLicenseStats = [
  { label: "MIT", count: 286, tone: "text-status-safe" },
  { label: "Apache-2.0", count: 142, tone: "text-status-safe" },
  { label: "GPL 系", count: 31, tone: "text-status-warning" },
  { label: "未知", count: 58, tone: "text-status-danger" },
]

const ITEMS_PER_PAGE = 5

/**
 * 根据语言返回对应的 UI 颜色类名
 */
function getLangColor(language: string | null): string {
  const map: Record<string, string> = {
    Python: "bg-domain-backend",
    TypeScript: "bg-domain-frontend",
    JavaScript: "bg-domain-frontend",
    Rust: "bg-domain-tools",
    "C++": "bg-domain-tools",
    "C#": "bg-domain-tools",
    Go: "bg-domain-backend",
    Java: "bg-domain-backend",
    "Jupyter Notebook": "bg-domain-ai",
    Vue: "bg-domain-frontend",
    HTML: "bg-domain-frontend",
    CSS: "bg-domain-frontend",
    Shell: "bg-domain-tools",
  }
  return map[language || ""] || "bg-domain-tools"
}

/**
 * 将 API 返回的仓库数据转换为页面内部 StarRepo 格式
 */
function adaptApiRepo(apiRepo: RepoListResult["items"][number]): StarRepo {
  const stars = apiRepo.stars
  const starsStr = stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : String(stars)
  const forks = apiRepo.forks
  const forksStr = forks >= 1000 ? `${(forks / 1000).toFixed(1)}k` : String(forks)

  // 基于 star 数计算简单评分（0-100）
  const score = Math.min(100, Math.max(30, Math.round(50 + Math.log10(Math.max(1, stars)) * 10)))

  // 根据最后推送时间判断健康度
  let health: RepoHealth = "active"
  if (apiRepo.pushed_at) {
    const lastPush = new Date(apiRepo.pushed_at)
    const now = new Date()
    const daysDiff = (now.getTime() - lastPush.getTime()) / (1000 * 60 * 60 * 24)
    if (daysDiff > 365) {
      health = "stale"
    } else if (daysDiff > 180) {
      health = "watch"
    }
  }

  const tags = apiRepo.tags || []
  const topics = tags.map((t) => t.toLowerCase())

  return {
    fullName: apiRepo.full_name,
    description: apiRepo.description || "",
    stars: starsStr,
    forks: forksStr,
    language: apiRepo.language || "未知",
    langColor: getLangColor(apiRepo.language),
    license: apiRepo.license || "未知",
    starredAt: apiRepo.starred_at ? apiRepo.starred_at.slice(0, 10) : "",
    updatedAt: apiRepo.pushed_at ? apiRepo.pushed_at.slice(0, 10) : "",
    topics,
    autoTags: tags,
    category: tags[0] || "未分类",
    score,
    health,
    whyStarred: "",
    learningValue: [],
    reuseAdvice: "",
  }
}

export default function StarExplorer() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  // === 移到组件内部的 i18n 静态数据 ===
  const classificationSources = useMemo(
    () => [
      { label: t("starExplorer.classificationSourceTopic"), count: 512, confidence: "0.95", detail: t("starExplorer.classificationSourceTopicDetail") },
      { label: t("starExplorer.classificationSourceName"), count: 96, confidence: "0.85", detail: t("starExplorer.classificationSourceNameDetail") },
      { label: t("starExplorer.classificationSourceDesc"), count: 71, confidence: "0.80", detail: t("starExplorer.classificationSourceDescDetail") },
      { label: t("starExplorer.classificationSourceManual"), count: 12, confidence: "1.00", detail: t("starExplorer.classificationSourceManualDetail") },
    ],
    [t]
  )

  const exportFormats = useMemo(
    () => [
      { label: "CSV", detail: t("starExplorer.exportFormatCsv"), status: t("starExplorer.exportFormatCurrent") },
      { label: "JSON", detail: t("starExplorer.exportFormatJson"), status: t("starExplorer.exportFormatCurrent") },
      { label: "Markdown", detail: t("starExplorer.exportFormatMd"), status: t("starExplorer.exportFormatCurrent") },
      { label: "HTML", detail: t("starExplorer.exportFormatHtml"), status: t("starExplorer.exportFormatLater") },
    ],
    [t]
  )

  const removedStarSignals = useMemo(
    () => [
      { label: t("starExplorer.removedSignalUnstar"), count: 18, detail: t("starExplorer.removedSignalUnstarDetail") },
      { label: t("starExplorer.removedSignalStale"), count: 34, detail: t("starExplorer.removedSignalStaleDetail") },
      { label: t("starExplorer.removedSignalLicense"), count: 31, detail: t("starExplorer.removedSignalLicenseDetail") },
    ],
    [t]
  )

  const healthMeta: Record<RepoHealth, { label: string; className: string }> = useMemo(
    () => ({
      active: { label: t("starExplorer.healthActive"), className: "text-status-safe" },
      watch: { label: t("starExplorer.healthWatch"), className: "text-status-warning" },
      stale: { label: t("starExplorer.healthStale"), className: "text-status-danger" },
    }),
    [t]
  )

  // === 原有筛选/分页/弹窗状态 ===
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedLanguage, setSelectedLanguage] = useState("")
  const [selectedTopic, setSelectedTopic] = useState("")
  const [selectedLicense, setSelectedLicense] = useState("")
  const [sortKey, setSortKey] = useState("starred_at")
  const [quickFilter, setQuickFilter] = useState<"none" | "hiddenGems" | "sleepStars">("none")
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState("Markdown")
  const [analysisStatus, setAnalysisStatus] = useState("")

  // === API 相关状态 ===
  const [allRepos, setAllRepos] = useState<StarRepo[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usingFallback, setUsingFallback] = useState(false)

  // === 首次加载：拉取真实数据 ===
  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const [repoResult, statsResult, tagsResult] = await Promise.all([
          getRepos(LOGIN, { pageSize: 10000 }),
          getStats(LOGIN),
          getTags(LOGIN),
        ])
        if (cancelled) return

        // API 返回空列表视为不可用，回退到 Demo 数据
        if (repoResult.items.length === 0) {
          setAllRepos(sampleRepos)
          setUsingFallback(true)
          setAnalysisStatus(t("starExplorer.apiUnavailable"))
        } else {
          setAllRepos(repoResult.items.map(adaptApiRepo))
          setUsingFallback(false)
          setAnalysisStatus(t("starExplorer.loadedAnalysis", { login: LOGIN }))
        }

        if (statsResult) {
          setStats(statsResult)
        }
        setTags(tagsResult)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : t("starExplorer.loadingHint")
        setError(msg)
        setAllRepos(sampleRepos)
        setUsingFallback(true)
        setAnalysisStatus(t("starExplorer.networkError"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [t])

  // === 筛选与排序（基于 allRepos）===
  const filteredRepos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const result = allRepos.filter((repo) => {
      const matchesQuery =
        !query ||
        [repo.fullName, repo.description, repo.language, repo.category, ...repo.topics, ...repo.autoTags]
          .join(" ")
          .toLowerCase()
          .includes(query)
      const matchesLanguage = !selectedLanguage || repo.language.toLowerCase() === selectedLanguage
      const matchesTopic = !selectedTopic || repo.topics.some((t) => t.toLowerCase().includes(selectedTopic.toLowerCase()))
      const matchesLicense = !selectedLicense || repo.license.toLowerCase().includes(selectedLicense)
      // 快捷筛选：隐藏宝石 / 沉睡星标
      let matchesQuick = true
      if (quickFilter === "hiddenGems") {
        const starNum = parseInt(repo.stars.replace(/[kK]/g, "000").replace(/[^0-9]/g, "")) || 0
        const pushed = repo.updatedAt ? new Date(repo.updatedAt) : null
        matchesQuick = starNum <= 1000 && pushed !== null && pushed >= ninetyDaysAgo
      } else if (quickFilter === "sleepStars") {
        const pushed = repo.updatedAt ? new Date(repo.updatedAt) : null
        matchesQuick = pushed !== null && pushed < ninetyDaysAgo
      }
      return matchesQuery && matchesLanguage && matchesTopic && matchesLicense && matchesQuick
    })

    const parseCount = (value: string) => {
      if (value.endsWith("k")) return Number(value.replace("k", "")) * 1000
      return Number(value)
    }

    return [...result].sort((a, b) => {
      if (sortKey === "stars") return parseCount(b.stars) - parseCount(a.stars)
      if (sortKey === "forks") return parseCount(b.forks) - parseCount(a.forks)
      if (sortKey === "updated_at") return b.updatedAt.localeCompare(a.updatedAt)
      return b.starredAt.localeCompare(a.starredAt)
    })
  }, [searchQuery, selectedLanguage, selectedTopic, selectedLicense, sortKey, allRepos, quickFilter])

  // === 分页 ===
  const totalPages = Math.max(1, Math.ceil(filteredRepos.length / ITEMS_PER_PAGE))
  const paginatedRepos = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredRepos.slice(start, start + ITEMS_PER_PAGE)
  }, [currentPage, filteredRepos])

  // === 从 stats 动态生成展示数据（无 stats 时用 fallback）===
  const languageStats = useMemo(() => {
    if (!stats?.languages?.length) return fallbackLanguageStats
    return stats.languages.map((l) => ({
      label: l.language,
      count: l.count,
      color: getLangColor(l.language),
    }))
  }, [stats])

  const topicClusters = useMemo(() => {
    if (!stats?.topics?.length) return fallbackTopicClusters
    return stats.topics.slice(0, 4).map((t) => ({
      label: t.topic,
      count: t.count,
      topics: [t.topic],
    }))
  }, [stats])

  const licenseStats = useMemo(() => {
    if (!stats?.licenses?.length) return fallbackLicenseStats
    return stats.licenses.map((l) => {
      const lic = l.license || "未知"
      let tone = "text-status-safe"
      if (lic.toLowerCase().includes("gpl")) tone = "text-status-warning"
      else if (lic === "未知" || lic.toLowerCase() === "other") tone = "text-status-danger"
      return { label: lic, count: l.count, tone }
    })
  }, [stats])

  // === 从真实数据计算指标 ===
  // 沉睡星标 = 总仓库 - 活跃仓库
  const sleepStarsCount = useMemo(() => {
    if (usingFallback) return 34
    const total = stats?.repoCount ?? allRepos.length
    const active = stats?.activeRepoCount ?? 0
    return total - active
  }, [stats, allRepos, usingFallback])

  // 隐藏宝石 = 低星（<=1000）但近期有更新的仓库
  const hiddenGemsCount = useMemo(() => {
    if (usingFallback) return 27
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    return allRepos.filter((r) => {
      const starNum = parseInt(r.stars.replace(/[kK]/g, "000").replace(/[^0-9]/g, "")) || 0
      if (starNum > 1000) return false
      const pushed = r.updatedAt ? new Date(r.updatedAt) : null
      return pushed && pushed >= ninetyDaysAgo
    }).length
  }, [allRepos, usingFallback])

  // 协议风险 = GPL / 未知协议
  const licenseRiskCount = useMemo(() => {
    if (usingFallback) return 31
    return licenseStats
      .filter((l) => l.tone !== "text-status-safe")
      .reduce((sum, l) => sum + l.count, 0)
  }, [licenseStats, usingFallback])

  // 自动标签覆盖率 = tags 数 / repoCount
  const tagCoveragePercent = useMemo(() => {
    if (usingFallback) return "83%"
    const total = stats?.repoCount ?? allRepos.length
    if (total === 0) return "0%"
    return `${Math.round((tags.length / total) * 100)}%`
  }, [tags, stats, allRepos, usingFallback])

  // === 事件处理 ===
  const handleExport = (format: string) => {
    setExportFormat(format)
    setExportOpen(true)
    setAnalysisStatus(t("starExplorer.prepareExport", { format }))
  }

  const handleConfirmExport = async () => {
    const fmtRaw = exportFormat.toLowerCase()
    const supported = ["csv", "json", "markdown"] as const
    if (!supported.includes(fmtRaw as (typeof supported)[number])) {
      setAnalysisStatus(t("starExplorer.htmlNotSupported"))
      setExportOpen(false)
      return
    }
    const fmt = fmtRaw as "csv" | "json" | "markdown"

    const params = {
      q: searchQuery || undefined,
      language: selectedLanguage || undefined,
      tag: selectedTopic || undefined,
      sort: sortKey || undefined,
      direction: "desc" as const,
    }

    try {
      const content = await exportData(fmt, LOGIN, params)
      if (content) {
        // 触发浏览器下载
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `star-repos-${LOGIN}.${fmt === "markdown" ? "md" : fmt}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setAnalysisStatus(t("starExplorer.exportSuccess", { format: exportFormat }))
      } else {
        setAnalysisStatus(t("starExplorer.exportFailedNoData"))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("starExplorer.exportError", { message: "" })
      setAnalysisStatus(t("starExplorer.exportError", { message: msg }))
    }
    setExportOpen(false)
  }

  const handleBatchAnalyze = async () => {
    setAnalysisStatus(t("starExplorer.triggeringClassify"))
    try {
      const result = await classifyRepos(LOGIN)
      if (result) {
        setAnalysisStatus(t("starExplorer.classifyComplete", { classified: result.classified, errors: result.errors }))
      } else {
        setAnalysisStatus(t("starExplorer.classifyUnavailable"))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      setAnalysisStatus(t("starExplorer.classifyError", { message: msg }))
    }
  }

  const handleRemoveFilter = (filterKey: string) => {
    if (filterKey === "quickFilter") {
      setQuickFilter("none")
    }
    setAnalysisStatus(t("starExplorer.filterRemoved", { filter: filterKey }))
  }

  const openRepoAnalysis = (fullName: string) => {
    localStorage.setItem("selected-star-repo", fullName)
    setAnalysisStatus(t("starExplorer.selectedRepo", { repo: fullName }))
    navigate("/analysis")
  }

  const visibleFilters = [
    selectedLanguage && { key: "lang", label: selectedLanguage },
    selectedTopic && { key: "topic", label: selectedTopic },
    selectedLicense && { key: "license", label: selectedLicense },
    quickFilter === "hiddenGems" && { key: "quickFilter", label: t("starExplorer.filterHiddenGems") },
    quickFilter === "sleepStars" && { key: "quickFilter", label: t("starExplorer.filterSleepStars") },
    ...activeFilters,
  ].filter(Boolean) as { key: string; label: string }[]

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-grid-pattern">
      <div className="space-y-6">
        {/* 头部信息 */}
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs uppercase tracking-wider">
                {t("starExplorer.designatedDev")}
              </Badge>
              <Badge className="font-mono text-xs">@{developerProfile.login}</Badge>
              <Badge variant="secondary" className="font-mono text-xs">
                {usingFallback ? developerProfile.demoMode : t("starExplorer.realDataCount", { count: stats?.repoCount ?? allRepos.length })}
              </Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-on-surface">{t("starExplorer.title")}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("starExplorer.desc")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={handleBatchAnalyze}>
              <Sparkles className="h-4 w-4" />
              {t("starExplorer.updateAnalysis")}
            </Button>
          </div>
        </section>

        {/* 指标卡片区 */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Star}
            label={t("starExplorer.starCount")}
            value={String(stats?.repoCount ?? developerProfile.totalStars)}
            detail={usingFallback ? t("starExplorer.starCountDetail") : t("starExplorer.starCountDetailApi")}
          />
          <MetricCard
            icon={Activity}
            label={t("starExplorer.lastSync")}
            value={developerProfile.syncedAt}
            detail={t("starExplorer.lastSyncDetail")}
          />
          <MetricCard
            icon={Tags}
            label={t("starExplorer.tagCoverage")}
            value={tagCoveragePercent}
            detail={t("starExplorer.tagCoverageDetailCount", { count: tags.length, total: stats?.repoCount ?? allRepos.length })}
          />
          <MetricCard
            icon={Flame}
            label={t("starExplorer.hiddenGems")}
            value={String(hiddenGemsCount)}
            detail={t("starExplorer.hiddenGemsDetail")}
          />
          <MetricCard
            icon={AlertTriangle}
            label={t("starExplorer.sleepingStars")}
            value={String(sleepStarsCount)}
            detail={t("starExplorer.sleepingStarsDetail")}
          />
          <MetricCard
            icon={Activity}
            label={t("starExplorer.activeRepos")}
            value={String(stats?.activeRepoCount ?? 512)}
            detail={t("starExplorer.activeReposDetail")}
          />
          <MetricCard
            icon={LineChart}
            label={t("starExplorer.removedStars")}
            value={usingFallback ? "18" : "0"}
            detail={usingFallback ? t("starExplorer.removedStarsDetail") : t("starExplorer.removedStarsDetailApi")}
          />
          <MetricCard
            icon={AlertTriangle}
            label={t("starExplorer.licenseRisk")}
            value={String(licenseRiskCount)}
            detail={t("starExplorer.licenseRiskDetail")}
          />
        </section>

        {/* 语言分布 + 主题聚类 */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <Card className="xl:col-span-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Radar className="h-5 w-5 text-primary" />
                {t("starExplorer.languageDist")}
              </CardTitle>
              <CardDescription>{t("starExplorer.languageDistDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {languageStats.map((item) => (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-on-surface">{item.label}</span>
                    <span className="font-mono text-muted-foreground">{item.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-container-high">
                    <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${Math.min(100, item.count / 3)}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="xl:col-span-7">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Layers3 className="h-5 w-5 text-primary" />
                {t("starExplorer.topicClusters")}
              </CardTitle>
              <CardDescription>{t("starExplorer.topicClustersDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {topicClusters.map((cluster) => (
                <div key={cluster.label} className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-on-surface">{cluster.label}</h3>
                    <Badge variant="secondary" className="font-mono text-xs">{cluster.count}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cluster.topics.map((topic) => (
                      <Badge key={topic} variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* 规则分类覆盖 + 兴趣时间线 */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <Card className="xl:col-span-7">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Tags className="h-5 w-5 text-primary" />
                {t("starExplorer.classificationCov")}
              </CardTitle>
              <CardDescription>{t("starExplorer.classificationCovDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {classificationSources.map((source) => (
                <div key={source.label} className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-on-surface">{source.label}</span>
                    <Badge variant="secondary" className="font-mono text-xs">{source.count}</Badge>
                  </div>
                  <div className="mb-2 text-xs text-muted-foreground">{t("starExplorer.classificationConfidence", { confidence: source.confidence })}</div>
                  <p className="text-xs leading-5 text-muted-foreground">{source.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="xl:col-span-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Clock className="h-5 w-5 text-primary" />
                {t("starExplorer.timeline")}
              </CardTitle>
              <CardDescription>{t("starExplorer.timelineDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {starTimeline.map((item) => (
                <div key={item.period} className="rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-on-surface">{item.period}</span>
                    <span className="font-mono text-sm text-muted-foreground">{item.count}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.focus}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* 标签云 */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Tags className="h-5 w-5 text-primary" />
                {t("tagCloud.title")}
                {!usingFallback && tags.length > 0 && (
                  <Badge variant="secondary" className="font-mono text-xs ml-2">{t("tagCloud.badge", { count: tags.length })}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {t("tagCloud.desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-2.5 items-center justify-center py-2">
                  {tags.map(({ tag, count }) => {
                    // 按 count 计算字号/颜色深浅（最小 0.8rem，最大 1.6rem）
                    const maxCount = tags[0].count
                    const ratio = count / maxCount
                    const fontSize = 0.75 + ratio * 0.85
                    const opacity = 0.5 + ratio * 0.5
                    return (
                      <span
                        key={tag}
                        className="inline-block rounded-full border border-outline-variant/50 bg-surface-container-low px-3 py-1 text-sm font-medium text-on-surface transition-colors hover:bg-primary hover:text-on-primary hover:border-primary cursor-default"
                        style={{
                          fontSize: `${fontSize}rem`,
                          opacity,
                        }}
                      >
                        {tag}
                        <span className="ml-1.5 text-[0.7em] font-mono text-muted-foreground">{count}</span>
                      </span>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {usingFallback ? t("tagCloud.noDataFallback") : t("tagCloud.noData")}
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* 协议分布 + 导出一致性 + 已取消星标 */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <Card className="xl:col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <AlertTriangle className="h-5 w-5 text-primary" />
                {t("starExplorer.licenseDist")}
              </CardTitle>
              <CardDescription>{t("starExplorer.licenseDistDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {licenseStats.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2">
                  <span className={`text-sm font-medium ${item.tone}`}>{item.label}</span>
                  <span className="font-mono text-sm text-on-surface">{item.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="xl:col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Download className="h-5 w-5 text-primary" />
                {t("starExplorer.exportConsistency")}
              </CardTitle>
              <CardDescription>{t("starExplorer.exportConsistencyDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {exportFormats.map((format) => (
                <div key={format.label} className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
                  <div className="text-sm font-semibold text-on-surface">{format.label}</div>
                  <div className="text-xs text-muted-foreground">{format.detail}</div>
                  <Badge variant="outline" className="mt-2 text-[10px]">{format.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="xl:col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <LineChart className="h-5 w-5 text-primary" />
                {t("starExplorer.removedStarSignals")}
              </CardTitle>
              <CardDescription>{t("starExplorer.removedStarSignalsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {removedStarSignals.map((signal) => (
                <div key={signal.label} className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-on-surface">{signal.label}</span>
                    <span className="font-mono text-sm text-muted-foreground">{signal.count}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{signal.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* 仓库列表头部 */}
        <section className="flex flex-col gap-3 border-t border-outline-variant/50 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-on-surface">{t("starExplorer.allRepos")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("starExplorer.allReposDesc")}</p>
          </div>
          <Button className="gap-2" onClick={() => handleExport("Markdown")}>
            <Download className="h-4 w-4" />
            {t("starExplorer.exportReport")}
          </Button>
        </section>

        {/* 筛选卡片 */}
        <Card className="glass-panel">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-3 xl:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("starExplorer.searchPlaceholder")}
                  className="pl-9"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value)
                    setCurrentPage(1)
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[620px]">
                <Select value={selectedLanguage} onChange={(event) => setSelectedLanguage(event.target.value)}>
                  <SelectOption value="">{t("starExplorer.language")}</SelectOption>
                  <SelectOption value="python">Python</SelectOption>
                  <SelectOption value="typescript">TypeScript</SelectOption>
                  <SelectOption value="rust">Rust</SelectOption>
                </Select>
                <Select value={selectedTopic} onChange={(event) => setSelectedTopic(event.target.value)}>
                  <SelectOption value="">{t("starExplorer.topic")}</SelectOption>
                  <SelectOption value="ai">AI</SelectOption>
                  <SelectOption value="mcp">MCP</SelectOption>
                  <SelectOption value="rag">RAG</SelectOption>
                </Select>
                <Select value={selectedLicense} onChange={(event) => setSelectedLicense(event.target.value)}>
                  <SelectOption value="">{t("starExplorer.license")}</SelectOption>
                  <SelectOption value="mit">MIT</SelectOption>
                  <SelectOption value="apache">Apache-2.0</SelectOption>
                  <SelectOption value="gpl">GPL-3.0</SelectOption>
                </Select>
                <Select value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
                  <SelectOption value="starred_at">{t("starExplorer.sortByStarredAt")}</SelectOption>
                  <SelectOption value="stars">{t("starExplorer.sortByStars")}</SelectOption>
                  <SelectOption value="forks">{t("starExplorer.sortByForks")}</SelectOption>
                  <SelectOption value="updated_at">{t("starExplorer.sortByUpdatedAt")}</SelectOption>
                </Select>
              </div>
              {/* 快捷筛选按钮 */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={quickFilter === "hiddenGems" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    setQuickFilter(quickFilter === "hiddenGems" ? "none" : "hiddenGems")
                    setCurrentPage(1)
                  }}
                >
                  <Flame className="h-3.5 w-3.5" />
                  {t("starExplorer.filterHiddenGems")}
                </Button>
                <Button
                  variant={quickFilter === "sleepStars" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    setQuickFilter(quickFilter === "sleepStars" ? "none" : "sleepStars")
                    setCurrentPage(1)
                  }}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {t("starExplorer.filterSleepStars")}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("starExplorer.filtered")}</span>
              {visibleFilters.map((filter) => (
                <Badge key={filter.key} variant="secondary" className="flex items-center gap-1 font-mono text-xs">
                  {filter.label}
                  <button onClick={() => handleRemoveFilter(filter.key)} className="ml-1 rounded-full hover:bg-surface-container-high">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-xs text-muted-foreground"
                onClick={() => {
                  setSelectedLanguage("")
                  setSelectedTopic("")
                  setSelectedLicense("")
                  setSearchQuery("")
                  setQuickFilter("none")
                  handleRemoveFilter("all")
                }}
              >
                <Filter className="h-3 w-3" />
                {t("starExplorer.clearAll")}
              </Button>
              <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs text-muted-foreground">
                <ArrowDownUp className="h-3 w-3" />
                {t("starExplorer.sort")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 加载状态 */}
        {loading && (
          <Card>
            <CardContent className="p-10 text-center">
              <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <h3 className="text-base font-semibold text-on-surface">{t("starExplorer.loadingTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("starExplorer.loadingHint")}</p>
            </CardContent>
          </Card>
        )}

        {/* 仓库列表表格 */}
        {!loading && (
          <Card>
            <CardContent className="p-0">
              {filteredRepos.length === 0 ? (
                <div className="p-10 text-center">
                  <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <h3 className="text-base font-semibold text-on-surface">{t("starExplorer.noResults")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t("starExplorer.noResultsHint")}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[280px]">{t("starExplorer.repo")}</TableHead>
                      <TableHead className="hidden md:table-cell">{t("starExplorer.category")}</TableHead>
                      <TableHead className="text-right">{t("starExplorer.score")}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t("starExplorer.languageCol")}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t("starExplorer.licenseCol")}</TableHead>
                      <TableHead className="hidden xl:table-cell">{t("starExplorer.lastUpdate")}</TableHead>
                      <TableHead className="hidden xl:table-cell">{t("starExplorer.autoTags")}</TableHead>
                      <TableHead className="text-right">{t("starExplorer.action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRepos.map((repo) => (
                      <TableRow key={repo.fullName} className="transition-colors hover:bg-surface-container">
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Link to={`/repo/${repo.fullName}`} className="font-medium text-on-surface hover:text-primary hover:underline">
                                {repo.fullName}
                              </Link>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Star className="h-3 w-3" />{repo.stars}</span>
                              <span className="flex items-center gap-1"><GitFork className="h-3 w-3" />{repo.forks}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="space-y-1">
                            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">{repo.category}</Badge>
                            <p className="line-clamp-1 text-sm text-muted-foreground">{repo.description}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-mono font-semibold ${healthMeta[repo.health].className}`}>{repo.score}</span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge className={`${repo.langColor} text-white text-xs`}>{repo.language}</Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground">{repo.license}</span>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <span className="font-mono text-xs text-muted-foreground">{repo.updatedAt}</span>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {repo.autoTags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="gap-2" onClick={() => openRepoAnalysis(repo.fullName)}>
                            <LineChart className="h-4 w-4" />
                            {t("starExplorer.viewRepo")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* 错误/状态提示 */}
        <Card className={`border-status-warning/40 bg-surface-container-low ${error ? "border-status-danger/40" : ""}`}>
          <CardContent className="flex flex-col gap-2 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              {error ? `${t("starExplorer.errorPrefix")}${error}` : usingFallback ? t("starExplorer.fallbackNotice") : t("starExplorer.syncedNotice")}
            </span>
            <Badge variant="outline" className="w-fit">{error ? t("starExplorer.demoErrorStatus") : usingFallback ? t("starExplorer.demoMode") : t("starExplorer.connected")}</Badge>
          </CardContent>
        </Card>

        {/* 分页 */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">{analysisStatus}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {t("starExplorer.pageInfo", { current: currentPage, total: totalPages })}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 导出弹窗 */}
        {exportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-lg">
              <CardHeader>
                <CardTitle>{t("starExplorer.exportPreview")}</CardTitle>
                <CardDescription>{t("starExplorer.exportConsistentHint", { format: exportFormat })}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-3 text-sm text-muted-foreground">
                  {t("starExplorer.exportReposCount", { count: filteredRepos.length, sort: sortKey })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {["CSV", "JSON", "Markdown", "HTML"].map((format) => (
                    <Button key={format} variant={format === exportFormat ? "default" : "outline"} onClick={() => setExportFormat(format)}>
                      {format}
                    </Button>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setExportOpen(false)}>{t("starExplorer.cancel")}</Button>
                  <Button onClick={handleConfirmExport}>{t("starExplorer.confirmExport")}</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Star; label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold tracking-tight text-on-surface">{value}</div>
          <div className="text-sm font-medium text-on-surface">{label}</div>
          <div className="text-xs text-muted-foreground">{detail}</div>
        </div>
      </CardContent>
    </Card>
  )
}
