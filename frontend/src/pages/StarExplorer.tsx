/**
 * StarExplorer.tsx
 * 星系探索页面
 * 展示当前选中开发者的星项目列表，支持搜索筛选、导出、分页
 * 选中星项目后在下方展开 RepoDetail 详情面板
 */
import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
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
} from "lucide-react"

// ===== 星项目列表数据 =====
const sampleRepos = [
  { fullName: "vercel/next.js", description: "The React Framework for the Web", stars: "127.5k", forks: "27.1k", language: "TypeScript", langColor: "bg-domain-frontend", aiTags: ["web-framework", "react"], updatedAt: "2026-06-28" },
  { fullName: "hwchase17/langchain", description: "Building applications with LLMs through composability", stars: "95.3k", forks: "15.2k", language: "Python", langColor: "bg-domain-backend", aiTags: ["ai", "llm", "framework"], updatedAt: "2026-06-29" },
  { fullName: "neovim/neovim", description: "Vim-fork focused on extensibility and usability", stars: "82.1k", forks: "5.6k", language: "C", langColor: "bg-domain-tools", aiTags: ["editor", "cli-tools"], updatedAt: "2026-06-30" },
  { fullName: "facebook/react", description: "A declarative, efficient, and flexible JavaScript library", stars: "228k", forks: "46.8k", language: "JavaScript", langColor: "bg-domain-frontend", aiTags: ["ui", "web"], updatedAt: "2026-06-27" },
  { fullName: "microsoft/vscode", description: "Visual Studio Code", stars: "162k", forks: "29.1k", language: "TypeScript", langColor: "bg-domain-frontend", aiTags: ["editor", "ide"], updatedAt: "2026-06-30" },
  { fullName: "torvalds/linux", description: "Linux kernel source tree", stars: "180k", forks: "53.2k", language: "C", langColor: "bg-domain-tools", aiTags: ["kernel", "os"], updatedAt: "2026-06-26" },
  { fullName: "golang/go", description: "The Go programming language", stars: "125k", forks: "17.8k", language: "Go", langColor: "bg-domain-backend", aiTags: ["language", "compiler"], updatedAt: "2026-06-29" },
  { fullName: "rust-lang/rust", description: "Empowering everyone to build reliable software", stars: "98k", forks: "12.5k", language: "Rust", langColor: "bg-domain-tools", aiTags: ["language", "systems"], updatedAt: "2026-06-28" },
  { fullName: "tensorflow/tensorflow", description: "An Open Source Machine Learning Framework", stars: "185k", forks: "74.2k", language: "Python", langColor: "bg-domain-ai", aiTags: ["ml", "deep-learning"], updatedAt: "2026-06-25" },
  { fullName: "kubernetes/kubernetes", description: "Production-Grade Container Orchestration", stars: "111k", forks: "39.5k", language: "Go", langColor: "bg-domain-backend", aiTags: ["containers", "devops"], updatedAt: "2026-06-30" },
  { fullName: "nodejs/node", description: "Node.js JavaScript runtime", stars: "107k", forks: "29.3k", language: "JavaScript", langColor: "bg-domain-backend", aiTags: ["runtime", "server"], updatedAt: "2026-06-29" },
  { fullName: "apache/spark", description: "Apache Spark - A unified analytics engine", stars: "40k", forks: "28.1k", language: "Scala", langColor: "bg-domain-backend", aiTags: ["big-data", "analytics"], updatedAt: "2026-06-24" },
]

const activeFilters = [
  { key: "lang", label: "TypeScript", value: "typescript" },
  { key: "topic", label: "AI", value: "ai" },
]

const ITEMS_PER_PAGE = 10

// AI 分析数据（详情面板用）
const aiAnalysis = {
  reason: "你为何星标该项目",
  reasonText: "该项目提供了将各类文档（PDF、Word、PPT 等）转换为 Markdown 的简洁方案，与你关注的文档处理与 AI 工具链方向高度契合。",
  learningValues: ["文档解析", "Markdown 生成", "Python 工具链"],
  reuseAdvice: "可直接集成到文档处理流水线中，或作为 RAG 系统的前置解析模块复用。",
}

const licenseHealth = {
  license: "MIT",
  riskLevel: "低风险",
  riskColor: "text-status-safe",
}

const systemRadar = [
  { label: "活跃度", value: 85, color: "bg-primary" },
  { label: "社区", value: 72, color: "bg-domain-frontend" },
  { label: "文档", value: 90, color: "bg-domain-backend" },
  { label: "稳定性", value: 78, color: "bg-domain-ai" },
]

const relatedRepos = [
  { fullName: "JupyterLab/jupyterlab", description: "JupyterLab computational environment", stars: "14.2k", forks: "2.8k", language: "TypeScript", langColor: "bg-domain-frontend" },
  { fullName: "pandoc/pandoc", description: "Universal markup converter", stars: "35.6k", forks: "3.2k", language: "Haskell", langColor: "bg-domain-tools" },
  { fullName: "mozilla/pdf.js", description: "PDF Reader in JavaScript", stars: "48.1k", forks: "9.5k", language: "JavaScript", langColor: "bg-domain-frontend" },
]

export default function StarExplorer() {
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null)
  const totalPages = Math.ceil(sampleRepos.length / ITEMS_PER_PAGE)

  const paginatedRepos = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return sampleRepos.slice(start, start + ITEMS_PER_PAGE)
  }, [currentPage])

  const activeRepo = sampleRepos.find((r) => r.fullName === selectedRepo)

  const handleExport = (format: string) => {
    // eslint-disable-next-line no-console
    console.log(`导出格式: ${format}`)
  }

  const handleRemoveFilter = (filterKey: string) => {
    // eslint-disable-next-line no-console
    console.log(`移除筛选: ${filterKey}`)
  }

  const handleCopyClone = () => {
    if (!activeRepo) return
    navigator.clipboard.writeText(`git clone https://github.com/${activeRepo.fullName}.git`)
      .catch(() => {})
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-grid-pattern">
      <div className="space-y-6">
        {/* 页面标题与导出 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-on-surface">
              星系探索
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              正在浏览 <span className="font-medium text-primary">{sampleRepos.length}</span> 个同步的星项目
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport("CSV")}>CSV</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("JSON")}>JSON</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("MD")}>MD</Button>
          </div>
        </div>

        {/* 高级筛选栏 */}
        <Card className="glass-panel">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="搜索仓库、描述或标签..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="w-32">
                    <Select defaultValue="">
                      <SelectOption value="">语言</SelectOption>
                      <SelectOption value="typescript">TypeScript</SelectOption>
                      <SelectOption value="python">Python</SelectOption>
                      <SelectOption value="rust">Rust</SelectOption>
                      <SelectOption value="go">Go</SelectOption>
                    </Select>
                  </div>
                  <div className="w-32">
                    <Select defaultValue="">
                      <SelectOption value="">主题</SelectOption>
                      <SelectOption value="ai">AI</SelectOption>
                      <SelectOption value="web">Web</SelectOption>
                      <SelectOption value="cli">CLI</SelectOption>
                      <SelectOption value="data">Data</SelectOption>
                    </Select>
                  </div>
                  <div className="w-32">
                    <Select defaultValue="">
                      <SelectOption value="">协议</SelectOption>
                      <SelectOption value="mit">MIT</SelectOption>
                      <SelectOption value="apache">Apache</SelectOption>
                      <SelectOption value="gpl">GPL</SelectOption>
                    </Select>
                  </div>
                  <Button variant="outline" size="icon" className="shrink-0">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {activeFilters.length > 0 && (
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
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-on-surface" onClick={() => handleRemoveFilter("all")}>
                    清除全部
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 数据表格 */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">仓库</TableHead>
                  <TableHead className="hidden md:table-cell">简介</TableHead>
                  <TableHead className="text-right">星数</TableHead>
                  <TableHead className="hidden sm:table-cell">语言</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">更新时间</TableHead>
                  <TableHead className="hidden lg:table-cell">AI 标签</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRepos.map((repo) => (
                  <TableRow
                    key={repo.fullName}
                    className={`cursor-pointer transition-colors ${
                      selectedRepo === repo.fullName
                        ? "bg-surface-container-high"
                        : "hover:bg-surface-container"
                    }`}
                    onClick={() => setSelectedRepo(repo.fullName)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {selectedRepo === repo.fullName && (
                          <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        )}
                        <span className={`font-medium ${selectedRepo === repo.fullName ? "text-primary" : "text-on-surface"}`}>
                          {repo.fullName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground line-clamp-1">{repo.description}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                        <Star className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium text-on-surface">{repo.stars}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge className={`${repo.langColor} text-white text-xs`}>{repo.language}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right">
                      <span className="text-xs text-muted-foreground font-mono">{repo.updatedAt}</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {repo.aiTags.map((tag) => (
                          <Badge key={tag} variant="outline" className="font-mono text-[10px] uppercase tracking-wider">{tag}</Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 分页 */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            显示第 <span className="font-medium text-on-surface">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> 到{" "}
            <span className="font-medium text-on-surface">{Math.min(currentPage * ITEMS_PER_PAGE, sampleRepos.length)}</span> 条，共{" "}
            <span className="font-medium text-on-surface">{sampleRepos.length}</span> 条
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant="outline"
                  size="sm"
                  className={`h-8 min-w-[2rem] ${p === currentPage ? "bg-primary text-on-primary" : ""}`}
                  onClick={() => setCurrentPage(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ===== 选中星项目的详情面板（原 RepoDetail 内容） ===== */}
        {activeRepo && (
          <div className="space-y-6 pt-6 border-t border-outline-variant/50">
            {/* 头部信息 */}
            <section className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="default" className="font-mono text-xs uppercase tracking-wider">AI 工具</Badge>
                <Badge variant="secondary" className="font-mono text-xs uppercase tracking-wider">{activeRepo.language}</Badge>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-on-surface">{activeRepo.fullName}</h2>
              <p className="max-w-3xl text-base text-muted-foreground">{activeRepo.description}</p>
              <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-primary" />
                  <span className="font-medium text-on-surface">{activeRepo.stars}</span>
                  <span>星标</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <GitFork className="h-4 w-4" />
                  <span className="font-medium text-on-surface">{activeRepo.forks}</span>
                  <span>分叉</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>更新于 2 天前</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  在 GitHub 打开
                </Button>
                <Button variant="outline" className="gap-2" onClick={handleCopyClone}>
                  <Copy className="h-4 w-4" />
                  复制克隆地址
                </Button>
              </div>
            </section>

            {/* AI 分析 + 右侧信息 双栏 */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <Card className="lg:col-span-8">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-primary" />
                    <CardTitle className="text-xl">AI 智能分析</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                      <Star className="h-4 w-4 text-primary" />
                      <span>{aiAnalysis.reason}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{aiAnalysis.reasonText}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                      <School className="h-4 w-4 text-domain-frontend" />
                      <span>学习价值</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {aiAnalysis.learningValues.map((tag) => (
                        <Badge key={tag} variant="default" className="font-mono text-xs uppercase tracking-wider">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                      <Puzzle className="h-4 w-4 text-domain-backend" />
                      <span>复用建议</span>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{aiAnalysis.reuseAdvice}</p>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6 lg:col-span-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Gavel className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">协议健康度</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-status-safe" />
                        <span className="font-medium text-on-surface">{licenseHealth.license} 协议</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${licenseHealth.riskColor}`}>{licenseHealth.riskLevel}</span>
                      <span className="text-xs text-muted-foreground">可自由商用、修改与分发</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Network className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">系统雷达</CardTitle>
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
                          <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${item.value}%` }} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* 推荐相关项目 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight text-on-surface">推荐相关项目</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {relatedRepos.map((repo) => (
                  <Card key={repo.fullName} className="group flex flex-col transition-shadow hover:shadow-md">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <Badge className={`${repo.langColor} text-white`}>{repo.language}</Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                      <CardTitle className="text-base font-semibold tracking-tight text-on-surface">{repo.fullName}</CardTitle>
                      <CardDescription className="line-clamp-2">{repo.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="mt-auto pt-0">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5" />
                          <span>{repo.stars}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <GitFork className="h-3.5 w-3.5" />
                          <span>{repo.forks}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
