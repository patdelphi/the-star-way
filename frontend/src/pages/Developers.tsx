/**
 * Developers.tsx
 * 开发者管理页面
 * 三列卡片网格展示开发者列表，支持搜索添加、删除、分页、选中高亮
 * 选中开发者在下方展开 Dashboard 详情面板，可同步该开发者星标
 * 改造：接入真实 API getUsers / syncStars，API 不可用时回退 Demo 数据
 */
import { useState, useMemo, useEffect } from "react"
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
  Code2,
  FolderGit2,
  ArrowUpDown,
  Users,
  GitBranch,
  MapPin,
  Building2,
  BarChart3,
} from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { ThemedChartTooltip } from "@/components/ui/chart-tooltip"
import { getUsers, syncStars, getGitHubToken, getSyncRuns, getStarDna, getStats, getTags, getUserStarTimeline } from "@/lib/api"
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

const LANGUAGE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
]

function percent(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((value / total) * 100)
}

export default function Developers() {
  const { t } = useTranslation()
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
  const [developerStats, setDeveloperStats] = useState<UserStats | null>(null)
  const [developerTags, setDeveloperTags] = useState<{ tag: string; count: number }[]>([])
  const [starTimeline, setStarTimeline] = useState<Array<{ month: string; count: number }>>([])

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
    const name = searchInput.trim().startsWith("@")
      ? searchInput.trim().slice(1)
      : searchInput.trim()
    if (!name) return
    if (developers.find((d) => d.name === name)) return
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
      isActive: false,
      avatar_url: null,
      profile_url: null,
      synced_at: null,
    }
    setDevelopers((prev) => [...prev, newDev])
    setSearchInput("")
    setSearchResult("")
    // 自动同步一次星标，获取用户公开资料和星标列表
    await runSync(name)
  }

  const handleSearch = () => {
    if (searchInput.trim()) {
      setSearchResult(searchInput.trim())
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
  const loadStarDna = async (login: string) => {
    const result = await getStarDna(login)
    if (result?.dna) setStarDna(result.dna)
  }

  // 当前选中开发者变化时，加载同步历史和 Star DNA
  useEffect(() => {
    if (activeDev) {
      loadSyncRuns(activeDev.name)
      loadStarDna(activeDev.name)
      getStats(activeDev.name).then(setDeveloperStats).catch(() => setDeveloperStats(null))
      getTags(activeDev.name).then(setDeveloperTags).catch(() => setDeveloperTags([]))
      getUserStarTimeline(activeDev.name).then(setStarTimeline).catch(() => setStarTimeline([]))
    } else {
      setSyncRuns([])
      setStarDna(null)
      setDeveloperStats(null)
      setDeveloperTags([])
      setStarTimeline([])
    }
  }, [activeDev])

  // 同步当前开发者星标（调用真实 API）
  const runSync = async (name: string) => {
    setSyncStatus("syncing")
    setSyncError("")
    try {
      const token = getGitHubToken()
      const result = await syncStars(name, token || undefined)
      if (result !== null) {
        setSyncStatus(token ? "successToken" : "successAnon")
        setSearchResult(t("developers.starUpdated", { name }))
        await loadSyncRuns(name)
        await loadStarDna(name)
        // 同步成功后刷新开发者列表，更新星标数
        await refreshDevelopers()
        // 刷新统计和标签
        getStats(name).then(setDeveloperStats).catch(() => setDeveloperStats(null))
        getTags(name).then(setDeveloperTags).catch(() => setDeveloperTags([]))
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
                {searchResult.startsWith("@") ? searchResult : `@${searchResult}`}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-6">
          {paginatedDevs.map((dev) => (
            <Card
              key={dev.id}
              className={`border transition-colors cursor-pointer ${
                dev.isActive
                  ? "border-primary bg-surface-container-high shadow-sm"
                  : "border-outline-variant/50 bg-surface-container-low hover:bg-surface-container"
              }`}
              onClick={() => selectDeveloper(dev.id)}
            >
              <CardContent className="flex items-start gap-3 py-3 px-4">
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
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-sm font-semibold text-on-surface truncate">
                      @{dev.name}
                    </span>
                    {dev.isActive && (
                      <Badge className="bg-primary text-on-primary text-[10px] px-1.5 py-0 shrink-0">
                        {t("developers.current")}
                      </Badge>
                    )}
                  </div>
                  {/* 显示名称 */}
                  {dev.displayName && (
                    <div className="text-xs text-on-surface-variant truncate">
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
                    <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant/70 mt-0.5 truncate">
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
            {starDna && (
              <Card className="bg-surface-container-low/50 border-primary/20 mt-3">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {t("developers.starDnaTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-on-surface">{starDna}</p>
                </CardContent>
              </Card>
            )}
            {/* 同步历史列表 */}
            {syncRuns.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
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
                {activeDev.stars}
              </span>
              <span className="text-lg text-muted-foreground">
                {t("developers.starCount")}
              </span>
            </div>
          </section>

          {/* Star 数量月度时间轴 */}
          {starTimeline.length > 0 && (() => {
            const total = starTimeline.reduce((sum, item) => sum + item.count, 0)
            const peak = starTimeline.reduce((best, item) => item.count > best.count ? item : best, starTimeline[0])
            const chartData = starTimeline.map(item => ({ label: item.month.slice(5), value: item.count }))
            return (
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">{t("developers.starTimeline")}</h3>
                </div>
                <Card className="p-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="rounded-md border border-outline-variant/60 bg-surface-container-low px-3 py-2">
                        <div className="text-xs text-muted-foreground">{total}</div>
                        <div className="text-sm font-medium text-on-surface">{t("developers.starTimelineTotal")}</div>
                      </div>
                      <div className="rounded-md border border-outline-variant/60 bg-surface-container-low px-3 py-2">
                        <div className="text-xs text-muted-foreground">{peak?.month || "-"}</div>
                        <div className="text-sm font-medium text-on-surface">{t("developers.starTimelinePeakMonth")}</div>
                      </div>
                      <div className="rounded-md border border-outline-variant/60 bg-surface-container-low px-3 py-2">
                        <div className="text-xs text-muted-foreground">{peak?.count || 0}</div>
                        <div className="text-sm font-medium text-on-surface">{t("developers.starTimelinePeakValue")}</div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<ThemedChartTooltip />} />
                        <Area type="monotone" dataKey="value" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.15} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </section>
            )
          })()}

          {/* 真实统计说明 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-8">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Diamond className="h-5 w-5 text-primary" />
                  <CardTitle className="text-xl">{t("developers.personality")}</CardTitle>
                </div>
                <CardDescription>
                  {t("developers.personalityEvidenceDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {developerStats?.languages?.length ? (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {developerStats.languages.slice(0, 6).map((item, index) => (
                      <div key={item.language || "Unknown"} className="rounded-md border border-outline-variant/60 bg-surface-container-low px-3 py-2">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LANGUAGE_COLORS[index % LANGUAGE_COLORS.length] }} />
                          <span className="truncate text-sm font-medium text-on-surface">{item.language || "Unknown"}</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="font-mono text-lg font-semibold text-on-surface">{item.count}</span>
                          <span className="font-mono text-xs text-muted-foreground">{percent(item.count, developerStats.repoCount)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("developers.noLanguageStats")}</p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-4">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Tags className="h-5 w-5 text-primary" />
                  <CardTitle className="text-xl">{t("developers.radar")}</CardTitle>
                </div>
                <CardDescription>
                  {t("developers.radarEvidenceDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {developerTags.slice(0, 8).map((item) => (
                    <div key={item.tag} className="flex items-center justify-between gap-3 rounded-md border border-outline-variant/60 bg-surface-container-low px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Code2 className="h-3.5 w-3.5 text-primary" />
                        <span className="truncate text-on-surface-variant">{item.tag}</span>
                      </div>
                      <span className="font-mono font-medium text-on-surface">{item.count}</span>
                    </div>
                  ))}
                  {developerTags.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t("developers.noTagStats")}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
