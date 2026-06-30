/**
 * StarExplorer.tsx
 * 星标仓库页面，用静态 Demo 展示指定开发者的 Star 仓库列表、筛选排序和聚合分析。
 */
import { useMemo, useState } from "react"
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

const developerProfile = {
  login: "patdelphi",
  totalStars: 691,
  syncedAt: "2026-06-30 22:40",
  demoMode: "Demo 数据：691 条 GitHub starred repositories",
}

const sampleRepos: StarRepo[] = [
  {
    fullName: "microsoft/markitdown",
    description: "Python tool for converting files and office documents to Markdown.",
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
    description: "Reference implementations and community servers for Model Context Protocol.",
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
    description: "An extremely fast Python package and project manager, written in Rust.",
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
    description: "Build resilient language agents as graphs.",
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
    description: "Vim-fork focused on extensibility and usability.",
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
    description: "Convert any URL to an LLM-friendly input.",
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
    description: "A once-popular admin template with limited recent maintenance.",
    stars: "6.2k",
    forks: "1.1k",
    language: "JavaScript",
    langColor: "bg-domain-frontend",
    license: "GPL-3.0",
    starredAt: "2024-01-22",
    updatedAt: "2024-08-03",
    topics: ["admin", "template", "dashboard"],
    autoTags: ["Dead Stars", "前端模板", "协议关注"],
    category: "前端模板",
    score: 41,
    health: "stale",
    whyStarred: "历史上可能用于后台界面参考，但维护和协议风险都需要重新评估。",
    learningValue: ["后台布局", "旧技术债识别"],
    reuseAdvice: "只作为视觉参考，不建议直接复用代码。",
  },
]

const activeFilters = [
  { key: "lang", label: "Python" },
  { key: "topic", label: "agent" },
  { key: "tag", label: "RAG 前置" },
]

const languageStats = [
  { label: "Python", count: 254, color: "bg-domain-backend" },
  { label: "TypeScript", count: 125, color: "bg-domain-frontend" },
  { label: "JavaScript", count: 45, color: "bg-domain-frontend" },
  { label: "Rust", count: 21, color: "bg-domain-tools" },
]

const topicClusters = [
  { label: "AI / LLM", count: 143, topics: ["ai", "llm", "openai", "chatgpt"] },
  { label: "Agent / MCP", count: 61, topics: ["mcp", "agent", "claude-code"] },
  { label: "RAG / 文档", count: 40, topics: ["rag", "pdf", "markdown"] },
  { label: "CLI / 工具链", count: 55, topics: ["cli", "python", "windows"] },
]

const classificationSources = [
  { label: "GitHub topics", count: 512, confidence: "0.95", detail: "强匹配，作为自动标签主来源" },
  { label: "repo name", count: 96, confidence: "0.85", detail: "用于识别 mcp、rag、cli 等显式关键词" },
  { label: "description", count: 71, confidence: "0.80", detail: "补足 topics 缺失的项目语义" },
  { label: "manual", count: 12, confidence: "1.00", detail: "保留给用户后续确认的标签" },
]

const starTimeline = [
  { period: "2026 Q2", count: 173, focus: "MCP、Agent、文档 AI" },
  { period: "2026 Q1", count: 148, focus: "RAG、OpenAI-compatible、CLI" },
  { period: "2025 Q4", count: 126, focus: "Python 工具链、Windows 自动化" },
  { period: "2025 Q3", count: 94, focus: "前端框架、Dashboard、编辑器" },
]

const licenseStats = [
  { label: "MIT", count: 286, tone: "text-status-safe" },
  { label: "Apache-2.0", count: 142, tone: "text-status-safe" },
  { label: "GPL 系", count: 31, tone: "text-status-warning" },
  { label: "未知", count: 58, tone: "text-status-danger" },
]

const exportFormats = [
  { label: "CSV", detail: "表格分析", status: "当前筛选" },
  { label: "JSON", detail: "二次处理", status: "当前筛选" },
  { label: "Markdown", detail: "Obsidian / README", status: "当前筛选" },
  { label: "HTML", detail: "静态分享", status: "后续报告" },
]

const removedStarSignals = [
  { label: "疑似取消 Star", count: 18, detail: "本次同步未返回，但不直接删除" },
  { label: "长期未更新", count: 34, detail: "超过 12 个月未更新" },
  { label: "协议需复核", count: 31, detail: "GPL 或未知协议" },
]

const ITEMS_PER_PAGE = 5

const healthMeta: Record<RepoHealth, { label: string; className: string }> = {
  active: { label: "活跃", className: "text-status-safe" },
  watch: { label: "观察", className: "text-status-warning" },
  stale: { label: "低活跃", className: "text-status-danger" },
}

export default function StarExplorer() {
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [analysisStatus, setAnalysisStatus] = useState("已加载指定开发者 @patdelphi 的 Star 仓库 Demo 分析。")

  const filteredRepos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return sampleRepos
    return sampleRepos.filter((repo) =>
      [repo.fullName, repo.description, repo.language, repo.category, ...repo.topics, ...repo.autoTags]
        .join(" ")
        .toLowerCase()
        .includes(query)
    )
  }, [searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredRepos.length / ITEMS_PER_PAGE))
  const paginatedRepos = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredRepos.slice(start, start + ITEMS_PER_PAGE)
  }, [currentPage, filteredRepos])

  const handleExport = (format: string) => {
    setAnalysisStatus(`已模拟导出当前筛选结果为 ${format}，真实导出后续接本地 Exporter。`)
  }

  const handleBatchAnalyze = () => {
    setAnalysisStatus("已模拟更新星标仓库分析：规则分类、Hidden Gems、Dead Stars、协议风险均已刷新。")
  }

  const handleRemoveFilter = (filterKey: string) => {
    setAnalysisStatus(`已模拟移除筛选条件：${filterKey}。`)
  }

  const openRepoAnalysis = (fullName: string) => {
    setAnalysisStatus(`已选择 ${fullName}，请进入“单个仓库”页查看深度分析。`)
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-grid-pattern">
      <div className="space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs uppercase tracking-wider">
                指定开发者
              </Badge>
              <Badge className="font-mono text-xs">@{developerProfile.login}</Badge>
              <Badge variant="secondary" className="font-mono text-xs">
                {developerProfile.demoMode}
              </Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-on-surface">星标仓库</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              开发者 Star 全局分析：围绕指定开发者的全部 starred repositories 做组合画像、筛选排序、规则分类和风险识别。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={handleBatchAnalyze}>
              <Sparkles className="h-4 w-4" />
              更新星标仓库分析
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Star} label="Star 仓库概览" value={developerProfile.totalStars.toString()} detail="本地 Demo 数据总量" />
          <MetricCard icon={Activity} label="最近同步" value={developerProfile.syncedAt} detail="增量同步后更新统计" />
          <MetricCard icon={Tags} label="自动标签覆盖" value="83%" detail="topics / name / description 规则命中" />
          <MetricCard icon={Flame} label="Hidden Gems" value="27" detail="低 Star 高价值候选" />
          <MetricCard icon={AlertTriangle} label="Dead Stars" value="34" detail="长期未更新或协议需关注" />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <Card className="xl:col-span-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Radar className="h-5 w-5 text-primary" />
                语言分布
              </CardTitle>
              <CardDescription>用于判断开发者长期技术关注方向</CardDescription>
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
                主题聚类
              </CardTitle>
              <CardDescription>把 Star 仓库从散列表整理成兴趣地图</CardDescription>
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

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <Card className="xl:col-span-7">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Tags className="h-5 w-5 text-primary" />
                规则分类覆盖
              </CardTitle>
              <CardDescription>对应设计文档中的 topics、repo name、description 分类策略</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {classificationSources.map((source) => (
                <div key={source.label} className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-on-surface">{source.label}</span>
                    <Badge variant="secondary" className="font-mono text-xs">{source.count}</Badge>
                  </div>
                  <div className="mb-2 text-xs text-muted-foreground">confidence {source.confidence}</div>
                  <p className="text-xs leading-5 text-muted-foreground">{source.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="xl:col-span-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Clock className="h-5 w-5 text-primary" />
                兴趣时间线
              </CardTitle>
              <CardDescription>按 starred_at 聚合开发者关注变化</CardDescription>
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

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <Card className="xl:col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <AlertTriangle className="h-5 w-5 text-primary" />
                License 分布
              </CardTitle>
              <CardDescription>只做工程提醒，不作为法律意见</CardDescription>
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
                导出一致性
              </CardTitle>
              <CardDescription>导出内容应与当前筛选结果一致</CardDescription>
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
                Removed Stars
              </CardTitle>
              <CardDescription>增量同步不直接删除已取消 Star 的记录</CardDescription>
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

        <section className="flex flex-col gap-3 border-t border-outline-variant/50 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-on-surface">全部星标仓库列表</h2>
            <p className="mt-1 text-sm text-muted-foreground">浏览、筛选和排序当前开发者的全部 Star 仓库。</p>
          </div>
          <Button className="gap-2" onClick={() => handleExport("Markdown")}>
            <Download className="h-4 w-4" />
            导出报告
          </Button>
        </section>

        <Card className="glass-panel">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-3 xl:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索仓库、描述、topic 或自动标签..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value)
                    setCurrentPage(1)
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[620px]">
                <Select defaultValue="">
                  <SelectOption value="">语言</SelectOption>
                  <SelectOption value="python">Python</SelectOption>
                  <SelectOption value="typescript">TypeScript</SelectOption>
                  <SelectOption value="rust">Rust</SelectOption>
                </Select>
                <Select defaultValue="">
                  <SelectOption value="">主题</SelectOption>
                  <SelectOption value="ai">AI</SelectOption>
                  <SelectOption value="mcp">MCP</SelectOption>
                  <SelectOption value="rag">RAG</SelectOption>
                </Select>
                <Select defaultValue="">
                  <SelectOption value="">协议</SelectOption>
                  <SelectOption value="mit">MIT</SelectOption>
                  <SelectOption value="apache">Apache-2.0</SelectOption>
                  <SelectOption value="gpl">GPL-3.0</SelectOption>
                </Select>
                <Select defaultValue="starred_at">
                  <SelectOption value="starred_at">排序：starred_at</SelectOption>
                  <SelectOption value="stars">排序：stars</SelectOption>
                  <SelectOption value="forks">排序：forks</SelectOption>
                  <SelectOption value="updated_at">排序：updated_at</SelectOption>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">已筛选:</span>
              {activeFilters.map((filter) => (
                <Badge key={filter.key} variant="secondary" className="flex items-center gap-1 font-mono text-xs">
                  {filter.label}
                  <button onClick={() => handleRemoveFilter(filter.key)} className="ml-1 rounded-full hover:bg-surface-container-high">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs text-muted-foreground" onClick={() => handleRemoveFilter("all")}>
                <Filter className="h-3 w-3" />
                清除全部
              </Button>
              <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs text-muted-foreground">
                <ArrowDownUp className="h-3 w-3" />
                排序
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">仓库</TableHead>
                  <TableHead className="hidden md:table-cell">分类 / 摘要</TableHead>
                  <TableHead className="text-right">分数</TableHead>
                  <TableHead className="hidden sm:table-cell">语言</TableHead>
                  <TableHead className="hidden lg:table-cell">协议</TableHead>
                  <TableHead className="hidden xl:table-cell">最近更新</TableHead>
                  <TableHead className="hidden xl:table-cell">自动标签</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRepos.map((repo) => (
                  <TableRow
                    key={repo.fullName}
                    className="transition-colors hover:bg-surface-container"
                  >
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-on-surface">{repo.fullName}</span>
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
                        查看单个仓库
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">{analysisStatus}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              第 <span className="font-mono text-on-surface">{currentPage}</span> / {totalPages} 页
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
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

