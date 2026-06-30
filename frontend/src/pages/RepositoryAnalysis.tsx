/**
 * RepositoryAnalysis.tsx
 * 单个仓库页静态 Demo，用模拟数据展示 README 摘要、技术栈、活跃度、协议风险和相似项目。
 */
import { useMemo, useState } from "react"
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

const repoAnalyses: RepoAnalysis[] = [
  {
    fullName: "microsoft/markitdown",
    description: "Python tool for converting files and office documents to Markdown.",
    language: "Python",
    stars: "40.2k",
    forks: "1.8k",
    updatedAt: "2026-06-28",
    license: "MIT",
    category: "文档处理 / RAG 前置",
    summary:
      "适合作为文档解析流水线入口，把 Office、PDF、网页等内容转换为 Markdown，方便进入知识库、RAG 或自动化审阅流程。",
    stack: ["Python", "Markdown", "Office Parser", "PDF", "CLI"],
    tags: ["rag", "document-ai", "markdown", "automation"],
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
    description: "Reference implementations and community servers for Model Context Protocol.",
    language: "TypeScript",
    stars: "18.7k",
    forks: "2.3k",
    updatedAt: "2026-06-29",
    license: "MIT",
    category: "Agent / MCP 生态",
    summary:
      "用于理解 MCP Server 的能力边界、工具暴露方式和集成模式，适合做本地 Agent 工具生态调研。",
    stack: ["TypeScript", "Node.js", "MCP", "JSON-RPC", "CLI"],
    tags: ["mcp", "agent", "tool-use", "developer-tools"],
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
    description: "An extremely fast Python package and project manager, written in Rust.",
    language: "Rust",
    stars: "58.1k",
    forks: "1.6k",
    updatedAt: "2026-06-30",
    license: "MIT / Apache-2.0",
    category: "工具链 / Python 基建",
    summary:
      "可替代多段 Python 依赖管理流程，适合本地工具、CI 和数据处理项目降低环境初始化成本。",
    stack: ["Rust", "Python", "Package Manager", "Virtualenv", "CLI"],
    tags: ["python", "cli", "packaging", "developer-tools"],
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

export default function RepositoryAnalysis() {
  const [selectedRepo, setSelectedRepo] = useState(repoAnalyses[0].fullName)
  const [status, setStatus] = useState("本页仍为静态 Demo，分析结果来自内置样例。")

  const activeRepo = useMemo(
    () => repoAnalyses.find((repo) => repo.fullName === selectedRepo) ?? repoAnalyses[0],
    [selectedRepo]
  )

  const runMockAnalysis = () => {
    setStatus(`已重新生成 ${activeRepo.fullName} 的模拟分析卡片。`)
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-grid-pattern">
      <div className="space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs uppercase tracking-wider">
                Repository Intelligence
              </Badge>
              <Badge variant="secondary" className="font-mono text-xs">
                Demo Only
              </Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-on-surface">
              单个仓库
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              面向单个 Star 项目的静态分析工作台，补齐 README 摘要、技术栈解析、维护信号、协议风险、学习价值和相似项目推荐。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={runMockAnalysis}>
              <LineChart className="h-4 w-4" />
              重新分析
            </Button>
            <Button className="gap-2">
              <ExternalLink className="h-4 w-4" />
              打开 GitHub
            </Button>
          </div>
        </section>

        <Card className="border-outline-variant/60 bg-surface-container-low">
          <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="搜索或选择一个仓库进行模拟分析" />
            </div>
            <div className="w-full lg:w-80">
              <Select value={selectedRepo} onChange={(event) => setSelectedRepo(event.target.value)}>
                {repoAnalyses.map((repo) => (
                  <SelectOption key={repo.fullName} value={repo.fullName}>
                    {repo.fullName}
                  </SelectOption>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Tags className="h-5 w-5 text-primary" />
                自动标签
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {activeRepo.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="font-mono text-xs uppercase tracking-wider">
                  {tag}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                维护信号
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

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <BookOpenText className="h-5 w-5 text-primary" />
                README 摘要
              </CardTitle>
              <CardDescription>模拟 README 与描述字段生成的项目理解卡片</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm leading-7 text-on-surface-variant">{activeRepo.summary}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MiniFact icon={FileText} label="适合场景" value={activeRepo.category} />
                <MiniFact icon={Layers3} label="主语言" value={activeRepo.language} />
                <MiniFact icon={CheckCircle2} label="Demo 结论" value="值得继续追踪" />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Code2 className="h-5 w-5 text-primary" />
                技术栈解析
              </CardTitle>
              <CardDescription>用于后续学习路线和复用建议的基础维度</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeRepo.stack.map((item) => (
                <div key={item} className="flex items-center justify-between rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2">
                  <span className="text-sm font-medium text-on-surface">{item}</span>
                  <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
                    detected
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <LineChart className="h-5 w-5 text-primary" />
                活跃度分析
              </CardTitle>
              <CardDescription>静态评分用于呈现未来分析结果的版式</CardDescription>
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
                协议风险
              </CardTitle>
              <CardDescription>只做工程提醒，不作为法律意见</CardDescription>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Network className="h-5 w-5 text-primary" />
              相似项目
            </CardTitle>
            <CardDescription>用于后续横向比较、替代方案和学习路径生成</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {activeRepo.similar.map((repo) => (
              <div key={repo.fullName} className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-on-surface">{repo.fullName}</h3>
                  <Badge variant="outline" className="shrink-0 font-mono text-xs">
                    {repo.stars}
                  </Badge>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">{repo.reason}</p>
              </div>
            ))}
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
