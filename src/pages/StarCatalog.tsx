/**
 * StarCatalog.tsx
 * 星项目目录页
 * 展示所有同步仓库的列表，支持搜索、筛选、导出和分页
 */

import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
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
  MoreVertical,
  Languages,
} from "lucide-react"

// 示例数据
const sampleRepos = [
  {
    fullName: "vercel/next.js",
    description: "The React Framework for the Web",
    stars: "127.5k",
    forks: "27.1k",
    language: "TypeScript",
    langColor: "bg-domain-frontend",
    aiTags: ["web-framework", "react"],
  },
  {
    fullName: "hwchase17/langchain",
    description: "Building applications with LLMs through composability",
    stars: "95.3k",
    forks: "15.2k",
    language: "Python",
    langColor: "bg-domain-backend",
    aiTags: ["ai", "llm", "framework"],
  },
  {
    fullName: "neovim/neovim",
    description: "Vim-fork focused on extensibility and usability",
    stars: "82.1k",
    forks: "5.6k",
    language: "C",
    langColor: "bg-domain-tools",
    aiTags: ["editor", "cli-tools"],
  },
]

// 活跃筛选标签
const activeFilters = [
  { key: "lang", label: "TypeScript", value: "typescript" },
  { key: "topic", label: "AI", value: "ai" },
]

const StarCatalog: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = 498

  const handleExport = (format: string) => {
    // eslint-disable-next-line no-console
    console.log(`导出格式: ${format}`)
  }

  const handleRemoveFilter = (filterKey: string) => {
    // eslint-disable-next-line no-console
    console.log(`移除筛选: ${filterKey}`)
  }

  return (
    <div className="min-h-screen bg-grid-pattern p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* 页面标题与导出 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-on-surface">
              星项目目录
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              正在浏览 <span className="font-medium text-primary">1,492</span> 个同步的仓库
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport("CSV")}>
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("JSON")}>
              JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("MD")}>
              MD
            </Button>
          </div>
        </div>

        {/* 高级筛选栏（Glassmorphism Card） */}
        <Card className="glass-panel">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              {/* 搜索 + 下拉筛选 */}
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

              {/* 活跃筛选标签 */}
              {activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">已筛选:</span>
                  {activeFilters.map((filter) => (
                    <Badge
                      key={filter.key}
                      variant="secondary"
                      className="flex items-center gap-1 font-mono text-xs"
                    >
                      {filter.label}
                      <button
                        onClick={() => handleRemoveFilter(filter.key)}
                        className="ml-1 rounded-full hover:bg-surface-container-high"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground hover:text-on-surface"
                    onClick={() => handleRemoveFilter("all")}
                  >
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
                  <TableHead className="hidden lg:table-cell">AI 标签</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sampleRepos.map((repo) => (
                  <TableRow key={repo.fullName}>
                    <TableCell>
                      <div className="font-medium text-on-surface">{repo.fullName}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground line-clamp-1">
                        {repo.description}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                        <Star className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium text-on-surface">{repo.stars}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge className={`${repo.langColor} text-white text-xs`}>
                        {repo.language}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {repo.aiTags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="font-mono text-[10px] uppercase tracking-wider"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Languages className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <GitFork className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 分页栏 */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            显示第 <span className="font-medium text-on-surface">1</span> 到{" "}
            <span className="font-medium text-on-surface">3</span> 条，共{" "}
            <span className="font-medium text-on-surface">1,492</span> 条
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
              <Button variant="outline" size="sm" className="h-8 min-w-[2rem] bg-primary text-on-primary">
                1
              </Button>
              <Button variant="outline" size="sm" className="h-8 min-w-[2rem]">
                2
              </Button>
              <Button variant="outline" size="sm" className="h-8 min-w-[2rem]">
                3
              </Button>
              <span className="px-1 text-muted-foreground">...</span>
              <Button variant="outline" size="sm" className="h-8 min-w-[2rem]">
                {totalPages}
              </Button>
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
      </div>
    </div>
  )
}

export default StarCatalog
