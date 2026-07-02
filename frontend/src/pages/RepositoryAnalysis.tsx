/**
 * RepositoryAnalysis.tsx
 * 单个仓库分析页，已接入真实 API。
 * 通过 getRepos / getStats / getTags 获取真实数据；API 不可用时展示空状态。
 */
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpenText,
  CheckCircle2,
  Clock,
  Code2,
  ExternalLink,
  FileText,
  GitFork,
  Info,
  Layers3,
  LineChart,
  Network,
  PackageCheck,
  Search,
  ShieldAlert,
  Star,
  Tags,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectOption } from "@/components/ui/select"
import { getRepos, getStats, getTags } from "@/lib/api"
import type { Repo, UserStats } from "@/lib/api"
import { useDeveloper } from "@/contexts/DeveloperContext"

/* ========== 常量 ========== */
type SignalTone = "safe" | "warning" | "danger"

type RepoAnalysis = {
  fullName: string
  description: string
  language: string
  stars: string
  forks: string
  updatedAt: string
  license: string
  category: string
  summary: string
  stack: string[]
  tags: string[]
  maintainSignals: { label: string; value: string; tone: SignalTone }[]
  scores: { label: string; value: number }[]
  risks: { label: string; detail: string; tone: SignalTone }[]
  similar: { fullName: string; reason: string; stars: string }[]
}

const toneClass: Record<SignalTone, string> = {
  safe: "text-status-safe",
  warning: "text-status-warning",
  danger: "text-status-danger",
}

const barClass: Record<SignalTone, string> = {
  safe: "bg-status-safe",
  warning: "bg-status-warning",
  danger: "bg-status-danger",
}

/* ========== 工具函数 ========== */

/** 将数字格式化为 k / M 显示 */
function formatStars(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

/* ========== 主组件 ========== */
export default function RepositoryAnalysis() {
  const { t } = useTranslation()
  const { currentLogin } = useDeveloper()
  const [selectedRepo, setSelectedRepo] = useState("")
  const [status, setStatus] = useState(t("repoAnalysis.initializing"))
  const [loading, setLoading] = useState(true)

  // API 返回的真实数据
  const [apiRepos, setApiRepos] = useState<(Repo & { starred_at: string; tags: string[] })[]>([])
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [allTags, setAllTags] = useState<{ tag: string; count: number }[]>([])

  /** 从 ISO 日期字符串提取 YYYY-MM-DD */
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return t("repoAnalysis.unknown")
    return dateStr.split("T")[0]
  }

  /** 为 API 仓库生成基础分析结构 */
  const buildDefaultAnalysis = (repo: Repo & { tags: string[] }): RepoAnalysis => {
    return {
      fullName: repo.full_name,
      description: repo.description ?? t("repoAnalysis.noDesc"),
      language: repo.language ?? t("repoAnalysis.unknown"),
      stars: formatStars(repo.stars),
      forks: String(repo.forks),
      updatedAt: formatDate(repo.pushed_at),
      license: repo.license ?? t("repoAnalysis.unknown"),
      category: t("repoAnalysis.unknown"),
      summary: t("repoAnalysis.noDeepSummary", { name: repo.full_name }),
      stack: repo.language ? [repo.language] : [],
      tags: repo.tags.length > 0 ? repo.tags : [],
      maintainSignals: [
        { label: t("repoAnalysis.signalLastUpdate"), value: formatDate(repo.pushed_at), tone: "safe" },
        { label: t("repoAnalysis.signalIssuePressure"), value: repo.open_issues > 50 ? t("repoAnalysis.issuePressureHigh") : t("repoAnalysis.issuePressureMedium"), tone: repo.open_issues > 50 ? "warning" : "safe" },
        { label: t("repoAnalysis.signalCommunityHeat"), value: t("repoAnalysis.unknown"), tone: "warning" },
        { label: t("repoAnalysis.signalApiStability"), value: t("repoAnalysis.unknown"), tone: "warning" },
      ],
      scores: [
        { label: t("repoAnalysis.learningValue"), value: 50 },
        { label: t("repoAnalysis.reuseValue"), value: 50 },
        { label: t("repoAnalysis.maintainActive"), value: 50 },
        { label: t("repoAnalysis.integrationDifficulty"), value: 50 },
      ],
      risks: [
        {
          label: t("repoAnalysis.licenseRisk"),
          detail: repo.license ? t("repoAnalysis.licenseKnownDetail", { license: repo.license }) : t("repoAnalysis.licenseUnknownDetail"),
          tone: repo.license ? "safe" : "warning",
        },
      ],
      similar: [],
    }
  }

  /** 组装状态栏文本 */
  const buildStatusText = (repoCount: number, tagCount: number, stats: UserStats | null): string => {
    const parts: string[] = []
    if (repoCount > 0) parts.push(t("repoAnalysis.loadedRepos", { count: repoCount }))
    if (tagCount > 0) parts.push(t("repoAnalysis.tagCount", { count: tagCount }))
    if (stats) parts.push(t("repoAnalysis.repoStats", { total: stats.repoCount, active: stats.activeRepoCount }))
    if (parts.length === 0) return t("repoAnalysis.noApiData")
    return parts.join(t("repoAnalysis.statusSeparator")) + t("repoAnalysis.statusSuffix")
  }

  /** 初始化：并行加载仓库列表、统计和标签 */
  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setLoading(true)
      try {
        const [reposResult, statsResult, tagsResult] = await Promise.all([
          getRepos(currentLogin, { pageSize: 100 }),
          getStats(currentLogin),
          getTags(currentLogin),
        ])

        if (cancelled) return

        setApiRepos(reposResult.items)
        setUserStats(statsResult)
        setAllTags(tagsResult)

          const storedRepo = localStorage.getItem("selected-star-repo")
        if (storedRepo) {
          const existsInApi = reposResult.items.some((r) => r.full_name === storedRepo)
          if (existsInApi) {
            setSelectedRepo(storedRepo)
            setStatus(t("repoAnalysis.importedFromStarred", { repo: storedRepo }))
          } else {
            setSelectedRepo(reposResult.items[0]?.full_name ?? "")
            setStatus(buildStatusText(reposResult.items.length, tagsResult.length, statsResult))
          }
        } else {
          setSelectedRepo(reposResult.items[0]?.full_name ?? "")
          setStatus(buildStatusText(reposResult.items.length, tagsResult.length, statsResult))
        }
      } catch (err) {
        if (cancelled) return
        setStatus(t("repoAnalysis.apiUnavailable"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [t, currentLogin])

  /** 下拉选择器的数据源：只使用 API 返回的真实仓库 */
  const selectorOptions = useMemo(() => {
    return apiRepos.map((r) => ({ fullName: r.full_name, description: r.description ?? "" }))
  }, [apiRepos])

  /** 当前激活的仓库：由 API 基础字段生成 */
  const activeRepo = useMemo<RepoAnalysis | null>(() => {
    const apiRepo = apiRepos.find((r) => r.full_name === selectedRepo)
    return apiRepo ? buildDefaultAnalysis(apiRepo) : null
  }, [selectedRepo, apiRepos])

  /** 重新读取当前仓库基础状态 */
  const refreshAnalysisStatus = () => {
    if (activeRepo) setStatus(t("repoAnalysis.importedFromStarred", { repo: activeRepo.fullName }))
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-grid-pattern">
      <div className="space-y-6">
        {/* 页面标题栏 */}
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs uppercase tracking-wider">
                {t("repoAnalysis.badge")}
              </Badge>
              <Badge variant="secondary" className="font-mono text-xs uppercase tracking-wider">
                {t("repoAnalysis.analysisBadge")}
              </Badge>
              <Badge variant="secondary" className="font-mono text-xs">
                {apiRepos.length > 0 ? t("repoAnalysis.apiData") : t("repoAnalysis.staticFallback")}
              </Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-on-surface">
              {t("repoAnalysis.title")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("repoAnalysis.desc")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" asChild>
              <Link to="/explorer">
                <ArrowLeft className="h-4 w-4" />
                {t("repoAnalysis.backToStarRepos")}
              </Link>
            </Button>
            <Button variant="outline" className="gap-2" onClick={refreshAnalysisStatus} disabled={loading || !activeRepo}>
              <LineChart className="h-4 w-4" />
              {t("repoAnalysis.reAnalyze")}
            </Button>
            <Button className="gap-2" asChild disabled={loading || !activeRepo}>
              <a href={`https://github.com/${activeRepo?.fullName}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                {t("repoAnalysis.openGithub")}
              </a>
            </Button>
          </div>
        </section>

        {!loading && !activeRepo && (
          <Card className="border-outline-variant/60 bg-surface-container-low">
            <CardContent className="p-10 text-center">
              <PackageCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h2 className="text-base font-semibold text-on-surface">{t("repoAnalysis.noRepoTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("repoAnalysis.noRepoDesc")}</p>
              <Button variant="outline" className="mt-4 gap-2" asChild>
                <Link to="/developers">
                  <ArrowLeft className="h-4 w-4" />
                  {t("nav.developers")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {activeRepo && <Card className="border-primary/20 bg-surface-container-low">
          <CardContent className="flex gap-3 p-4 text-sm leading-6 text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <span className="font-medium text-on-surface">{t("repoAnalysis.dataSourceTitle")}：</span>
              {t("repoAnalysis.dataSourceBody")}
            </div>
          </CardContent>
        </Card>}

        {/* 搜索与选择器 */}
        {activeRepo && <Card className="border-outline-variant/60 bg-surface-container-low">
          <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder={t("repoAnalysis.searchPlaceholder")} disabled={loading} />
            </div>
            <div className="w-full lg:w-80">
              <Select value={selectedRepo} onChange={(event) => setSelectedRepo(event.target.value)} disabled={loading}>
                {selectorOptions.map((repo) => (
                  <SelectOption key={repo.fullName} value={repo.fullName}>
                    {repo.fullName}
                  </SelectOption>
                ))}
              </Select>
            </div>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link to={`/repo/${activeRepo.fullName}`}>
                <ExternalLink className="h-4 w-4" />
                {t("repoAnalysis.viewDetail")}
              </Link>
            </Button>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                {t("repoAnalysis.loading")}
              </div>
            )}
          </CardContent>
        </Card>}

        {/* 仓库基本信息 / 标签 / 维护信号 */}
        {activeRepo && <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <PackageCheck className="h-5 w-5 text-primary" />
                {activeRepo.fullName}
              </CardTitle>
              <CardDescription>{activeRepo.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-primary" />
                  <strong className="text-on-surface">{activeRepo.stars}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <GitFork className="h-4 w-4" />
                  <strong className="text-on-surface">{activeRepo.forks}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {activeRepo.updatedAt}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>{activeRepo.language}</Badge>
                <Badge variant="secondary">{activeRepo.license}</Badge>
                <Badge variant="outline">{activeRepo.category}</Badge>
              </div>
              <p className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-3 text-sm text-on-surface-variant">
                {status}
              </p>
            </CardContent>
          </Card>

          {/* 自动标签 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Tags className="h-5 w-5 text-primary" />
                {t("repoAnalysis.autoTags")}
                {allTags.length > 0 && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    ({t("repoAnalysis.globalTagCount", { count: allTags.length })})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {activeRepo.tags.length > 0 ? (
                activeRepo.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="font-mono text-xs uppercase tracking-wider">
                    {tag}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">{t("repoAnalysis.noTags")}</span>
              )}
            </CardContent>
          </Card>

          {/* 维护信号 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                {t("repoAnalysis.maintainSignals")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeRepo.maintainSignals.map((signal) => (
                <div key={signal.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{signal.label}</span>
                  <span className={`font-medium ${toneClass[signal.tone]}`}>{signal.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>}

        {/* README 摘要 / 技术栈 */}
        {activeRepo && <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <BookOpenText className="h-5 w-5 text-primary" />
                {t("repoAnalysis.readmeSummary")}
              </CardTitle>
              <CardDescription>
                {userStats
                  ? t("repoAnalysis.repoStats", { total: userStats.repoCount, active: userStats.activeRepoCount })
                  : t("repoAnalysis.readmeSummaryDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm leading-7 text-on-surface-variant">{activeRepo.summary}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MiniFact icon={FileText} label={t("repoAnalysis.suitableFor")} value={activeRepo.category} />
                <MiniFact icon={Layers3} label={t("repoAnalysis.mainLang")} value={activeRepo.language} />
                <MiniFact icon={CheckCircle2} label={t("repoAnalysis.conclusion")} value={t("repoAnalysis.conclusionValue")} />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Code2 className="h-5 w-5 text-primary" />
                {t("repoAnalysis.techStack")}
              </CardTitle>
              <CardDescription>{t("repoAnalysis.techStackDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeRepo.stack.length > 0 ? (
                activeRepo.stack.map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2">
                    <span className="text-sm font-medium text-on-surface">{item}</span>
                    <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
                      {t("repoAnalysis.identified")}
                    </Badge>
                  </div>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">{t("repoAnalysis.noStack")}</span>
              )}
            </CardContent>
          </Card>
        </section>}

        {/* 活跃度 / 协议风险 */}
        {activeRepo && <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <LineChart className="h-5 w-5 text-primary" />
                {t("repoAnalysis.activityAnalysis")}
              </CardTitle>
              <CardDescription>
                {userStats?.languages && userStats.languages.length > 0
                  ? `${t("repoAnalysis.languageDistTitle")}${t("repoAnalysis.labelSeparator")}${userStats.languages.map((l) => `${l.language}(${l.count})`).join(t("repoAnalysis.listSeparator"))}`
                  : t("repoAnalysis.activityAnalysisDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeRepo.scores.map((score) => (
                <div key={score.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{score.label}</span>
                    <span className="font-mono font-semibold text-on-surface">{score.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-container-high">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${score.value}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ShieldAlert className="h-5 w-5 text-primary" />
                {t("repoAnalysis.licenseRisk")}
              </CardTitle>
              <CardDescription>{t("repoAnalysis.licenseRiskDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {activeRepo.risks.map((risk) => (
                <div key={risk.label} className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-4">
                  <div className="mb-3 flex items-center gap-2">
                    {risk.tone === "safe" ? (
                      <CheckCircle2 className={`h-4 w-4 ${toneClass[risk.tone]}`} />
                    ) : (
                      <AlertTriangle className={`h-4 w-4 ${toneClass[risk.tone]}`} />
                    )}
                    <h3 className="text-sm font-semibold text-on-surface">{risk.label}</h3>
                  </div>
                  <div className={`mb-3 h-1 rounded-full ${barClass[risk.tone]}`} />
                  <p className="text-xs leading-5 text-muted-foreground">{risk.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>}

        {/* 相似项目 */}
        {activeRepo && <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Network className="h-5 w-5 text-primary" />
              {t("repoAnalysis.similarRepos")}
            </CardTitle>
            <CardDescription>{t("repoAnalysis.similarReposDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {activeRepo.similar.length > 0 ? (
              activeRepo.similar.map((repo) => (
                <div key={repo.fullName} className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-on-surface">{repo.fullName}</h3>
                    <Badge variant="outline" className="shrink-0 font-mono text-xs">
                      {repo.stars}
                    </Badge>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">{repo.reason}</p>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-sm text-muted-foreground">{t("repoAnalysis.noSimilar")}</div>
            )}
          </CardContent>
        </Card>}

        {/* 底部提示 */}
        <p className="text-xs text-muted-foreground">{t("repoAnalysis.rawDataHint")}</p>
      </div>
    </div>
  )
}

function MiniFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <div className="text-sm font-semibold text-on-surface">{value}</div>
    </div>
  )
}
