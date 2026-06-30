/**
 * Dashboard.tsx
 * 控制台/星图引擎页
 * 展示当前开发者星标概览、技术人格分析、技术雷达和宝藏项目推荐
 */

import React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Brain,
  Radar,
  Diamond,
  Star,
  GitFork,
  ExternalLink,
} from "lucide-react"

// 技术人格数据
const personalityData = [
  { name: "Python 生态", count: 254, color: "bg-domain-backend" },
  { name: "TypeScript 生态", count: 125, color: "bg-domain-frontend" },
  { name: "Rust 工具", count: 89, color: "bg-domain-tools" },
  { name: "Jupyter 笔记", count: 42, color: "bg-domain-ai" },
]

// 热门主题标签
const hotTopics = [
  "机器学习",
  "网页框架",
  "命令行工具",
  "数据科学",
  "开源项目",
  "开发者工具",
]

// 宝藏项目数据
const gemRepos = [
  {
    fullName: "karpathy/micrograd",
    description: "微型标量自动求导引擎，以及基于它实现的神经网络库。",
    stars: "10.2k",
    forks: "1.1k",
    language: "Python",
    langColor: "bg-domain-backend",
  },
  {
    fullName: "tiangolo/fastapi",
    description: "高性能、易学习、编码快、可用于生产环境的 FastAPI 框架。",
    stars: "78.5k",
    forks: "6.6k",
    language: "Python",
    langColor: "bg-domain-backend",
  },
  {
    fullName: "charmbracelet/bubbletea",
    description: "轻量但能力完整的终端界面框架。",
    stars: "29.8k",
    forks: "800",
    language: "Go",
    langColor: "bg-domain-tools",
  },
]

// 雷达图数据（用 conic-gradient 模拟）
const radarData = [
  { label: "前端", value: 75, color: "#0284c7" },
  { label: "后端", value: 90, color: "#059669" },
  { label: "智能应用", value: 65, color: "#7c3aed" },
  { label: "工具链", value: 80, color: "#475569" },
  { label: "基础设施", value: 55, color: "#006b5c" },
  { label: "数据", value: 70, color: "#9b4420" },
]

const Dashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-grid-pattern p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Hero Section */}
        <section className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-on-primary">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-on-surface">
                @patdelphi
              </h1>
              <p className="text-sm text-muted-foreground">
                星图引擎已就绪
              </p>
            </div>
          </div>
          <div className="flex items-baseline gap-2 pt-2">
            <span className="text-5xl font-bold tracking-tight text-primary">
              691
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
              {/* 圆形雷达图（CSS conic-gradient 模拟） */}
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
                  <span className="text-lg font-bold text-primary">技术</span>
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
    </div>
  )
}

export default Dashboard
