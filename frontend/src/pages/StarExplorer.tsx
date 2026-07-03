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
  Download,
  FileText,
  Filter,
  Flame,
  GitFork,
  LineChart,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  Tags,
  X,
} from "lucide-react"
import { getRepos, getStats, getTags, getUserSummary, exportData, classifyRepos, addRepoTag, removeRepoTag, getRemovedStars, downloadReport, getCnSummaries } from "@/lib/api"
import { getTagLabel } from "@/lib/tag-labels"
import type { UserStats, RepoListResult } from "@/lib/api"
import { useDeveloper } from "@/contexts/DeveloperContext"
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
  manualTags: string[]
  allTags: string[]
  category: string
  score: number
  health: RepoHealth
  whyStarred: string
  learningValue: string[]
  reuseAdvice: string
}

const developerProfile = {
  totalStars: 0,
  syncedAt: "-",
  demoMode: "",
}

const activeFilters: Filter[] = []

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
function adaptApiRepo(apiRepo: RepoListResult["items"][number], fallback: { unknown: string; uncategorized: string }): StarRepo {
  const stars = apiRepo.stars
  const starsStr = stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : String(stars)
  const forks = apiRepo.forks
  const forksStr = forks >= 1000 ? `${(forks / 1000).toFixed(1)}k` : String(forks)

  // 根据最后推送时间判断健康度
  let health: RepoHealth = "active"
  let score = 0
  if (apiRepo.pushed_at) {
    const lastPush = new Date(apiRepo.pushed_at)
    const now = new Date()
    const daysDiff = (now.getTime() - lastPush.getTime()) / (1000 * 60 * 60 * 24)
    // 活跃度只表示维护新鲜度，不代表质量；近期更新越高，长期未更新越低。
    score = daysDiff <= 30 ? 100 : daysDiff <= 90 ? 85 : daysDiff <= 180 ? 65 : daysDiff <= 365 ? 45 : 20
    if (daysDiff > 365) {
      health = "stale"
    } else if (daysDiff > 180) {
      health = "watch"
    }
  }

  const autoTags = apiRepo.tags || []
  let topics: string[] = []
  try {
    topics = apiRepo.topics_json ? JSON.parse(apiRepo.topics_json) : []
  } catch { /* ignore */ }
  const allTags = [...new Set([...autoTags, ...topics.map(t => t.toLowerCase())])]

  return {
    fullName: apiRepo.full_name,
    description: apiRepo.description || "",
    stars: starsStr,
    forks: forksStr,
    language: apiRepo.language || fallback.unknown,
    langColor: getLangColor(apiRepo.language),
    license: apiRepo.license || fallback.unknown,
    starredAt: apiRepo.starred_at ? apiRepo.starred_at.slice(0, 10) : "",
    updatedAt: apiRepo.pushed_at ? apiRepo.pushed_at.slice(0, 10) : "",
    topics: topics.map(t => t.toLowerCase()),
    autoTags,
    manualTags: [],
    allTags,
    category: autoTags[0] || fallback.uncategorized,
    score,
    health,
    whyStarred: "",
    learningValue: [],
    reuseAdvice: "",
  }
}

export default function StarExplorer() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { currentLogin } = useDeveloper()

  // === 移到组件内部的 i18n 静态数据 ===
  const exportFormats = useMemo(
    () => [
      { label: "CSV", detail: t("starExplorer.exportFormatCsv"), status: t("starExplorer.exportFormatCurrent") },
      { label: "JSON", detail: t("starExplorer.exportFormatJson"), status: t("starExplorer.exportFormatCurrent") },
      { label: "Markdown", detail: t("starExplorer.exportFormatMd"), status: t("starExplorer.exportFormatCurrent") },
      { label: "HTML", detail: t("starExplorer.exportFormatHtml"), status: t("starExplorer.exportFormatLater") },
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
  const [pageSize, setPageSize] = useState(20)
  const [selectedLanguage, setSelectedLanguage] = useState("")
  const [selectedTopic, setSelectedTopic] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedLicense, setSelectedLicense] = useState("")
  const [sortKey, setSortKey] = useState("starred_at")
  const [quickFilter, setQuickFilter] = useState<"none" | "hiddenGems" | "sleepStars">("none")
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState("Markdown")
  const [analysisStatus, setAnalysisStatus] = useState("")

  // === 标签编辑状态 ===
  const [tagEditOpen, setTagEditOpen] = useState(false)
  const [tagEditRepo, setTagEditRepo] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState("")

  // === Removed Stars 弹窗状态 ===
  const [removedOpen, setRemovedOpen] = useState(false)
  const [removedRepos, setRemovedRepos] = useState<StarRepo[]>([])

  // === License 风险弹窗状态 ===
  const [licenseRiskOpen, setLicenseRiskOpen] = useState(false)

  // === API 相关状态 ===
  const [allRepos, setAllRepos] = useState<StarRepo[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [summary, setSummary] = useState<{
    repoCount: number
    activeRepoCount: number
    tagCount: number
    hiddenGemsCount: number
    sleepStarsCount: number
    licenseRiskCount: number
    lastSyncedAt: string | null
  } | null>(null)
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usingFallback, setUsingFallback] = useState(false)
  const [cnSummaries, setCnSummaries] = useState<Record<string, string>>({})

  const classificationSources = useMemo(
    () => [
      { label: t("starExplorer.classificationSourceTopic"), count: allRepos.filter((repo) => repo.topics.length > 0).length, confidence: "0.95", detail: t("starExplorer.classificationSourceTopicDetail") },
      { label: t("starExplorer.classificationSourceName"), count: allRepos.filter((repo) => repo.autoTags.length > 0).length, confidence: "0.85", detail: t("starExplorer.classificationSourceNameDetail") },
      { label: t("starExplorer.classificationSourceDesc"), count: allRepos.filter((repo) => repo.description.trim().length > 0).length, confidence: "0.80", detail: t("starExplorer.classificationSourceDescDetail") },
      { label: t("starExplorer.classificationSourceManual"), count: allRepos.filter((repo) => repo.manualTags.length > 0).length, confidence: "1.00", detail: t("starExplorer.classificationSourceManualDetail") },
    ],
    [t, tags, allRepos]
  )

  // === 首次加载：拉取真实数据 ===
  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const [repoResult, statsResult, tagsResult, summaryResult] = await Promise.all([
          getRepos(currentLogin, { pageSize: 10000 }),
          getStats(currentLogin),
          getTags(currentLogin),
          getUserSummary(currentLogin),
        ])
        if (cancelled) return

        // API 返回空列表视为不可用，回退到 Demo 数据
        if (repoResult.items.length === 0) {
          setAllRepos([])
          setUsingFallback(true)
          setAnalysisStatus(t("starExplorer.apiUnavailable"))
        } else {
          setAllRepos(repoResult.items.map((repo) => adaptApiRepo(repo, {
            unknown: t("starExplorer.unknown"),
            uncategorized: t("starExplorer.uncategorized"),
          })))
          setUsingFallback(false)
          setAnalysisStatus(t("starExplorer.loadedAnalysis", { login: currentLogin }))
        }

        if (statsResult) {
          setStats(statsResult)
        }
        if (summaryResult) {
          setSummary(summaryResult)
        }
        setTags(tagsResult)

        // 加载中文摘要（非阻塞，失败不影响主流程）
        try {
          const summaries = await getCnSummaries(currentLogin)
          if (!cancelled) setCnSummaries(summaries)
        } catch {
          // 忽略摘要加载失败
        }
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : t("starExplorer.loadingHint")
        setError(msg)
        setAllRepos([])
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
  }, [t, currentLogin])

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
      const matchesTopic = selectedTags.length === 0 || selectedTags.some(tag => repo.allTags.includes(tag))
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
  }, [searchQuery, selectedLanguage, selectedTags, selectedLicense, sortKey, allRepos, quickFilter])

  // === 筛选项命中数量（基于当前其他筛选条件）===
  const filterCounts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const baseFilter = (repo: StarRepo, exclude: 'language' | 'topic' | 'license') => {
      const matchesQuery =
        !query ||
        [repo.fullName, repo.description, repo.language, repo.category, ...repo.topics, ...repo.autoTags]
          .join(" ")
          .toLowerCase()
          .includes(query)
      const matchesLanguage = exclude === 'language' || !selectedLanguage || repo.language.toLowerCase() === selectedLanguage
      const matchesTopic = exclude === 'topic' || selectedTags.length === 0 || selectedTags.some(tag => repo.allTags.includes(tag))
      const matchesLicense = exclude === 'license' || !selectedLicense || repo.license.toLowerCase().includes(selectedLicense)
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
    }

    const langCounts: Record<string, number> = {}
    const topicCounts: Record<string, number> = {}
    const licenseCounts: Record<string, number> = {}

    for (const repo of allRepos) {
      if (baseFilter(repo, 'language')) {
        const lang = repo.language || 'Unknown'
        langCounts[lang] = (langCounts[lang] || 0) + 1
      }
      if (baseFilter(repo, 'topic')) {
        for (const t of repo.autoTags) {
          topicCounts[t] = (topicCounts[t] || 0) + 1
        }
      }
      if (baseFilter(repo, 'license')) {
        const lic = repo.license || 'Unknown'
        licenseCounts[lic] = (licenseCounts[lic] || 0) + 1
      }
    }

    return {
      languages: Object.entries(langCounts).sort((a, b) => b[1] - a[1]).slice(0, 20),
      topics: Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 20),
      licenses: Object.entries(licenseCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
    }
  }, [searchQuery, selectedLanguage, selectedTags, selectedLicense, allRepos, quickFilter])

  // === 分页 ===
  const totalPages = Math.max(1, Math.ceil(filteredRepos.length / pageSize))
  const paginatedRepos = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRepos.slice(start, start + pageSize)
  }, [currentPage, pageSize, filteredRepos])

  // === 从 stats 动态生成展示数据（无 stats 时用 fallback）===
  const languageStats = useMemo(() => {
    if (!stats?.languages?.length) return []
    return stats.languages.map((l) => ({
      label: l.language,
      count: l.count,
      color: getLangColor(l.language),
    }))
  }, [stats])

  const topicClusters = useMemo(() => {
    if (!stats?.topics?.length) return []
    return stats.topics.slice(0, 4).map((t) => ({
      label: t.topic,
      count: t.count,
      topics: [t.topic],
    }))
  }, [stats])

  const licenseStats = useMemo(() => {
    if (!stats?.licenses?.length) return []
    return stats.licenses.map((l) => {
      const lic = l.license || t("starExplorer.unknown")
      let color = "bg-status-safe"
      if (lic.toLowerCase().includes("gpl")) color = "bg-status-warning"
      else if (lic === t("starExplorer.unknown") || lic.toLowerCase() === "other") color = "bg-status-danger"
      return { label: lic, count: l.count, color }
    })
  }, [stats, t])

  const totalLanguageCount = useMemo(
    () => languageStats.reduce((sum, item) => sum + item.count, 0),
    [languageStats],
  )

  const totalLicenseCount = useMemo(
    () => licenseStats.reduce((sum, item) => sum + item.count, 0),
    [licenseStats],
  )

  // === 从真实数据计算指标 ===
  // 沉睡星标 = 总仓库 - 活跃仓库
  const sleepStarsCount = useMemo(() => {
    if (usingFallback) return 0
    const total = stats?.repoCount ?? allRepos.length
    const active = stats?.activeRepoCount ?? 0
    return total - active
  }, [stats, allRepos, usingFallback])

  // 隐藏宝石 = 低星（<=1000）但近期有更新的仓库
  const hiddenGemsCount = useMemo(() => {
    if (usingFallback) return 0
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
  const licenseRiskRepos = useMemo(() => {
    if (usingFallback) {
      return allRepos.filter((repo) => {
        const license = repo.license.toLowerCase()
        return license.includes("gpl") || license === "" || license === "other" || license === "unknown"
      })
    }
    return allRepos.filter((repo) => {
      const license = repo.license.toLowerCase()
      return license.includes("gpl") || license === "" || license === "other" || license === "unknown"
    })
  }, [allRepos, usingFallback])
  const licenseRiskCount = licenseRiskRepos.length

  // 标签覆盖率 = 有 allTags 的仓库数 / repoCount
  const tagCoveragePercent = useMemo(() => {
    if (usingFallback) return "0%"
    const total = stats?.repoCount ?? allRepos.length
    if (total === 0) return "0%"
    const coveredCount = allRepos.filter((r) => r.allTags.length > 0).length
    return `${Math.round((coveredCount / total) * 100)}%`
  }, [allRepos, stats, usingFallback])

  const starTimelineData = useMemo(() => {
    const counts = new Map<string, { count: number; languages: Map<string, number> }>()
    for (const repo of allRepos) {
      if (!repo.starredAt) continue
      const period = repo.starredAt.slice(0, 7)
      const item = counts.get(period) ?? { count: 0, languages: new Map<string, number>() }
      item.count += 1
      if (repo.language) item.languages.set(repo.language, (item.languages.get(repo.language) ?? 0) + 1)
      counts.set(period, item)
    }
    return [...counts.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6)
      .map(([period, item]) => {
        const focus = [...item.languages.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([language]) => language)
          .join(" / ")
        return { period, count: item.count, focus: focus || t("starExplorer.timelineNoFocus") }
      })
  }, [allRepos, t])

  const removedStarSignals = useMemo(
    () => [
      { label: t("starExplorer.removedSignalUnstar"), count: removedRepos.length, detail: t("starExplorer.removedSignalUnstarDetail") },
      { label: t("starExplorer.removedSignalStale"), count: sleepStarsCount, detail: t("starExplorer.removedSignalStaleDetail") },
      { label: t("starExplorer.removedSignalLicense"), count: licenseRiskCount, detail: t("starExplorer.removedSignalLicenseDetail") },
    ],
    [t, removedRepos, sleepStarsCount, licenseRiskCount]
  )

  // === 事件处理 ===
  const handleExport = (format: string) => {
    setExportFormat(format)
    setExportOpen(true)
    setAnalysisStatus(t("starExplorer.prepareExport", { format }))
  }

  const handleConfirmExport = async () => {
    const fmtRaw = exportFormat.toLowerCase()
    const supported = ["csv", "json", "markdown", "html"] as const
    if (!supported.includes(fmtRaw as (typeof supported)[number])) {
      setExportOpen(false)
      return
    }
    const fmt = fmtRaw as "csv" | "json" | "markdown" | "html"

    const params = {
      q: searchQuery || undefined,
      language: selectedLanguage || undefined,
      tag: selectedTags[0] || undefined,
      sort: sortKey || undefined,
      direction: "desc" as const,
    }

    try {
      const content = await exportData(fmt, currentLogin, params)
      if (content) {
        // 触发浏览器下载
        const ext = fmt === "markdown" ? "md" : fmt
        const blob = new Blob([content], { type: fmt === "html" ? "text/html;charset=utf-8" : "text/plain;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `star-repos-${currentLogin}.${ext}`
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
      const result = await classifyRepos(currentLogin)
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
    } else if (filterKey.startsWith("tag-")) {
      const tag = filterKey.slice(4)
      setSelectedTags(prev => prev.filter(t => t !== tag))
    }
    setAnalysisStatus(t("starExplorer.filterRemoved", { filter: filterKey }))
  }

  const openRemovedStars = async () => {
    const repos = await getRemovedStars(currentLogin)
    setRemovedRepos(repos.map(adaptApiRepo))
    setRemovedOpen(true)
  }

  const openRepoAnalysis = (fullName: string) => {
    localStorage.setItem("selected-star-repo", fullName)
    setAnalysisStatus(t("starExplorer.selectedRepo", { repo: fullName }))
    const [owner, name] = fullName.split("/")
    if (owner && name) {
      navigate(`/analysis?repo=${encodeURIComponent(fullName)}`)
    }
  }

  const openTagEditor = (fullName: string) => {
    setTagEditRepo(fullName)
    setTagInput("")
    setTagEditOpen(true)
  }

  const closeTagEditor = () => {
    setTagEditOpen(false)
    setTagEditRepo(null)
    setTagInput("")
  }

  const handleAddTag = async () => {
    if (!tagEditRepo || !tagInput.trim()) return
    const tag = tagInput.trim()
    const repo = allRepos.find((r) => r.fullName === tagEditRepo)
    if (!repo) return
    if (repo.manualTags.includes(tag) || repo.autoTags.includes(tag)) {
      setAnalysisStatus(t("starExplorer.tagExists", { tag }))
      return
    }
    try {
      const success = await addRepoTag(tagEditRepo, tag)
      if (success) {
        setAllRepos((prev) =>
          prev.map((r) =>
            r.fullName === tagEditRepo ? { ...r, manualTags: [...r.manualTags, tag] } : r
          )
        )
        setTagInput("")
        setAnalysisStatus(t("starExplorer.tagAdded", { tag }))
      } else {
        setAnalysisStatus(t("starExplorer.tagAddFailed", { tag }))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      setAnalysisStatus(t("starExplorer.tagAddError", { message: msg }))
    }
  }

  const handleRemoveTag = async (fullName: string, tag: string) => {
    const repo = allRepos.find((r) => r.fullName === fullName)
    if (!repo || !repo.manualTags.includes(tag)) return
    try {
      const success = await removeRepoTag(fullName, tag)
      if (success) {
        setAllRepos((prev) =>
          prev.map((r) =>
            r.fullName === fullName ? { ...r, manualTags: r.manualTags.filter((t) => t !== tag) } : r
          )
        )
        setAnalysisStatus(t("starExplorer.tagRemoved", { tag }))
      } else {
        setAnalysisStatus(t("starExplorer.tagRemoveFailed", { tag }))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      setAnalysisStatus(t("starExplorer.tagRemoveError", { message: msg }))
    }
  }

  const visibleFilters = [
    selectedLanguage && { key: "lang", label: selectedLanguage },
    ...selectedTags.map(tag => ({ key: `tag-${tag}`, label: tag })),
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
              <Badge className="font-mono text-xs">@{currentLogin}</Badge>
              <Badge variant="secondary" className="font-mono text-xs">
                {usingFallback ? t("starExplorer.noLiveData") : t("starExplorer.realDataCount", { count: stats?.repoCount ?? allRepos.length })}
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
            value={String(summary?.repoCount ?? stats?.repoCount ?? developerProfile.totalStars)}
            detail={usingFallback ? t("starExplorer.starCountDetail") : t("starExplorer.starCountDetailApi")}
          />
          <MetricCard
            icon={Activity}
            label={t("starExplorer.lastSync")}
            value={summary?.lastSyncedAt ? new Date(summary.lastSyncedAt).toLocaleDateString() : developerProfile.syncedAt}
            detail={t("starExplorer.lastSyncDetail")}
          />
          <MetricCard
            icon={Tags}
            label={t("starExplorer.tagCoverage")}
            value={summary ? `${summary.repoCount > 0 ? Math.round((summary.tagCount / summary.repoCount) * 100) : 0}%` : tagCoveragePercent}
            detail={t("starExplorer.tagCoverageDetailCount", { count: summary?.tagCount ?? tags.length, total: summary?.repoCount ?? stats?.repoCount ?? allRepos.length })}
          />
          <MetricCard
            icon={Flame}
            label={t("starExplorer.hiddenGems")}
            value={String(summary?.hiddenGemsCount ?? hiddenGemsCount)}
            detail={t("starExplorer.hiddenGemsDetail")}
          />
          <MetricCard
            icon={AlertTriangle}
            label={t("starExplorer.sleepingStars")}
            value={String(summary?.sleepStarsCount ?? sleepStarsCount)}
            detail={t("starExplorer.sleepingStarsDetail")}
          />
          <MetricCard
            icon={Activity}
            label={t("starExplorer.activeRepos")}
            value={String(summary?.activeRepoCount ?? stats?.activeRepoCount ?? 0)}
            detail={t("starExplorer.activeReposDetail")}
          />
          <MetricCard
            icon={LineChart}
            label={t("starExplorer.removedStars")}
            value={String(removedRepos.length)}
            detail={usingFallback ? t("starExplorer.removedStarsDetail") : t("starExplorer.removedStarsDetailApi")}
          />
          <div onClick={() => setLicenseRiskOpen(true)} className="cursor-pointer">
            <MetricCard
              icon={AlertTriangle}
              label={t("starExplorer.licenseRisk")}
              value={String(summary?.licenseRiskCount ?? licenseRiskCount)}
              detail={t("starExplorer.licenseRiskDetail")}
            />
          </div>
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
              {filterCounts.topics.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {filterCounts.topics.slice(0, 32).map(([tag, count]) => (
                    <button
                      key={tag}
                      className={`flex min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
                        selectedTags.includes(tag)
                          ? "border-primary bg-primary text-on-primary"
                          : "border-outline-variant/60 bg-surface-container-low hover:bg-surface-container"
                      }`}
                      onClick={() => {
                        setSelectedTags(prev =>
                          prev.includes(tag)
                            ? prev.filter(t => t !== tag)
                            : [...prev, tag]
                        )
                        setCurrentPage(1)
                      }}
                    >
                      <span className="truncate text-sm font-medium">{getTagLabel(tag, i18n.language)}</span>
                      <span className="shrink-0 font-mono text-xs opacity-80">{count}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {usingFallback ? t("tagCloud.noDataFallback") : t("tagCloud.noData")}
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* 协议分布 + 已取消星标 */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <Card className="xl:col-span-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <AlertTriangle className="h-5 w-5 text-primary" />
                {t("starExplorer.licenseDist")}
              </CardTitle>
              <CardDescription>{t("starExplorer.licenseDistDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {licenseStats.map((item) => (
                <div key={item.label} className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-outline-variant/60 bg-surface-container-low px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.color}`} />
                    <span className="truncate text-sm text-on-surface">{item.label}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-xs text-on-surface">{item.count}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {totalLicenseCount > 0 ? Math.round((item.count / totalLicenseCount) * 100) : 0}%
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-6">
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
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => downloadReport(currentLogin)}>
              <FileText className="h-4 w-4" />
              {t("starExplorer.generateReport")}
            </Button>
            <Button className="gap-2" onClick={() => handleExport("Markdown")}>
              <Download className="h-4 w-4" />
              {t("starExplorer.exportReport")}
            </Button>
          </div>
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
                <Select value={selectedLanguage} onChange={(event) => { setSelectedLanguage(event.target.value); setCurrentPage(1) }}>
                  <SelectOption value="">{t("starExplorer.language")}</SelectOption>
                  {filterCounts.languages.map(([lang, count]) => (
                    <SelectOption key={lang} value={lang.toLowerCase()}>
                      {lang} ({count})
                    </SelectOption>
                  ))}
                </Select>
                <Select value={selectedTopic} onChange={(event) => { setSelectedTopic(event.target.value); setCurrentPage(1) }}>
                  <SelectOption value="">{t("starExplorer.topic")}</SelectOption>
                  {filterCounts.topics.map(([topic, count]) => (
                    <SelectOption key={topic} value={topic.toLowerCase()}>
                      {getTagLabel(topic, i18n.language)} ({count})
                    </SelectOption>
                  ))}
                </Select>
                <Select value={selectedLicense} onChange={(event) => { setSelectedLicense(event.target.value); setCurrentPage(1) }}>
                  <SelectOption value="">{t("starExplorer.license")}</SelectOption>
                  {filterCounts.licenses.map(([lic, count]) => (
                    <SelectOption key={lic} value={lic.toLowerCase()}>
                      {lic} ({count})
                    </SelectOption>
                  ))}
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
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={openRemovedStars}
                >
                  <X className="h-3.5 w-3.5" />
                  {t("starExplorer.viewRemoved")}
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
                  setSelectedTags([])
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
                      <TableHead className="text-right" title={t("starExplorer.scoreHelp")}>{t("starExplorer.score")}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t("starExplorer.languageCol")}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t("starExplorer.licenseCol")}</TableHead>
                      <TableHead className="hidden xl:table-cell">{t("starExplorer.lastUpdate")}</TableHead>
                      <TableHead className="hidden xl:table-cell">{t("starExplorer.tags")}</TableHead>
                      <TableHead className="text-right">{t("starExplorer.action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRepos.map((repo) => (
                      <TableRow key={repo.fullName} className="transition-colors hover:bg-surface-container">
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Link to={`/analysis?repo=${encodeURIComponent(repo.fullName)}`} className="font-medium text-on-surface hover:text-primary hover:underline">
                                {repo.fullName}
                              </Link>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Star className="h-3 w-3" />{repo.stars}</span>
                              <span className="flex items-center gap-1"><GitFork className="h-3 w-3" />{repo.forks}</span>
                            </div>
                            {cnSummaries[repo.fullName] && (
                              <p className="text-xs text-primary mt-0.5 line-clamp-2">{cnSummaries[repo.fullName]}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-1">
                              {repo.allTags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="outline" className="font-mono text-[10px] uppercase tracking-wider">{tag}</Badge>
                              ))}
                              {repo.allTags.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{repo.allTags.length - 3}</span>
                              )}
                            </div>
                            <p className="line-clamp-1 text-sm text-muted-foreground">{repo.description}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-mono font-semibold ${healthMeta[repo.health].className}`} title={t("starExplorer.scoreHelp")}>{repo.score}</span>
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
                          <div className="flex flex-wrap gap-1 items-center">
                            {repo.manualTags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="default"
                                className="text-[10px] group relative cursor-pointer"
                                title={t("starExplorer.clickToRemoveTag")}
                              >
                                {tag}
                                <span
                                  className="ml-0.5 hidden group-hover:inline text-on-primary/80"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRemoveTag(repo.fullName, tag)
                                  }}
                                >
                                  <X className="h-2.5 w-2.5 inline" />
                                </span>
                              </Badge>
                            ))}
                            {repo.autoTags
                              .filter((t) => !repo.manualTags.includes(t))
                              .slice(0, 3)
                              .map((tag) => (
                                <Badge key={tag} variant="outline" className="text-[10px]">
                                  {tag}
                                </Badge>
                              ))}
                            {repo.autoTags.filter((t) => !repo.manualTags.includes(t)).length > 3 && (
                              <span className="text-[10px] text-muted-foreground">+{repo.autoTags.filter((t) => !repo.manualTags.includes(t)).length - 3}</span>
                            )}
                            <button
                              className="inline-flex h-5 w-5 items-center justify-center rounded border border-outline-variant/50 text-muted-foreground hover:bg-primary hover:text-on-primary transition-colors shrink-0"
                              title={t("starExplorer.addTag")}
                              onClick={() => openTagEditor(repo.fullName)}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
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

        {/* 分页 */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">{analysisStatus}</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{t("starExplorer.pageSize")}</span>
              {[20, 50, 100].map((size) => (
                <Button
                  key={size}
                  variant={pageSize === size ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => { setPageSize(size); setCurrentPage(1) }}
                >
                  {size}
                </Button>
              ))}
            </div>
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

        {/* 标签编辑弹窗 */}
        {tagEditOpen && tagEditRepo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                  {t("starExplorer.editTags")}
                </CardTitle>
                <CardDescription>{tagEditRepo}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-2 text-xs text-muted-foreground">{t("starExplorer.currentTags")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const repo = allRepos.find((r) => r.fullName === tagEditRepo)
                      if (!repo) return null
                      return (
                        <>
                          {repo.manualTags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="default"
                              className="text-[10px] group relative cursor-pointer"
                            >
                              {tag}
                              <span
                                className="ml-0.5 hidden group-hover:inline text-on-primary/80"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveTag(repo.fullName, tag)
                                }}
                              >
                                <X className="h-2.5 w-2.5 inline" />
                              </span>
                            </Badge>
                          ))}
                          {repo.autoTags
                            .filter((t) => !repo.manualTags.includes(t))
                            .map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[10px]">
                                {tag}
                              </Badge>
                            ))}
                          {repo.manualTags.length === 0 && repo.autoTags.length === 0 && (
                            <span className="text-xs text-muted-foreground">{t("starExplorer.noTags")}</span>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder={t("starExplorer.tagPlaceholder")}
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddTag()
                      }
                    }}
                    className="flex-1"
                  />
                  <Button onClick={handleAddTag} disabled={!tagInput.trim()}>
                    {t("starExplorer.addTag")}
                  </Button>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" onClick={closeTagEditor}>
                    {t("starExplorer.close")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Removed Stars 弹窗 */}
        {removedOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <X className="h-5 w-5 text-status-danger" />
                  {t("starExplorer.removedStarsTitle")}
                </CardTitle>
                <CardDescription>
                  {t("starExplorer.removedStarsDesc", { count: removedRepos.length })}
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto flex-1 space-y-2">
                {removedRepos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">{t("starExplorer.noRemovedStars")}</p>
                ) : (
                  removedRepos.map((repo) => (
                    <div key={repo.fullName} className="flex items-center justify-between rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2">
                      <div className="min-w-0">
                        <Link to={`/analysis?repo=${encodeURIComponent(repo.fullName)}`} className="text-sm font-medium text-primary hover:underline truncate block">
                          {repo.fullName}
                        </Link>
                        <p className="text-xs text-muted-foreground truncate">{repo.description}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <Badge variant="outline" className="text-[10px]">{repo.language || "?"}</Badge>
                        <span className="text-xs text-muted-foreground font-mono">{repo.stars}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
              <CardContent className="border-t border-outline-variant/50 pt-3">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setRemovedOpen(false)}>{t("starExplorer.close")}</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* License 风险弹窗 */}
        {licenseRiskOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-status-danger" />
                  {t("starExplorer.licenseRiskTitle")}
                </CardTitle>
                <CardDescription>
                  {t("starExplorer.licenseRiskDesc", { count: licenseRiskRepos.length })}
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto flex-1 space-y-2">
                <p className="text-sm text-muted-foreground">{t("starExplorer.licenseRiskExplain")}</p>
                {licenseRiskRepos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">{t("starExplorer.noLicenseRiskRepos")}</p>
                ) : (
                  licenseRiskRepos.map((repo) => (
                    <div key={repo.fullName} className="flex items-center justify-between rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2">
                      <div className="min-w-0">
                        <Link to={`/analysis?repo=${encodeURIComponent(repo.fullName)}`} className="text-sm font-medium text-primary hover:underline truncate block">
                          {repo.fullName}
                        </Link>
                        <p className="text-xs text-muted-foreground truncate">{repo.description}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <Badge variant="outline" className="text-[10px]">{repo.license || "?"}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
              <CardContent className="border-t border-outline-variant/50 pt-3">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setLicenseRiskOpen(false)}>{t("starExplorer.close")}</Button>
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
