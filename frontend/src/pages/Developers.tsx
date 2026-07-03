/**
 * Developers.tsx
 * 开发者管理页面
 * 三列卡片网格展示开发者列表，支持搜索添加、删除、分页、选中高亮
 * 选中开发者在下方展开 Dashboard 详情面板，可同步该开发者星标
 * 改造：接入真实 API getUsers / syncStars，API 不可用时回退 Demo 数据
 */
import { useState, useMemo, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Plus,
  X,
  RotateCw,
  Star,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Brain,
  Diamond,
  Loader2,
  Sparkles,
  Tags,
  FolderGit2,
  ArrowUpDown,
  Users,
  GitBranch,
  MapPin,
  Building2,
  TrendingUp,
  PieChart as PieChartIcon,
  Radar as RadarIcon,
  Clock,
  RefreshCw,
  GraduationCap,
} from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart as RechartsPie, Pie, Cell, Legend } from "recharts"
import { ThemedChartTooltip } from "@/components/ui/chart-tooltip"
import { getUsers, syncStars, getGitHubToken, getSyncRuns, getStarDna, getLearningPath, getStats, getTags, getUserStarTimeline } from "@/lib/api"
import type { UserStats } from "@/lib/api"
import { useDeveloper } from "@/contexts/DeveloperContext"
import { Select, SelectOption } from "@/components/ui/select"

// ===== 排序类型定义 =====
type SortField = "name" | "synced_at" | "stars"
type SortOrder = "asc" | "desc"

const SORT_OPTIONS: SortField[] = ["name", "synced_at", "stars"]

// ===== 类型定义 =====
interface Developer {
  id: string
  name: string
  displayName: string | null
  bio: string | null
  company: string | null
  location: string | null
  followers: number | null
  publicRepos: number | null
  stars: number
  isActive: boolean
  avatar_url?: string | null
  profile_url?: string | null
  synced_at?: string | null
}

// 同步历史记录类型
interface SyncRun {
  id: number
  user_login: string
  started_at: string
  ended_at: string | null
  status: string
  repos_upserted: number
  stars_upserted: number
  repos_removed: number
  pages_fetched: number
  rate_limit_remaining: number | null
  rate_limit_reset: string | null
  error_message: string | null
}

const ITEMS_PER_PAGE = 20

// ===== 技术雷达六维映射规则（从 Dashboard 复制） =====
const RADAR_TAG_MAP: Record<string, string[]> = {
  frontend: ['frontend', 'css', 'ui', 'react', 'vue', 'web'],
  backend: ['backend', 'api', 'database', 'server', 'nodejs', 'python'],
  ai: ['ai', 'llm', 'agent', 'machine-learning', 'deep-learning', 'rag', 'mcp'],
  tools: ['cli', 'developer-tools', 'editor', 'git', 'tooling'],
  infrastructure: ['devops', 'container', 'docker', 'ci', 'cloud', 'monitoring'],
  data: ['data', 'visualization', 'database', 'etl', 'analytics'],
}

const RADAR_DIMENSIONS = [
  { key: 'frontend', color: '#0284c7' },
  { key: 'backend', color: '#059669' },
  { key: 'ai', color: '#7c3aed' },
  { key: 'tools', color: '#475569' },
  { key: 'infrastructure', color: '#006b5c' },
  { key: 'data', color: '#9b4420' },
]

// ===== 语言生态归类配置（从 Dashboard 复制） =====
const CATEGORY_MAP: Record<string, { key: string; color: string }> = {
  'Python': { key: 'pythonEcosystem', color: 'bg-domain-backend' },
  'TypeScript': { key: 'tsEcosystem', color: 'bg-domain-frontend' },
  'JavaScript': { key: 'tsEcosystem', color: 'bg-domain-frontend' },
  'Rust': { key: 'systemTools', color: 'bg-domain-tools' },
  'Go': { key: 'systemTools', color: 'bg-domain-tools' },
  'C': { key: 'systemTools', color: 'bg-domain-tools' },
  'C++': { key: 'systemTools', color: 'bg-domain-tools' },
  'Shell': { key: 'systemTools', color: 'bg-domain-tools' },
  'Objective-C': { key: 'systemTools', color: 'bg-domain-tools' },
  'Zig': { key: 'systemTools', color: 'bg-domain-tools' },
  'Nim': { key: 'systemTools', color: 'bg-domain-tools' },
  'Swift': { key: 'systemTools', color: 'bg-domain-tools' },
  'Jupyter Notebook': { key: 'jupyterNotes', color: 'bg-domain-ai' },
  'Java': { key: 'jvmEcosystem', color: 'bg-domain-backend' },
  'Kotlin': { key: 'jvmEcosystem', color: 'bg-domain-backend' },
  'Scala': { key: 'jvmEcosystem', color: 'bg-domain-backend' },
  'Groovy': { key: 'jvmEcosystem', color: 'bg-domain-backend' },
  'HTML': { key: 'frontendEcosystem', color: 'bg-domain-frontend' },
  'CSS': { key: 'frontendEcosystem', color: 'bg-domain-frontend' },
  'Vue': { key: 'frontendEcosystem', color: 'bg-domain-frontend' },
  'PHP': { key: 'frontendEcosystem', color: 'bg-domain-frontend' },
  'Dart': { key: 'frontendEcosystem', color: 'bg-domain-frontend' },
}

const LANGUAGE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
]

interface PersonalityItem {
  nameKey: string
  count: number
  color: string
}

interface RadarItem {
  labelKey: string
  value: number
  color: string
}

/**
 * 将语言分布归类为生态（从 Dashboard 复制）
 */
function categorizeLanguages(languages: { language: string; count: number }[]): PersonalityItem[] {
  const agg: Record<string, { key: string; color: string; count: number }> = {}
  for (const { language, count } of languages) {
    const cfg = CATEGORY_MAP[language]
    if (cfg) {
      const existing = agg[cfg.key]
      if (existing) {
        existing.count += count
      } else {
        agg[cfg.key] = { ...cfg, count }
      }
    } else {
      const other = agg['otherEcosystem']
      if (other) {
        other.count += count
      } else {
        agg['otherEcosystem'] = { key: 'otherEcosystem', color: 'bg-domain-backend', count }
      }
    }
  }
  return Object.values(agg)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map(item => ({ nameKey: item.key, count: item.count, color: item.color }))
}

/**
 * 计算技术雷达六维数据（从 Dashboard 复制）
 */
function calcRadarData(tags: { tag: string; count: number }[]): RadarItem[] {
  if (!tags || tags.length === 0) {
    return []
  }

  const tagMap = new Map(tags.map(t => [t.tag.toLowerCase(), t.count]))
  const dimCounts = RADAR_DIMENSIONS.map(dim => {
    const keywords = RADAR_TAG_MAP[dim.key]
    const count = keywords.reduce((sum, kw) => sum + (tagMap.get(kw) || 0), 0)
    return { ...dim, count }
  })

  const totalRelevant = dimCounts.reduce((sum, d) => sum + d.count, 0)
  if (totalRelevant === 0) {
    return []
  }

  const maxCount = Math.max(...dimCounts.map(d => d.count), 1)
  return dimCounts.map(dim => ({
    labelKey: dim.key,
    value: Math.round((dim.count / maxCount) * 60 + 40), // 映射到 40-100
    color: dim.color,
  }))
}

/**
 * 格式化数字（>=1000 显示为 k 单位）
 */
function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

/**
 * 计算百分比
 */
function calcPercent(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((value / total) * 100)
}

/**
 * 取 count 最高的前 N 项
 */
function pickTopItems<T extends { count: number }>(items: T[], limit: number): T[] {
  return [...items].sort((a, b) => b.count - a.count).slice(0, limit)
}

/**
 * 规范化 GitHub 用户名输入：支持 @login、GitHub 用户主页 URL 和首尾空白。
 */
function normalizeGitHubLogin(input: string): string {
  let value = input.trim()
  value = value.replace(/^https?:\/\/github\.com\//i, "")
  value = value.split(/[/?#]/)[0] || value
  return value.replace(/^@+/, "").trim()
}

/**
 * 星标时间趋势组件：统计卡片 + 面积图
 */
function TrendBars({ data, labels }: { data: { label: string; value: number }[]; labels: { total: string; peakMonth: string; peakValue: string } }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const peak = data.reduce((best, item) => item.value > best.value ? item : best, data[0])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-outline-variant/60 bg-surface-container-low px-3 py-2">
          <div className="text-xs text-muted-foreground">{total}</div>
          <div className="text-sm font-medium text-on-surface">{labels.total}</div>
        </div>
        <div className="rounded-md border border-outline-variant/60 bg-surface-container-low px-3 py-2">
          <div className="text-xs text-muted-foreground">{peak?.label || "-"}</div>
          <div className="text-sm font-medium text-on-surface">{labels.peakMonth}</div>
        </div>
        <div className="rounded-md border border-outline-variant/60 bg-surface-container-low px-3 py-2">
          <div className="text-xs text-muted-foreground">{peak?.value || 0}</div>
          <div className="text-sm font-medium text-on-surface">{labels.peakValue}</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip content={<ThemedChartTooltip />} />
          <Area type="monotone" dataKey="value" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.15} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * 紧凑统计网格组件：多列标签统计卡片
 */
function CompactStatGrid({
  items,
  total,
  limit = 16,
}: {
  items: { label: string; count: number; color: string }[]
  total: number
  limit?: number
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {items.slice(0, limit).map((item) => (
        <div key={item.label} className="min-w-0 rounded-md border border-outline-variant/60 bg-surface-container-low px-3 py-2">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="truncate text-sm font-medium text-on-surface">{item.label}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-lg font-semibold text-on-surface">{item.count}</span>
            <span className="font-mono text-xs text-muted-foreground">{calcPercent(item.count, total)}%</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Developers() {
  const { t, i18n } = useTranslation()
  const { currentLogin, setCurrentLogin } = useDeveloper()

  // 开发者列表状态（初始为空，由 useEffect 加载）
  const [developers, setDevelopers] = useState<Developer[]>([])
  // 加载状态
  const [loading, setLoading] = useState(false)
  // 错误信息
  const [error, setError] = useState<string | null>(null)
  // 是否使用 API 模式（true 表示成功接入真实 API）
  const [isApiMode, setIsApiMode] = useState(false)

  const [searchInput, setSearchInput] = useState("")
  const [searchResult, setSearchResult] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  // 排序状态：排序字段和排序方向
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")
  // 同步状态以 key 形式存储，便于翻译
  const [syncStatus, setSyncStatus] = useState("pending")
  const [syncError, setSyncError] = useState("")
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([])
  const [starDna, setStarDna] = useState<string | null>(null)
  const [dnaLoading, setDnaLoading] = useState(false)
  const [dnaError, setDnaError] = useState("")
  const [learningPath, setLearningPath] = useState<string | null>(null)
  const [pathLoading, setPathLoading] = useState(false)
  const [pathError, setPathError] = useState("")
  const [developerStats, setDeveloperStats] = useState<UserStats | null>(null)
  const [developerTags, setDeveloperTags] = useState<{ tag: string; count: number }[]>([])
  const [starTimeline, setStarTimeline] = useState<Array<{ month: string; count: number }>>([])
  // 请求序号用于防止切换开发者/语言时旧响应覆盖当前页面
  const dnaRequestSeq = useRef(0)
  const pathRequestSeq = useRef(0)

  // 获取同步状态显示文本
  const getSyncStatusText = (status: string) => {
    if (status === "successToken") return t("developers.syncSuccessToken")
    if (status === "successAnon") return t("developers.syncSuccessAnon")
    return t(`developers.syncStates.${status}`)
  }

  // 页面加载时调用真实 API 获取用户列表
  useEffect(() => {
    refreshDevelopers()
  }, [t, currentLogin])

  // 刷新开发者列表数据（从 API 加载并映射）
  const refreshDevelopers = async () => {
    setLoading(true)
    setError(null)
    try {
      const users = await getUsers()
      const realUsers = users.filter((user) => user.login !== "demo-user")
      const isValidApiData = realUsers.some((user) => Boolean(user.synced_at))
      if (isValidApiData) {
        const activeLogin = realUsers.some((user) => user.login === currentLogin)
          ? currentLogin
          : realUsers[0]?.login
        const mapped: Developer[] = realUsers.map((u, i) => ({
          id: String(i + 1),
          name: u.login,
          displayName: u.name,
          bio: u.bio,
          company: u.company,
          location: u.location,
          followers: u.followers,
          publicRepos: u.public_repos,
          stars: u.repoCount,
          isActive: u.login === activeLogin,
          avatar_url: u.avatar_url,
          profile_url: u.profile_url,
          synced_at: u.synced_at,
        }))
        if (activeLogin && activeLogin !== currentLogin) {
          setCurrentLogin(activeLogin)
        }
        setDevelopers(mapped)
        setIsApiMode(true)
      } else {
        setDevelopers([])
        setIsApiMode(false)
      }
    } catch {
      setError(t("developers.loadError"))
      setDevelopers([])
      setIsApiMode(false)
    } finally {
      setLoading(false)
    }
  }

  // 排序 + 分页数据
  const sortedDevelopers = useMemo(() => {
    const sorted = [...developers].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name)
          break
        case "synced_at":
          // 同步时间：空的排在最后
          const aTime = a.synced_at ? new Date(a.synced_at).getTime() : 0
          const bTime = b.synced_at ? new Date(b.synced_at).getTime() : 0
          if (aTime === 0 && bTime === 0) cmp = 0
          else if (aTime === 0) cmp = 1
          else if (bTime === 0) cmp = -1
          else cmp = aTime - bTime
          break
        case "stars":
          cmp = a.stars - b.stars
          break
      }
      return sortOrder === "asc" ? cmp : -cmp
    })
    return sorted
  }, [developers, sortField, sortOrder])

  // 排序变化时重置到第1页
  useEffect(() => {
    setCurrentPage(1)
  }, [sortField, sortOrder])

  const totalPages = Math.ceil(sortedDevelopers.length / ITEMS_PER_PAGE)
  const paginatedDevs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return sortedDevelopers.slice(start, start + ITEMS_PER_PAGE)
  }, [sortedDevelopers, currentPage])

  // 当前选中的开发者
  const activeDev = developers.find((d) => d.isActive)

  // 选中某个开发者
  const selectDeveloper = (id: string) => {
    const target = developers.find((dev) => dev.id === id)
    if (target) {
      setCurrentLogin(target.name)
    }
    setDevelopers((prev) =>
      prev.map((dev) => ({
        ...dev,
        isActive: dev.id === id,
      }))
    )
  }

  // 删除开发者
  const removeDeveloper = (id: string) => {
    const target = developers.find((d) => d.id === id)
    if (!target) return
    const remaining = developers.filter((d) => d.id !== id)
    if (target.isActive && remaining.length > 0) {
      remaining[0] = { ...remaining[0], isActive: true }
    }
    setDevelopers(remaining)
    // 重新计算当前页
    const newTotal = Math.ceil(remaining.length / ITEMS_PER_PAGE)
    setCurrentPage((p) => Math.min(p, newTotal || 1))
  }

  // 添加开发者（补全默认值，添加后自动同步星标）
  const addDeveloper = async () => {
    const name = normalizeGitHubLogin(searchResult || searchInput)
    if (!name) return
    if (developers.find((d) => d.name === name)) {
      // 用户已存在，直接选中
      setDevelopers((prev) => prev.map((d) => ({ ...d, isActive: d.name === name })))
      setCurrentLogin(name)
      setSearchInput("")
      setSearchResult("")
      return
    }
    const newDev: Developer = {
      id: Date.now().toString(),
      name,
      displayName: null,
      bio: null,
      company: null,
      location: null,
      followers: null,
      publicRepos: null,
      stars: 0,
      isActive: true,
      avatar_url: null,
      profile_url: null,
      synced_at: null,
    }
    setDevelopers((prev) => [...prev.map((d) => ({ ...d, isActive: false })), newDev])
    setCurrentLogin(name)
    setSearchInput("")
    setSearchResult("")
    // 自动同步一次星标，获取用户公开资料和星标列表
    await runSync(name)
  }

  const handleSearch = () => {
    const name = normalizeGitHubLogin(searchInput)
    if (name) {
      setSearchResult(name)
    }
  }

  // 加载同步历史记录
  const loadSyncRuns = async (name: string) => {
    try {
      const runs = await getSyncRuns(name)
      setSyncRuns(runs)
    } catch {
      setSyncRuns([])
    }
  }

  // 加载 Star DNA 画像
  const loadStarDna = async (login: string, force = false) => {
    const requestSeq = ++dnaRequestSeq.current
    // 仅在强制刷新时显示 loading 并清空旧数据
    if (force) {
      setDnaLoading(true)
      setStarDna(null)
    }
    setDnaError("")
    try {
      const result = await getStarDna(login, force)
      if (requestSeq !== dnaRequestSeq.current) return
      if (result?.dna) {
        setStarDna(result.dna)
      } else if (force) {
        setStarDna(null)
      }
    } catch (err) {
      if (requestSeq !== dnaRequestSeq.current) return
      setStarDna(null)
      setDnaError(err instanceof Error ? err.message : t("developers.dnaEmpty"))
    }
    finally {
      if (force && requestSeq === dnaRequestSeq.current) setDnaLoading(false)
    }
  }

  // 加载学习路径
  const loadLearningPath = async (login: string, force = false) => {
    const requestSeq = ++pathRequestSeq.current
    if (force) {
      setPathLoading(true)
      setLearningPath(null)
    }
    setPathError("")
    try {
      const result = await getLearningPath(login, force)
      if (requestSeq !== pathRequestSeq.current) return
      if (result?.path) {
        setLearningPath(result.path)
      } else if (force) {
        setLearningPath(null)
      }
    } catch (err) {
      if (requestSeq !== pathRequestSeq.current) return
      setLearningPath(null)
      setPathError(err instanceof Error ? err.message : t("developers.pathEmpty"))
    }
    finally {
      if (force && requestSeq === pathRequestSeq.current) setPathLoading(false)
    }
  }

  // 当前选中开发者变化时，加载同步历史和 Star DNA
  const activeDevName = activeDev?.name
  useEffect(() => {
    if (activeDevName) {
      // 切换开发者时清空旧数据（上一个开发者的内容）
      setStarDna(null)
      setLearningPath(null)
      setDnaError("")
      setPathError("")
      setDnaLoading(false)
      setPathLoading(false)
      loadSyncRuns(activeDevName)
      loadStarDna(activeDevName)
      loadLearningPath(activeDevName)
      getStats(activeDevName).then(setDeveloperStats).catch(() => setDeveloperStats(null))
      getTags(activeDevName).then(setDeveloperTags).catch(() => setDeveloperTags([]))
      getUserStarTimeline(activeDevName).then(setStarTimeline).catch(() => setStarTimeline([]))
    } else {
      setSyncRuns([])
      setStarDna(null)
      setLearningPath(null)
      setDnaError("")
      setPathError("")
      setDeveloperStats(null)
      setDeveloperTags([])
      setStarTimeline([])
    }
  }, [activeDevName])

  // 语言切换时重新加载 DNA、学习路径和标签
  useEffect(() => {
    if (activeDevName) {
      setStarDna(null)
      setLearningPath(null)
      setDnaError("")
      setPathError("")
      loadStarDna(activeDevName)
      loadLearningPath(activeDevName)
      getTags(activeDevName).then(setDeveloperTags).catch(() => setDeveloperTags([]))
    }
  }, [i18n.language])

  // 同步当前开发者星标（调用真实 API）
  const runSync = async (name: string) => {
    setSyncStatus("syncing")
    setSyncError("")
    try {
      const token = getGitHubToken()
      const result = await syncStars(name, token || undefined)
      if (result !== null) {
        const syncedName = result.username || name
        setSyncStatus(token ? "successToken" : "successAnon")
        setSearchResult(t("developers.starUpdated", { name: syncedName }))
        await loadSyncRuns(syncedName)
        await loadStarDna(syncedName)
        await loadLearningPath(syncedName)
        // 同步成功后刷新开发者列表，更新星标数
        await refreshDevelopers()
        // 刷新统计和标签
        getStats(syncedName).then(setDeveloperStats).catch(() => setDeveloperStats(null))
        getTags(syncedName).then(setDeveloperTags).catch(() => setDeveloperTags([]))
      } else {
        setSyncStatus("networkFail")
        setSyncError(t("developers.syncUnknownError"))
      }
    } catch (err) {
      setSyncStatus("networkFail")
      const message = err instanceof Error ? err.message : ""
      setSyncError(message === "SYNC_FAILED" ? t("developers.syncUnknownError") : message || t("developers.syncUnknownError"))
    }
  }

  // ===== 详情面板派生数据（与 Dashboard 风格对齐） =====
  // 技术人格：基于语言分布归类生态
  const personalityData = useMemo(
    () => (developerStats?.languages?.length ? categorizeLanguages(developerStats.languages) : []),
    [developerStats],
  )
  // 技术雷达：基于标签六维映射
  const radarData = useMemo(() => calcRadarData(developerTags), [developerTags])
  // 技术雷达圆形渐变（conic-gradient 模拟）
  const radarGradient = useMemo(() => {
    const total = radarData.reduce((sum, r) => sum + r.value, 0)
    if (total === 0) return ""
    let start = 0
    const segments = radarData.map((d) => {
      const segStart = start
      const segEnd = start + (d.value / total) * 360
      start = segEnd
      return `${d.color} ${segStart}deg ${segEnd}deg`
    })
    return `conic-gradient(${segments.join(", ")})`
  }, [radarData])

  // 语言分布 conic-gradient
  const languageGradient = useMemo(() => {
    const data = (developerStats?.languages ?? []).slice(0, 8)
    const total = data.reduce((sum, l) => sum + l.count, 0)
    if (total === 0) return ""
    let start = 0
    const segments = data.map((l, i) => {
      const segStart = start
      const segEnd = start + (l.count / total) * 360
      start = segEnd
      return `${LANGUAGE_COLORS[i % LANGUAGE_COLORS.length]} ${segStart}deg ${segEnd}deg`
    })
    return `conic-gradient(${segments.join(", ")})`
  }, [developerStats])

  const languageTotal = useMemo(
    () => (developerStats?.languages ?? []).slice(0, 8).reduce((sum, l) => sum + l.count, 0),
    [developerStats]
  )
  // 星标趋势图表数据（月份取 MM 格式）
  const trendData = useMemo(
    () => starTimeline.map((item) => ({ label: item.month.slice(5), value: item.count })),
    [starTimeline],
  )

  return (
    <div className="bg-grid-pattern min-h-[calc(100vh-8rem)]">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-on-surface">
          {t("developers.title")}
        </h1>
        <p className="text-on-surface-variant mt-1">
          {t("developers.subtitle")}
        </p>
      </div>

      {/* 搜索添加区域 */}
      <Card className="mb-8 border border-outline-variant/50 bg-surface-container-low">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-on-surface">
            <Search className="h-4 w-4 inline-block mr-2 text-primary" />
            {t("developers.searchTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Input
                placeholder={t("developers.searchPlaceholder")}
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value)
                  setSearchResult("")
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch()
                }}
                className="bg-surface-container-lowest text-sm"
              />
            </div>
            <Button
              className="bg-primary text-on-primary hover:bg-primary/90 gap-2"
              onClick={handleSearch}
            >
              <Search className="w-4 h-4" />
              {t("developers.searchBtn")}
            </Button>
            {searchResult && (
              <Button
                className="bg-primary text-on-primary hover:bg-primary/90 gap-2"
                onClick={addDeveloper}
              >
                <UserPlus className="w-4 h-4" />
                {t("developers.addBtn")}
              </Button>
            )}
          </div>
          {searchResult && (
            <div className="mt-3 flex items-center gap-2 text-sm text-on-surface-variant">
              <span>{t("developers.found")}</span>
              <Badge variant="outline" className="font-mono text-xs">
                @{searchResult}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-on-surface-variant hover:text-on-surface"
                onClick={() => setSearchResult("")}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Loading 状态 */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-on-surface-variant">
          <Loader2 className="w-8 h-8 animate-spin mr-2" />
          <span>{t("developers.loading")}</span>
        </div>
      )}

      {/* 开发者列表：一页 20 个，桌面端 5 列 x 4 行 */}
      {!loading && developers.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-on-surface-variant">
            {t("developers.totalDevs", { count: developers.length })}
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-on-surface-variant" />
            <Select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="h-8 w-auto text-xs"
            >
              {SORT_OPTIONS.map((field) => (
                <SelectOption key={field} value={field}>
                  {t(`developers.sortField.${field}`)}
                </SelectOption>
              ))}
            </Select>
            <Select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="h-8 w-auto text-xs"
            >
              <SelectOption value="asc">{t("developers.sortOrder.asc")}</SelectOption>
              <SelectOption value="desc">{t("developers.sortOrder.desc")}</SelectOption>
            </Select>
          </div>
        </div>
      )}
      {!loading && (
        <div className="flex flex-wrap gap-3 mb-6">
          {paginatedDevs.map((dev) => (
            <Card
              key={dev.id}
              className={`w-[220px] shrink-0 border transition-colors cursor-pointer ${
                dev.isActive
                  ? "border-primary bg-surface-container-high shadow-sm"
                  : "border-outline-variant/50 bg-surface-container-low hover:bg-surface-container"
              }`}
              onClick={() => selectDeveloper(dev.id)}
            >
              <CardContent className="flex items-start gap-2.5 py-3 px-3.5">
                {/* 选中指示器 */}
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${
                    dev.isActive ? "bg-primary" : "bg-outline-variant"
                  }`}
                />
                {/* 头像占位 */}
                <div className="w-9 h-9 rounded-full bg-surface-container-highest border border-outline-variant flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-primary">
                    {dev.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                {/* 信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-on-surface">
                      @{dev.name}
                    </span>
                  </div>
                  {/* 显示名称 */}
                  {dev.displayName && (
                    <div className="text-xs text-on-surface-variant">
                      {dev.displayName}
                    </div>
                  )}
                  {/* 统计行：星标 / 关注者 / 公开仓库 */}
                  <div className="flex items-center gap-2 text-[11px] text-on-surface-variant mt-0.5">
                    <span className="flex items-center gap-0.5" title={t("developers.starCountShort")}>
                      <Star className="w-3 h-3" />
                      {dev.stars}
                    </span>
                    {dev.followers !== null && dev.followers !== undefined && (
                      <span className="flex items-center gap-0.5" title={t("developers.followers")}>
                        <Users className="w-3 h-3" />
                        {dev.followers}
                      </span>
                    )}
                    {dev.publicRepos !== null && dev.publicRepos !== undefined && (
                      <span className="flex items-center gap-0.5" title={t("developers.publicRepos")}>
                        <GitBranch className="w-3 h-3" />
                        {dev.publicRepos}
                      </span>
                    )}
                  </div>
                  {/* 公司 / 所在地 */}
                  {(dev.company || dev.location) && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-on-surface-variant/70 mt-0.5">
                      {dev.company && (
                        <span className="flex items-center gap-0.5">
                          <Building2 className="w-3 h-3" />
                          {dev.company}
                        </span>
                      )}
                      {dev.location && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />
                          {dev.location}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 删除按钮 */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-on-surface-variant hover:text-error shrink-0 mt-0.5"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeDeveloper(dev.id)
                  }}
                  title={t("developers.removeTooltip")}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!loading && developers.length === 0 && (
        <div className="text-center py-16 text-on-surface-variant">
          <Plus className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">{t("developers.noDevs")}</p>
          <p className="text-sm mt-1">{t("developers.noDevsHint")}</p>
        </div>
      )}

      {/* 分页 */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between mb-10">
          <div className="text-sm text-muted-foreground">
            {t("developers.totalDevs", { count: developers.length })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant="outline"
                  size="sm"
                  className={`h-8 min-w-[2rem] ${
                    p === currentPage
                      ? "bg-primary text-on-primary"
                      : ""
                  }`}
                  onClick={() => setCurrentPage(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ===== 选中开发者的详情面板（原 Dashboard 内容） ===== */}
      {activeDev && (
        <div className="space-y-6 pt-6 border-t border-outline-variant/50">
          {/* Hero Section */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-on-primary">
                  <Brain className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-on-surface">
                    @{activeDev.name}
                  </h2>
                  {/* 显示名称 + Bio */}
                  {activeDev.displayName && (
                    <p className="text-sm text-on-surface font-medium">
                      {activeDev.displayName}
                    </p>
                  )}
                  {activeDev.bio && (
                    <p className="text-sm text-muted-foreground truncate max-w-md">
                      {activeDev.bio}
                    </p>
                  )}
                  {/* 统计标签行 */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5" />
                      {activeDev.stars} {t("developers.starCountShort")}
                    </span>
                    {activeDev.followers !== null && activeDev.followers !== undefined && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {activeDev.followers} {t("developers.followers")}
                      </span>
                    )}
                    {activeDev.publicRepos !== null && activeDev.publicRepos !== undefined && (
                      <span className="flex items-center gap-1">
                        <GitBranch className="w-3.5 h-3.5" />
                        {activeDev.publicRepos} {t("developers.publicRepos")}
                      </span>
                    )}
                    {activeDev.company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {activeDev.company}
                      </span>
                    )}
                    {activeDev.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {activeDev.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* 同步当前开发者星标 */}
                <Button
                  className="bg-primary text-on-primary hover:bg-primary/90 gap-2"
                  onClick={() => runSync(activeDev.name)}
                  disabled={syncStatus === "syncing"}
                >
                  <RotateCw className={`w-4 h-4 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
                  {syncStatus === "syncing" ? t("developers.syncingBtn") : t("developers.syncBtn")}
                </Button>
                <Button variant="outline" className="gap-2" asChild>
                  <Link to="/explorer">
                    <FolderGit2 className="h-4 w-4" />
                    {t("developers.viewStarRepos")}
                  </Link>
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t("developers.syncStatus")}</span>
              <Badge variant={syncStatus.startsWith("success") ? "default" : syncStatus === "syncing" ? "secondary" : "outline"}>
                {getSyncStatusText(syncStatus)}
              </Badge>
              {syncStatus === "syncing" && (
                <span className="text-xs text-status-warning">{t("developers.syncingHint")}</span>
              )}
              {syncError && <span className="text-xs text-status-danger">{syncError}</span>}
              {!isApiMode && syncStatus !== "syncing" && (
                <span className="text-xs text-muted-foreground">{t("developers.simulateNotice")}</span>
              )}
            </div>
            {/* Star DNA 画像卡片 */}
            {activeDev && (
              <Card className="bg-surface-container-low/50 border-primary/20 mt-3">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-4 w-4 text-primary" />
                      {t("developers.starDnaTitle")}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs shrink-0"
                      disabled={dnaLoading}
                      onClick={() => loadStarDna(activeDev.name, true)}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${dnaLoading ? "animate-spin" : ""}`} />
                      {dnaLoading ? t("developers.dnaLoading") : t("developers.regenerateDna")}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {dnaLoading && !starDna ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      {t("developers.dnaLoading")}
                    </div>
                  ) : starDna ? (
                    <p className="text-sm leading-relaxed text-on-surface">{starDna}</p>
                  ) : dnaError ? (
                    <p className="text-sm text-status-danger">{dnaError}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("developers.dnaEmpty")}</p>
                  )}
                </CardContent>
              </Card>
            )}
            {/* 学习路径推荐卡片 */}
            {activeDev && (
              <Card className="bg-surface-container-low/50 border-primary/20 mt-3">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <GraduationCap className="h-4 w-4 text-primary" />
                      {t("developers.learningPathTitle")}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs shrink-0"
                      disabled={pathLoading}
                      onClick={() => loadLearningPath(activeDev.name, true)}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${pathLoading ? "animate-spin" : ""}`} />
                      {pathLoading ? t("developers.pathLoading") : t("developers.regeneratePath")}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {pathLoading && !learningPath ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      {t("developers.pathLoading")}
                    </div>
                  ) : learningPath ? (
                    <div className="text-sm leading-relaxed text-on-surface space-y-2">
                      {learningPath.split('\n').map((line, i) => {
                        if (line.startsWith('## ')) return <h2 key={i} className="text-base font-semibold mt-3 mb-1">{line.slice(3)}</h2>
                        if (line.startsWith('- ')) return <div key={i} className="ml-4">• {line.slice(2)}</div>
                        if (line.trim() === '') return null
                        return <p key={i}>{line}</p>
                      })}
                    </div>
                  ) : pathError ? (
                    <p className="text-sm text-status-danger">{pathError}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("developers.pathEmpty")}</p>
                  )}
                </CardContent>
              </Card>
            )}
            {syncRuns.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {t("developers.syncHistory")}
                </h3>
                <div className="space-y-1.5">
                  {syncRuns.slice(0, 5).map((run) => (
                    <div
                      key={run.id}
                      className="flex flex-wrap items-center gap-3 text-sm rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2"
                    >
                      <span className="text-muted-foreground tabular-nums">
                        {new Date(run.started_at).toLocaleString()}
                      </span>
                      <Badge
                        className={
                          run.status === "success"
                            ? "bg-green-600 text-white hover:bg-green-600"
                            : run.status === "failed"
                              ? "bg-red-600 text-white hover:bg-red-600"
                              : "bg-yellow-500 text-white hover:bg-yellow-500"
                        }
                      >
                        {run.status}
                      </Badge>
                      <span className="text-muted-foreground">
                        {t("developers.syncRepos")}: {run.repos_upserted}
                      </span>
                      <span className="text-muted-foreground">
                        {t("developers.syncStars")}: {run.stars_upserted}
                      </span>
                      <span className="text-muted-foreground">
                        {t("developers.syncPages")}: {run.pages_fetched}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-baseline gap-2 pt-2">
              <span className="text-4xl font-bold tracking-tight text-primary">
                {formatNumber(activeDev.stars)}
              </span>
              <span className="text-lg text-muted-foreground">
                {t("developers.starCount")}
              </span>
            </div>
          </section>

          {/* 技术人格（通栏）- Bento Grid 生态归类 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Diamond className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">{t("developers.personality")}</CardTitle>
              </div>
              <CardDescription>
                {t("developers.personalityDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {personalityData.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {personalityData.map((item) => (
                    <div
                      key={item.nameKey}
                      className="rounded-xl border border-outline-variant/50 bg-surface-container-high p-4 transition-colors hover:bg-surface-container"
                    >
                      <div className={`mb-3 h-2 w-full rounded-full ${item.color}`} />
                      <div className="text-2xl font-bold tracking-tight text-on-surface">
                        {item.count}
                      </div>
                      <div className="text-xs font-medium text-muted-foreground">
                        {t(`developers.${item.nameKey}`)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("developers.noLanguageStats")}</p>
              )}
            </CardContent>
          </Card>

          {/* 技术雷达 + 语言分布（左右分布） */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 技术雷达卡片 - 圆形 conic-gradient 雷达图 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <RadarIcon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-xl">{t("developers.radar")}</CardTitle>
                </div>
                <CardDescription>
                  {t("developers.radarDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {radarData.length > 0 ? (
                  <>
                    {/* 圆形雷达图（CSS conic-gradient 模拟） */}
                    <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full"
                      style={{ background: radarGradient }}
                    >
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-container-low">
                        <span className="text-lg font-bold text-primary">{t("developers.radarCenter")}</span>
                      </div>
                    </div>
                    {/* 六维状态统计 */}
                    <div className="space-y-2">
                      {radarData.map((item) => (
                        <div key={item.labelKey} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-on-surface-variant">{t(`developers.${item.labelKey}`)}</span>
                          </div>
                          <span className="font-mono font-medium text-on-surface">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("developers.noTagStats")}</p>
                )}
              </CardContent>
            </Card>

            {/* 语言分布（conic-gradient 圆形） */}
            {developerStats?.languages?.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-xl">{t("developers.languageDistribution")}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 圆形 conic-gradient 图 */}
                  <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full"
                    style={{ background: languageGradient }}
                  >
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-container-low">
                      <span className="text-lg font-bold text-primary">{developerStats.languages.length}</span>
                    </div>
                  </div>

                  {/* 语言列表带百分比 */}
                  <div className="space-y-2">
                    {developerStats.languages.slice(0, 8).map((l, i) => {
                      const pct = languageTotal > 0 ? Math.round((l.count / languageTotal) * 100) : 0
                      return (
                        <div key={l.language} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: LANGUAGE_COLORS[i % LANGUAGE_COLORS.length] }}
                            />
                            <span className="text-on-surface-variant">{l.language || "Unknown"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{l.count}</span>
                            <span className="font-mono font-medium text-on-surface">{pct}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 星标时间趋势（TrendBars 组件） */}
          {starTimeline.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle className="text-xl">{t("developers.starTrend")}</CardTitle>
                </div>
                <CardDescription>
                  {t("developers.starTrendDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrendBars
                  data={trendData}
                  labels={{
                    total: t("developers.trendTotal"),
                    peakMonth: t("developers.trendPeakMonth"),
                    peakValue: t("developers.trendPeakValue"),
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Top 标签（CompactStatGrid 组件） */}
          {developerTags.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Tags className="h-5 w-5 text-primary" />
                  <CardTitle className="text-xl">{t("developers.tagCloud")}</CardTitle>
                </div>
                <CardDescription>
                  {t("developers.tagCloudDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CompactStatGrid
                  total={developerTags.reduce((sum, item) => sum + item.count, 0)}
                  items={pickTopItems(developerTags, 16).map((item, i) => ({
                    label: item.label || item.tag,
                    count: item.count,
                    color: LANGUAGE_COLORS[i % LANGUAGE_COLORS.length],
                  }))}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
