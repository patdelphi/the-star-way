/**
 * Developers.tsx
 * 开发者管理页面
 * 三列卡片网格展示开发者列表，支持搜索添加、删除、分页、选中高亮
 * 选中开发者在下方展开 Dashboard 详情面板，可同步该开发者星标
 */
import { useState, useMemo } from "react"
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
  Radar,
  Diamond,
  ExternalLink,
  GitFork,
} from "lucide-react"

// ===== Demo 开发者数据 =====
const demoDevelopers = [
  { id: "1", name: "patdelphi", stars: 691, isActive: true },
  { id: "2", name: "torvalds", stars: 0, isActive: false },
  { id: "3", name: "antirez", stars: 128, isActive: false },
  { id: "4", name: "gaearon", stars: 342, isActive: false },
  { id: "5", name: "sindresorhus", stars: 856, isActive: false },
  { id: "6", name: "tj", stars: 215, isActive: false },
  { id: "7", name: "yyx990803", stars: 567, isActive: false },
  { id: "8", name: "ruanyf", stars: 423, isActive: false },
  { id: "9", name: "BrendanEich", stars: 89, isActive: false },
  { id: "10", name: "mattn", stars: 312, isActive: false },
  { id: "11", name: "feross", stars: 178, isActive: false },
  { id: "12", name: "kamranahmedse", stars: 445, isActive: false },
  { id: "13", name: "dabit3", stars: 267, isActive: false },
  { id: "14", name: "kentcdodds", stars: 534, isActive: false },
  { id: "15", name: "remy", stars: 198, isActive: false },
  { id: "16", name: "substack", stars: 156, isActive: false },
  { id: "17", name: "jashkenas", stars: 289, isActive: false },
  { id: "18", name: "mxcl", stars: 367, isActive: false },
  { id: "19", name: "cassidoo", stars: 412, isActive: false },
  { id: "20", name: " levelsio", stars: 245, isActive: false },
  { id: "21", name: "thebau5", stars: 189, isActive: false },
  { id: "22", name: "ankane", stars: 334, isActive: false },
  { id: "23", name: "nikic", stars: 278, isActive: false },
  { id: "24", name: "fatedier", stars: 156, isActive: false },
]

// 技术人格数据（详情面板用）
const personalityData = [
  { name: "Python", count: 254, color: "bg-domain-backend" },
  { name: "TypeScript", count: 125, color: "bg-domain-frontend" },
  { name: "Rust", count: 89, color: "bg-domain-tools" },
  { name: "Jupyter", count: 42, color: "bg-domain-ai" },
]

const hotTopics = [
  "machine-learning",
  "web-framework",
  "cli-tools",
  "data-science",
  "open-source",
  "developer-tools",
]

const gemRepos = [
  {
    fullName: "karpathy/micrograd",
    description: "A tiny scalar-valued autograd engine and a neural net library on top of it with PyTorch-like API",
    stars: "10.2k",
    forks: "1.1k",
    language: "Python",
    langColor: "bg-domain-backend",
  },
  {
    fullName: "tiangolo/fastapi",
    description: "FastAPI framework, high performance, easy to learn, fast to code, ready for production",
    stars: "78.5k",
    forks: "6.6k",
    language: "Python",
    langColor: "bg-domain-backend",
  },
  {
    fullName: "charmbracelet/bubbletea",
    description: "A powerful little TUI framework",
    stars: "29.8k",
    forks: "800",
    language: "Go",
    langColor: "bg-domain-tools",
  },
]

const radarData = [
  { label: "前端", value: 75, color: "#0284c7" },
  { label: "后端", value: 90, color: "#059669" },
  { label: "AI/ML", value: 65, color: "#7c3aed" },
  { label: "工具链", value: 80, color: "#475569" },
  { label: "基础设施", value: 55, color: "#006b5c" },
  { label: "数据", value: 70, color: "#9b4420" },
]

const ITEMS_PER_PAGE = 12
const syncStates = [
  "待同步",
  "同步中",
  "同步成功",
  "GitHub API 限流",
  "用户不存在",
  "网络失败",
]

export default function Developers() {
  const [developers, setDevelopers] = useState(demoDevelopers)
  const [searchInput, setSearchInput] = useState("")
  const [searchResult, setSearchResult] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [syncStatus, setSyncStatus] = useState(syncStates[0])

  // 分页数据
  const totalPages = Math.ceil(developers.length / ITEMS_PER_PAGE)
  const paginatedDevs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return developers.slice(start, start + ITEMS_PER_PAGE)
  }, [developers, currentPage])

  // 当前选中的开发者
  const activeDev = developers.find((d) => d.isActive)

  // 选中某个开发者
  const selectDeveloper = (id: string) => {
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

  // 添加开发者
  const addDeveloper = () => {
    const name = searchInput.trim().startsWith("@")
      ? searchInput.trim().slice(1)
      : searchInput.trim()
    if (!name) return
    if (developers.find((d) => d.name === name)) return
    const newDev = {
      id: Date.now().toString(),
      name,
      stars: Math.floor(Math.random() * 500),
      isActive: false,
    }
    setDevelopers((prev) => [...prev, newDev])
    setSearchInput("")
    setSearchResult("")
  }

  const handleSearch = () => {
    if (searchInput.trim()) {
      setSearchResult(searchInput.trim())
    }
  }

  const runMockSync = (name: string) => {
    const currentIndex = syncStates.indexOf(syncStatus)
    const nextStatus = syncStates[(currentIndex + 1) % syncStates.length]
    setSyncStatus(nextStatus)
    if (nextStatus === "同步成功") {
      setSearchResult(`@${name} 星标已更新`)
    }
  }

  return (
    <div className="bg-grid-pattern min-h-[calc(100vh-8rem)]">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-on-surface">
          开发者
        </h1>
        <p className="text-on-surface-variant mt-1">
          管理关注的 GitHub 开发者，查看和同步星标项目
        </p>
      </div>

      {/* 搜索添加区域 */}
      <Card className="mb-8 border border-outline-variant/50 bg-surface-container-low">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-on-surface">
            <Search className="h-4 w-4 inline-block mr-2 text-primary" />
            搜索开发者
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Input
                placeholder="输入 GitHub 用户名，如 torvalds"
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
              搜索
            </Button>
            {searchResult && (
              <Button
                className="bg-primary text-on-primary hover:bg-primary/90 gap-2"
                onClick={addDeveloper}
              >
                <UserPlus className="w-4 h-4" />
                添加
              </Button>
            )}
          </div>
          {searchResult && (
            <div className="mt-3 flex items-center gap-2 text-sm text-on-surface-variant">
              <span>找到：</span>
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

      {/* 开发者列表 - 三列紧凑网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
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
            <CardContent className="flex items-center gap-3 py-3 px-4">
              {/* 选中指示器 */}
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
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
                      当前
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-on-surface-variant">
                  <Star className="w-3 h-3" />
                  <span>{dev.stars}</span>
                </div>
              </div>

              {/* 删除按钮 */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-on-surface-variant hover:text-error shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  removeDeveloper(dev.id)
                }}
                title="删除开发者"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 空状态 */}
      {developers.length === 0 && (
        <div className="text-center py-16 text-on-surface-variant">
          <Plus className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">暂无开发者</p>
          <p className="text-sm mt-1">使用上方搜索框添加 GitHub 开发者</p>
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mb-10">
          <div className="text-sm text-muted-foreground">
            共 <span className="font-medium text-on-surface">{developers.length}</span> 位开发者
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
                  <p className="text-sm text-muted-foreground">
                    星图引擎已就绪
                  </p>
                </div>
              </div>
              {/* 同步当前开发者星标 */}
              <Button
                className="bg-primary text-on-primary hover:bg-primary/90 gap-2"
                onClick={() => runMockSync(activeDev.name)}
              >
                <RotateCw className="w-4 h-4" />
                同步星标
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">同步状态</span>
              <Badge variant={syncStatus === "同步成功" ? "default" : "outline"}>
                {syncStatus}
              </Badge>
              <span className="text-xs text-muted-foreground">模拟 401/404/限流/网络失败状态，不调用 GitHub API。</span>
            </div>
            <div className="flex items-baseline gap-2 pt-2">
              <span className="text-4xl font-bold tracking-tight text-primary">
                {activeDev.stars}
              </span>
              <span className="text-lg text-muted-foreground">
                个同步的星标仓库
              </span>
            </div>
          </section>

          {/* 技术人格 + 技术雷达 双栏 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* 技术人格卡片（占 8/12） */}
            <Card className="lg:col-span-8">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Diamond className="h-5 w-5 text-primary" />
                  <CardTitle className="text-xl">技术人格</CardTitle>
                </div>
                <CardDescription>
                  基于星标仓库语言分布生成的开发者画像
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Bento Grid */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {personalityData.map((item) => (
                    <div
                      key={item.name}
                      className="rounded-xl border border-outline-variant/50 bg-surface-container-high p-4 transition-colors hover:bg-surface-container"
                    >
                      <div className={`mb-3 h-2 w-full rounded-full ${item.color}`} />
                      <div className="text-2xl font-bold tracking-tight text-on-surface">
                        {item.count}
                      </div>
                      <div className="text-xs font-medium text-muted-foreground">
                        {item.name}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 热门主题标签 */}
                <div className="space-y-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    热门主题
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {hotTopics.map((topic) => (
                      <Badge key={topic} variant="outline" className="font-mono text-xs uppercase tracking-wider">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 技术雷达卡片（占 4/12） */}
            <Card className="lg:col-span-4">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Radar className="h-5 w-5 text-primary" />
                  <CardTitle className="text-xl">技术雷达</CardTitle>
                </div>
                <CardDescription>
                  六维技术能力分布
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 圆形雷达图 */}
                <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(
                      ${radarData.map((d, i) => {
                        const start = radarData.slice(0, i).reduce((sum, r) => sum + r.value, 0)
                        const total = radarData.reduce((sum, r) => sum + r.value, 0)
                        return `${d.color} ${(start / total) * 360}deg ${((start + d.value) / total) * 360}deg`
                      }).join(", ")}
                    )`,
                  }}
                >
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-container-low">
                    <span className="text-lg font-bold text-primary">Tech</span>
                  </div>
                </div>

                {/* 状态统计 */}
                <div className="space-y-2">
                  {radarData.map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-on-surface-variant">{item.label}</span>
                      </div>
                      <span className="font-mono font-medium text-on-surface">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 宝藏项目网格 */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold tracking-tight text-on-surface">
                宝藏项目
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {gemRepos.map((repo) => (
                <Card key={repo.fullName} className="group flex flex-col transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge className={`${repo.langColor} text-white`}>
                        {repo.language}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardTitle className="text-base font-semibold tracking-tight text-on-surface">
                      {repo.fullName}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {repo.description}
                    </CardDescription>
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
  )
}
