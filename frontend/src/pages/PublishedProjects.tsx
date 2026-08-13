/**
 * PublishedProjects.tsx
 * 发布项目页面：浏览开发者自己发布的公开项目，支持搜索、语言筛选、排序、
 * 分页与语言分布统计。数据源为自有仓库（user_repos）。
 */
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ChevronLeft, ChevronRight, GitFork, LineChart, Search, Star } from "lucide-react"
import { getOwnedRepos, getOwnedStats, getApiErrorMessage } from "@/lib/api"
import type { OwnedRepoStats, RepoListResult } from "@/lib/api"
import { useDeveloper } from "@/contexts/DeveloperContext"
import { getTagLabel } from "@/lib/tag-labels"
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
import { PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { ThemedChartTooltip } from "@/components/ui/chart-tooltip"

type PublishedRepo = {
  fullName: string
  description: string
  stars: string
  forks: string
  language: string
  license: string
  updatedAt: string
  tags: string[]
  htmlUrl: string
}

// 语言色板：用于饼图 fill
const LANG_PALETTE: Record<string, string> = {
  Python: "#3572A5",
  TypeScript: "#3178C6",
  JavaScript: "#F7DF1E",
  Rust: "#DEA584",
  "C++": "#F34B7D",
  "C#": "#178600",
  Go: "#00ADD8",
  Java: "#B07219",
  "Jupyter Notebook": "#DA5B0B",
  Vue: "#4FC08D",
  HTML: "#E34F26",
  CSS: "#563D7C",
  Shell: "#89E051",
}
const FALLBACK_COLORS = ["#6b7280", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16", "#a855f7"]

function getLangHex(language: string, index: number): string {
  return LANG_PALETTE[language] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

/**
 * 根据语言返回对应的 UI 颜色类名（用于 Badge）
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
 * 将 API 返回的自有仓库数据转换为页面内部结构
 */
function adaptOwnedRepo(apiRepo: RepoListResult["items"][number], unknown: string): PublishedRepo {
  const starsStr = apiRepo.stars >= 1000 ? `${(apiRepo.stars / 1000).toFixed(1)}k` : String(apiRepo.stars)
  const forksStr = apiRepo.forks >= 1000 ? `${(apiRepo.forks / 1000).toFixed(1)}k` : String(apiRepo.forks)
  const tags = apiRepo.tags || []
  return {
    fullName: apiRepo.full_name,
    description: apiRepo.description || "",
    stars: starsStr,
    forks: forksStr,
    language: apiRepo.language || unknown,
    license: apiRepo.license || unknown,
    updatedAt: apiRepo.pushed_at ? apiRepo.pushed_at.slice(0, 10) : "",
    tags,
    htmlUrl: apiRepo.html_url,
  }
}

export default function PublishedProjects() {
  const { t, i18n } = useTranslation()
  const { currentLogin } = useDeveloper()

  const [allRepos, setAllRepos] = useState<PublishedRepo[]>([])
  const [stats, setStats] = useState<OwnedRepoStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLanguage, setSelectedLanguage] = useState("")
  const [sortKey, setSortKey] = useState<"stars" | "forks" | "updated_at">("stars")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // === 首次加载真实数据 ===
  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const [repoResult, statsResult] = await Promise.all([
          getOwnedRepos(currentLogin, { pageSize: 10000 }),
          getOwnedStats(currentLogin),
        ])
        if (cancelled) return
        const items = Array.isArray(repoResult?.items) ? repoResult.items : []
        setAllRepos(items.map((r) => adaptOwnedRepo(r, t("published.noLanguage"))))
        if (statsResult) setStats(statsResult)
      } catch (err) {
        if (cancelled) return
        setError(getApiErrorMessage(err, t, t("published.error")))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()
    return () => {
      cancelled = true
    }
  }, [currentLogin, t])

  // === 语言下拉选项 ===
  const languageOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const repo of allRepos) {
      const lang = repo.language || t("published.noLanguage")
      counts.set(lang, (counts.get(lang) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label]) => ({ label, value: label }) as SelectOption)
  }, [allRepos, t])

  // === 筛选与排序 ===
  const filteredRepos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const result = allRepos.filter((repo) => {
      const matchesQuery =
        !query ||
        [repo.fullName, repo.description, repo.language, ...repo.tags]
          .join(" ")
          .toLowerCase()
          .includes(query)
      const matchesLanguage = !selectedLanguage || repo.language === selectedLanguage
      return matchesQuery && matchesLanguage
    })

    const parseCount = (value: string) => {
      if (value.endsWith("k")) return Number(value.replace("k", "")) * 1000
      return Number(value)
    }

    return [...result].sort((a, b) => {
      if (sortKey === "stars") return parseCount(b.stars) - parseCount(a.stars)
      if (sortKey === "forks") return parseCount(b.forks) - parseCount(a.forks)
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [searchQuery, selectedLanguage, sortKey, allRepos])

  // === 分页 ===
  const totalPages = Math.max(1, Math.ceil(filteredRepos.length / pageSize))
  const paginatedRepos = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRepos.slice(start, start + pageSize)
  }, [currentPage, pageSize, filteredRepos])

  // === 语言分布（用于饼图） ===
  const langChartData = useMemo(() => {
    if (!stats?.languages?.length) return []
    return stats.languages.map((l, i) => ({
      name: l.language,
      value: l.count,
      color: getLangHex(l.language, i),
    }))
  }, [stats])

  const sortOptions: SelectOption[] = [
    { label: t("published.sortStars"), value: "stars" },
    { label: t("published.sortForks"), value: "forks" },
    { label: t("published.sortUpdated"), value: "updated_at" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("published.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("published.desc")}</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("published.repoCount")}</CardDescription>
            <CardTitle className="text-2xl">{stats?.repoCount ?? "-"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("published.activeRepoCount")}</CardDescription>
            <CardTitle className="text-2xl">{stats?.activeRepoCount ?? "-"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("published.totalStars")}</CardDescription>
            <CardTitle className="text-2xl">{stats?.totalStars ?? "-"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 语言分布 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("published.languages")}</CardTitle>
        </CardHeader>
        <CardContent>
          {langChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie data={langChartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {langChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ThemedChartTooltip />} />
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("published.noLanguage")}</p>
          )}
        </CardContent>
      </Card>

      {/* 项目列表 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">{t("published.table")}</CardTitle>
            <CardDescription>{t("published.tableDesc", { total: filteredRepos.length })}</CardDescription>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder={t("published.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>
            <Select
              value={selectedLanguage}
              onChange={(e) => {
                setSelectedLanguage(e.target.value)
                setCurrentPage(1)
              }}
            >
              <SelectOption value="">{t("published.languageAll")}</SelectOption>
              {languageOptions.map(({ label, value }) => (
                <SelectOption key={value} value={value}>{label}</SelectOption>
              ))}
            </Select>
            <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as "stars" | "forks" | "updated_at")}>
              {sortOptions.map(({ label, value }) => (
                <SelectOption key={value} value={value}>{label}</SelectOption>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t("published.loading")}</p>
          ) : error ? (
            <p className="text-sm text-status-danger py-8 text-center">{error}</p>
          ) : allRepos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t("published.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("published.title")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("published.tags")}</TableHead>
                  <TableHead>{t("published.language")}</TableHead>
                  <TableHead className="text-right">{t("published.lastUpdate")}</TableHead>
                  <TableHead className="text-right">{t("published.action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRepos.map((repo) => (
                  <TableRow key={repo.fullName} className="transition-colors hover:bg-surface-container">
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-on-surface">{repo.fullName}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Star className="h-3 w-3" />{repo.stars}</span>
                          <span className="flex items-center gap-1"><GitFork className="h-3 w-3" />{repo.forks}</span>
                        </div>
                        <p className="line-clamp-1 text-sm text-muted-foreground">{repo.description}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {repo.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
                            {getTagLabel(tag, i18n.language)}
                          </Badge>
                        ))}
                        {repo.tags.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{repo.tags.length - 3}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getLangColor(repo.language)} text-white text-xs`}>{repo.language}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-xs text-muted-foreground">{repo.updatedAt}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="gap-2" asChild>
                        <Link to={`/analysis?repo=${encodeURIComponent(repo.fullName)}`}>
                          <LineChart className="h-4 w-4" />
                          {t("published.viewRepo")}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* 分页 */}
          {!loading && !error && allRepos.length > 0 && (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mt-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{t("published.pageSize")}</span>
                {[20, 50, 100].map((size) => (
                  <Button
                    key={size}
                    variant={pageSize === size ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setPageSize(size)
                      setCurrentPage(1)
                    }}
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
                  {t("published.pageInfo", { current: currentPage, total: totalPages })}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}