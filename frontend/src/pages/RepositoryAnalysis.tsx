/**
 * RepositoryAnalysis.tsx
 * 单个仓库分析页，已接入真实 API。
 * 通过 getRepos / getStats / getTags 获取数据；API 不可用时自动回退到内置 Demo 数据。
 */
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import {
  Activity,
  AlertTriangle,
  BookOpenText,
  CheckCircle2,
  Clock,
  Code2,
  ExternalLink,
  FileText,
  GitFork,
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

/* ========== 常量 ========== */
const DEFAULT_LOGIN = "demo-user"

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

/* ========== Demo 数据（API 不可用时回退） ========== */
const repoAnalyses: RepoAnalysis[] = [
  {
    fullName: "microsoft/markitdown",
    description: "用于把文件和办公文档转换为 Markdown 的 Python 工具。",
    language: "Python",
    stars: "40.2k",
    forks: "1.8k",
    updatedAt: "2026-06-28",
    license: "MIT",
    category: "文档处理 / RAG 前置",
    summary:
      "适合作为文档解析流水线入口，把 Office、PDF、网页等内容转换为 Markdown，方便进入知识库、RAG 或自动化审阅流程。",
    stack: ["Python 生态", "Markdown 转换", "Office 解析", "PDF 解析", "命令行工具"],
    tags: ["RAG 前置", "文档智能", "Markdown 转换", "自动化"],
    maintainSignals: [
      { label: "最近更新", value: "2 天前", tone: "safe" },
      { label: "Issue 压力", value: "中等", tone: "warning" },
      { label: "社区热度", value: "高速增长", tone: "safe" },
      { label: "API 稳定性", value: "仍在演进", tone: "warning" },
    ],
    scores: [
      { label: "学习价值", value: 92 },
      { label: "复用价值", value: 88 },
      { label: "维护活跃", value: 84 },
      { label: "集成难度", value: 36 },
    ],
    risks: [
      { label: "协议风险", detail: "MIT，工程使用风险低。", tone: "safe" },
      { label: "依赖风险", detail: "文件格式解析依赖多，需关注边界样本。", tone: "warning" },
      { label: "落地风险", detail: "复杂版式文档可能需要人工校验。", tone: "warning" },
    ],
    similar: [
      { fullName: "pandoc/pandoc", reason: "通用文档转换能力更强", stars: "35.6k" },
      { fullName: "Unstructured-IO/unstructured", reason: "面向 RAG 的文档解析链路", stars: "11.4k" },
      { fullName: "mozilla/pdf.js", reason: "PDF 解析和预览基础能力", stars: "48.1k" },
    ],
  },
  {
    fullName: "modelcontextprotocol/servers",
    description: "Model Context Protocol 的参考实现和社区服务器集合。",
    language: "TypeScript",
    stars: "18.7k",
    forks: "2.3k",
    updatedAt: "2026-06-29",
    license: "MIT",
    category: "Agent / MCP 生态",
    summary:
      "用于理解 MCP Server 的能力边界、工具暴露方式和集成模式，适合做本地 Agent 工具生态调研。",
    stack: ["TypeScript 生态", "Node.js 服务", "MCP 协议", "JSON-RPC 通信", "命令行工具"],
    tags: ["MCP", "智能体", "工具调用", "开发者工具"],
    maintainSignals: [
      { label: "最近更新", value: "1 天前", tone: "safe" },
      { label: "Issue 压力", value: "偏高", tone: "warning" },
      { label: "社区热度", value: "爆发期", tone: "safe" },
      { label: "接口稳定性", value: "快速变化", tone: "warning" },
    ],
    scores: [
      { label: "学习价值", value: 95 },
      { label: "复用价值", value: 82 },
      { label: "维护活跃", value: 91 },
      { label: "集成难度", value: 58 },
    ],
    risks: [
      { label: "协议风险", detail: "MIT，适合二次开发。", tone: "safe" },
      { label: "生态风险", detail: "规范更新快，升级成本需要预留。", tone: "warning" },
      { label: "安全风险", detail: "工具调用需最小权限和明确确认。", tone: "danger" },
    ],
    similar: [
      { fullName: "anthropics/anthropic-sdk-typescript", reason: "Agent 工具调用 SDK 参考", stars: "1.2k" },
      { fullName: "openai/openai-agents-js", reason: "Agent 编排模型参考", stars: "6.8k" },
      { fullName: "langchain-ai/langgraph", reason: "多步骤 Agent 状态流", stars: "15.9k" },
    ],
  },
  {
    fullName: "astral-sh/uv",
    description: "用 Rust 编写的高速 Python 包管理和项目管理工具。",
    language: "Rust",
    stars: "58.1k",
    forks: "1.6k",
    updatedAt: "2026-06-30",
    license: "MIT / Apache-2.0",
    category: "工具链 / Python 基建",
    summary:
      "可替代多段 Python 依赖管理流程，适合本地工具、CI 和数据处理项目降低环境初始化成本。",
    stack: ["Rust 工具", "Python 生态", "包管理", "虚拟环境", "命令行工具"],
    tags: ["Python", "命令行", "包管理", "开发者工具"],
    maintainSignals: [
      { label: "最近更新", value: "今天", tone: "safe" },
      { label: "Issue 压力", value: "高", tone: "warning" },
      { label: "社区热度", value: "高速增长", tone: "safe" },
      { label: "替换成本", value: "中等", tone: "warning" },
    ],
    scores: [
      { label: "学习价值", value: 86 },
      { label: "复用价值", value: 94 },
      { label: "维护活跃", value: 96 },
      { label: "集成难度", value: 42 },
    ],
    risks: [
      { label: "协议风险", detail: "双协议，商业使用友好。", tone: "safe" },
      { label: "迁移风险", detail: "团队既有 pip/poetry 流程需逐步替换。", tone: "warning" },
      { label: "兼容风险", detail: "少数旧项目依赖解析需要单独验证。", tone: "warning" },
    ],
    similar: [
      { fullName: "pypa/pip", reason: "Python 官方生态基础包管理器", stars: "9.8k" },
      { fullName: "python-poetry/poetry", reason: "项目依赖管理对照方案", stars: "32.4k" },
      { fullName: "astral-sh/ruff", reason: "同团队高性能 Python 工具链", stars: "39.5k" },
    ],
  },
]

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
  const [selectedRepo, setSelectedRepo] = useState(repoAnalyses[0].fullName)
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

  /** 为仅有 API 数据、没有 Demo 分析数据的仓库生成默认分析结构 */
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
        { label: t("repoAnalysis.signalIssuePressure"), value: repo.open_issues > 50 ? "偏高" : "中等", tone: repo.open_issues > 50 ? "warning" : "safe" },
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
          detail: repo.license ? `${repo.license}，${t("repoAnalysis.unknown")}。` : t("repoAnalysis.unknown"),
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
    return parts.join("，") + "。"
  }

  /** 初始化：并行加载仓库列表、统计和标签 */
  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setLoading(true)
      try {
        const [reposResult, statsResult, tagsResult] = await Promise.all([
          getRepos(DEFAULT_LOGIN, { pageSize: 100 }),
          getStats(DEFAULT_LOGIN),
          getTags(DEFAULT_LOGIN),
        ])

        if (cancelled) return

        setApiRepos(reposResult.items)
        setUserStats(statsResult)
        setAllTags(tagsResult)

        const storedRepo = localStorage.getItem("selected-star-repo")
        if (storedRepo) {
          const existsInApi = reposResult.items.some((r) => r.full_name === storedRepo)
          const existsInDemo = repoAnalyses.some((r) => r.fullName === storedRepo)
          if (existsInApi || existsInDemo) {
            setSelectedRepo(storedRepo)
            setStatus(t("repoAnalysis.importedFromStarred", { repo: storedRepo }))
          } else {
            setStatus(buildStatusText(reposResult.items.length, tagsResult.length, statsResult))
          }
        } else {
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
  }, [t])

  /** 下拉选择器的数据源：优先 API，回退 Demo */
  const selectorOptions = useMemo(() => {
    if (apiRepos.length > 0) {
      return apiRepos.map((r) => ({ fullName: r.full_name, description: r.description ?? "" }))
    }
    return repoAnalyses.map((r) => ({ fullName: r.fullName, description: r.description }))
  }, [apiRepos])

  /** 当前激活的仓库：API 基本信息与 Demo 分析数据合并 */
  const activeRepo = useMemo<RepoAnalysis>(() => {
    const apiRepo = apiRepos.find((r) => r.full_name === selectedRepo)
    const demoRepo = repoAnalyses.find((r) => r.fullName === selectedRepo)

    // 都未找到，回退第一个 Demo
    if (!apiRepo && !demoRepo) return repoAnalyses[0]

    // API 和 Demo 都有：基本信息用 API，分析字段用 Demo
    if (apiRepo && demoRepo) {
      return {
        ...demoRepo,
        fullName: apiRepo.full_name,
        description: apiRepo.description ?? demoRepo.description,
        language: apiRepo.language ?? demoRepo.language,
        stars: formatStars(apiRepo.stars),
        forks: String(apiRepo.forks),
        updatedAt: formatDate(apiRepo.pushed_at),
        license: apiRepo.license ?? demoRepo.license,
        tags: apiRepo.tags.length > 0 ? apiRepo.tags : demoRepo.tags,
      }
    }

    // 只有 API 数据：构建默认分析
    if (apiRepo) {
      return buildDefaultAnalysis(apiRepo)
    }

    // 只有 Demo 数据
    return demoRepo!
  }, [selectedRepo, apiRepos])

  /** 重新分析按钮 */
  const runMockAnalysis = () => {
    setStatus(t("repoAnalysis.importedFromStarred", { repo: activeRepo.fullName }))
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
              <Badge variant="secondary" className="font-mono text-xs">
                {apiRepos.length > 0 ? "API 数据" : "静态演示"}
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
            <Button variant="outline" className="gap-2" onClick={runMockAnalysis} disabled={loading}>
              <LineChart className="h-4 w-4" />
              {t("repoAnalysis.reAnalyze")}
            </Button>
            <Button className="gap-2" disabled={loading}>
              <ExternalLink className="h-4 w-4" />
              {t("repoAnalysis.openGithub")}
            </Button>
          </div>
        </section>

        {/* 搜索与选择器 */}
        <Card className="border-outline-variant/60 bg-surface-container-low">
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
        </Card>

        {/* 仓库基本信息 / 标签 / 维护信号 */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
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
        </section>

        {/* README 摘要 / 技术栈 */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
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
        </section>

        {/* 活跃度 / 协议风险 */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <LineChart className="h-5 w-5 text-primary" />
                {t("repoAnalysis.activityAnalysis")}
              </CardTitle>
              <CardDescription>
                {userStats?.languages && userStats.languages.length > 0
                  ? `${t("repoAnalysis.languageDistTitle")}：${userStats.languages.map((l) => `${l.language}(${l.count})`).join("、")}`
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
        </section>

        {/* 相似项目 */}
        <Card>
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
        </Card>
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
