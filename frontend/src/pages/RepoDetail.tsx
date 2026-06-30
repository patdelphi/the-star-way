/**
 * RepoDetail.tsx
 * 仓库详情页
 * 展示单个仓库的详细信息、AI 智能分析、协议健康度和相关推荐
 */

import React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
} from "lucide-react"

// AI 分析数据
const aiAnalysis = {
  reason: "你为何星标该项目",
  reasonText:
    "该项目提供了将各类文档（PDF、Word、PPT 等）转换为 Markdown 的简洁方案，与你关注的文档处理与 AI 工具链方向高度契合。",
  learningValues: ["文档解析", "Markdown 生成", "Python 工具链"],
  reuseAdvice:
    "可直接集成到文档处理流水线中，或作为 RAG 系统的前置解析模块复用。",
}

// 协议健康度
const licenseHealth = {
  license: "MIT",
  riskLevel: "低风险",
  riskColor: "text-status-safe",
}

// 系统雷达数据（柱状图）
const systemRadar = [
  { label: "活跃度", value: 85, color: "bg-primary" },
  { label: "社区", value: 72, color: "bg-domain-frontend" },
  { label: "文档", value: 90, color: "bg-domain-backend" },
  { label: "稳定性", value: 78, color: "bg-domain-ai" },
]

// 推荐相关项目
const relatedRepos = [
  {
    fullName: "JupyterLab/jupyterlab",
    description: "JupyterLab 交互式计算环境。",
    stars: "14.2k",
    forks: "2.8k",
    language: "TypeScript",
    langColor: "bg-domain-frontend",
  },
  {
    fullName: "pandoc/pandoc",
    description: "通用标记格式转换工具。",
    stars: "35.6k",
    forks: "3.2k",
    language: "Haskell",
    langColor: "bg-domain-tools",
  },
  {
    fullName: "mozilla/pdf.js",
    description: "使用 JavaScript 实现的 PDF 阅读器。",
    stars: "48.1k",
    forks: "9.5k",
    language: "JavaScript",
    langColor: "bg-domain-frontend",
  },
]

const RepoDetail: React.FC = () => {
  const handleCopyClone = () => {
    navigator.clipboard.writeText("git clone https://github.com/microsoft/markitdown.git")
      .then(() => {
        // eslint-disable-next-line no-console
        console.log("克隆地址已复制")
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("复制失败", err)
      })
  }

  return (
    <div className="min-h-screen bg-grid-pattern p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* 头部信息 */}
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="default" className="font-mono text-xs uppercase tracking-wider">
              AI 工具
            </Badge>
            <Badge variant="secondary" className="font-mono text-xs uppercase tracking-wider">
              Python
            </Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-on-surface">
            microsoft/markitdown
          </h1>
          <p className="max-w-3xl text-base text-muted-foreground">
            用于把文件和办公文档转换为 Markdown 的 Python 工具。
          </p>
          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 text-primary" />
              <span className="font-medium text-on-surface">40.2k</span>
              <span>星标</span>
            </div>
            <div className="flex items-center gap-1.5">
              <GitFork className="h-4 w-4" />
              <span className="font-medium text-on-surface">1.8k</span>
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
          {/* AI 智能分析卡片（占 8/12） */}
          <Card className="lg:col-span-8">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">AI 智能分析</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 星标原因 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                  <Star className="h-4 w-4 text-primary" />
                  <span>{aiAnalysis.reason}</span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {aiAnalysis.reasonText}
                </p>
              </div>

              {/* 学习价值标签 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                  <School className="h-4 w-4 text-domain-frontend" />
                  <span>学习价值</span>
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
                  <span>复用建议</span>
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
                  <span className={`text-sm font-medium ${licenseHealth.riskColor}`}>
                    {licenseHealth.riskLevel}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    可自由商用、修改与分发
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 系统雷达柱状图 */}
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

        {/* 推荐相关项目（占 12/12） */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-on-surface">
            推荐相关项目
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {relatedRepos.map((repo) => (
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

export default RepoDetail
