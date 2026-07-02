/**
 * RepoDetail.tsx
 * 仓库详情页
 * 展示单个仓库的详细信息、AI 智能分析、协议健康度和相关推荐
 * 通过路由参数获取 owner/name，调用真实 API 获取数据，API 不可用时回退到静态 Demo 数据
 */

import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useParams, Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Star,
  GitFork,
  Clock,
  ExternalLink,
  Copy,
  Cpu,
  School,
  Puzzle,
  Gavel,
  ShieldCheck,
  Network,
  Sparkles,
} from "lucide-react"
import { getRepo, getReadmeSummary, type Repo } from "@/lib/api"
import { useDeveloper } from "@/contexts/DeveloperContext"

// ===== 类型定义 =====

/** API 返回的仓库详情（包含 Repo 字段及 starred_at、tags） */
type RepoDetailData = Repo & {
  starred_at: string
  tags: string[]
}

/** 格式化数字：大于 1000 时显示为 k */
function formatCount(num: number): string {
  if (num >= 10000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return String(num)
}

const RepoDetail: React.FC = () => {
  const { t } = useTranslation()
  const { currentLogin } = useDeveloper()

  // 从路由参数中获取仓库 owner 和 name
  const { owner, name } = useParams<{ owner: string; name: string }>()

  // 数据获取状态
  const [repoData, setRepoData] = useState<RepoDetailData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [readmeSummary, setReadmeSummary] = useState<string | null>(null)

  /** 格式化时间差：显示为 "X 天前" */
  const formatTimeAgo = (dateStr: string | null): string => {
    if (!dateStr) return t("repoDetail.unknownTime")
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays <= 0) return t("repoDetail.today")
    if (diffDays === 1) return t("repoDetail.yesterday")
    if (diffDays < 30) return t("repoDetail.daysAgo", { count: diffDays })
    if (diffDays < 365) return t("repoDetail.monthsAgo", { count: Math.floor(diffDays / 30) })
    return t("repoDetail.yearsAgo", { count: Math.floor(diffDays / 365) })
  }

  /** 复制克隆地址到剪贴板 */
  const handleCopyClone = () => {
    const cloneUrl = repoData
      ? `git clone ${repoData.html_url}.git`
      : `git clone https://github.com/${owner}/${name}.git`
    navigator.clipboard.writeText(cloneUrl)
      .then(() => {
        // eslint-disable-next-line no-console
        console.log(t("repoDetail.cloneCopied"))
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("COPY_CLONE_FAILED", err)
      })
  }

  /** 在 useEffect 中调用 API 获取仓库详情 */
  useEffect(() => {
    let cancelled = false

    async function fetchRepo() {
      // 参数校验：owner 和 name 必须存在
      if (!owner || !name) {
        setError(t("repoDetail.missingParams"))
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const data = await getRepo(currentLogin, `${owner}/${name}`)
        if (cancelled) return

        if (data) {
          setRepoData(data)
          // 加载 README 中文摘要
          getReadmeSummary(`${owner}/${name}`).then((result) => {
            if (result?.summary) setReadmeSummary(result.summary)
          }).catch(() => { /* 忽略 */ })
        } else {
          // API 返回 null（不可用或无数据），回退到 Demo 数据并标记提示
          setError(t("repoDetail.apiUnavailable"))
        }
      } catch (err) {
        if (cancelled) return
        setError(t("repoDetail.fetchError"))
        // eslint-disable-next-line no-console
        console.error("FETCH_REPO_DETAIL_FAILED", err)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchRepo()

    // 清理函数：避免组件卸载后更新状态
    return () => {
      cancelled = true
    }
  }, [owner, name, t, currentLogin])

  // 决定实际展示的数据（API 数据优先，否则用 Demo 数据）
  const displayRepo = repoData

  // 头部展示字段
  const displayFullName = displayRepo?.full_name ?? (owner && name ? `${owner}/${name}` : "")
  const displayDescription = displayRepo?.description ?? ""
  const displayStars = displayRepo?.stars ?? 0
  const displayForks = displayRepo?.forks ?? 0
  const displayPushedAt = displayRepo?.pushed_at ?? null
  const displayHtmlUrl = displayRepo?.html_url ?? `https://github.com/${owner}/${name}`
  const displayLanguage = displayRepo?.language ?? ""
  const displayLicense = displayRepo?.license ?? ""
  const displayTags = displayRepo?.tags ?? [displayLanguage].filter(Boolean)

  const learningValues = Array.from(new Set([displayLanguage, ...displayTags].filter(Boolean))).slice(0, 3)

  // AI 分析为基于当前仓库真实字段的本地规则文案，随语言切换展示。
  const aiAnalysis = {
    reasonText: t("repoDetail.aiReasonText", {
      name: displayFullName || t("repoDetail.unknownRepo"),
      language: displayLanguage || t("repoDetail.unknown"),
      license: displayLicense || t("repoDetail.unknown"),
    }),
    learningValues: learningValues.length > 0 ? learningValues : [t("repoDetail.repositoryMetadata")],
    reuseAdvice: t("repoDetail.aiReuseAdvice", {
      name: displayFullName || t("repoDetail.unknownRepo"),
      license: displayLicense || t("repoDetail.unknown"),
    }),
  }

  /** 默认系统雷达数据（柱状图），标签走 i18n。 */
  const systemRadar = [
    { label: t("repoDetail.radarActivity"), value: 85, color: "bg-primary" },
    { label: t("repoDetail.radarCommunity"), value: 72, color: "bg-domain-frontend" },
    { label: t("repoDetail.radarDocs"), value: 90, color: "bg-domain-backend" },
    { label: t("repoDetail.radarStability"), value: 78, color: "bg-domain-ai" },
  ]

  // 协议健康度：根据 API 返回的 license 动态展示
  const licenseHealth = displayRepo?.license
    ? {
        license: displayLicense,
        riskLevel: t("repoDetail.riskLevel"),
        riskColor: "text-status-safe",
      }
    : {
        license: "MIT",
        riskLevel: t("repoDetail.lowRisk"),
        riskColor: "text-status-safe",
      }

  return (
    <div className="min-h-screen bg-grid-pattern p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Loading 状态 */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">{t("repoDetail.loading")}</div>
          </div>
        )}

        {/* Error 提示（API 不可用回退到 Demo） */}
        {error && !loading && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            {error}
          </div>
        )}

        {/* 头部信息 */}
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {displayTags.map((tag) => (
              <Badge key={tag} variant="default" className="font-mono text-xs uppercase tracking-wider">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-on-surface">
              {displayFullName}
            </h1>
            <Badge variant="secondary" className="font-mono text-xs uppercase tracking-wider">
              {t("repoDetail.rawDataBadge")}
            </Badge>
          </div>
          <p className="max-w-3xl text-base text-muted-foreground">
            {displayDescription}
          </p>
          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 text-primary" />
              <span className="font-medium text-on-surface">{formatCount(displayStars)}</span>
              <span>{t("repoDetail.stars")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <GitFork className="h-4 w-4" />
              <span className="font-medium text-on-surface">{formatCount(displayForks)}</span>
              <span>{t("repoDetail.forks")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>{t("repoDetail.updated", { time: formatTimeAgo(displayPushedAt) })}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button className="gap-2" asChild>
              <a href={displayHtmlUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                {t("repoDetail.openGithub")}
              </a>
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleCopyClone}>
              <Copy className="h-4 w-4" />
              {t("repoDetail.copyClone")}
            </Button>
          </div>
        </section>

        {/* README 中文摘要 */}
        {readmeSummary && (
          <Card className="bg-surface-container-low/50 border-primary/20">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{t("repoDetail.readmeSummaryTitle")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-on-surface">{readmeSummary}</p>
            </CardContent>
          </Card>
        )}

        {/* AI 分析 + 右侧信息 双栏 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* AI 智能分析卡片（占 8/12） */}
          <Card className="lg:col-span-8">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">{t("repoDetail.aiAnalysis")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 星标原因 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                  <Star className="h-4 w-4 text-primary" />
                  <span>{t("repoDetail.whyStarred")}</span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {aiAnalysis.reasonText}
                </p>
              </div>

              {/* 学习价值标签 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                  <School className="h-4 w-4 text-domain-frontend" />
                  <span>{t("repoDetail.learningValues")}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {aiAnalysis.learningValues.map((tag) => (
                    <Badge key={tag} variant="default" className="font-mono text-xs uppercase tracking-wider">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* 复用建议 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                  <Puzzle className="h-4 w-4 text-domain-backend" />
                  <span>{t("repoDetail.reuseAdvice")}</span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {aiAnalysis.reuseAdvice}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 右侧信息栏（占 4/12） */}
          <div className="space-y-6 lg:col-span-4">
            {/* 协议健康度卡片 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Gavel className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{t("repoDetail.licenseHealth")}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-status-safe" />
                    <span className="font-medium text-on-surface">{t("repoDetail.licenseType", { license: licenseHealth.license })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${licenseHealth.riskColor}`}>
                    {licenseHealth.riskLevel}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("repoDetail.licenseFreeDesc")}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 系统雷达柱状图 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{t("repoDetail.systemRadar")}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {systemRadar.map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-mono font-medium text-on-surface">{item.value}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-surface-container-high">
                      <div
                        className={`h-2 rounded-full ${item.color}`}
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 跳转到分析页 */}
        <div className="flex justify-end pt-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/analysis">{t("repoDetail.viewAnalysis")}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default RepoDetail
