/**
 * Dashboard.tsx
 * 控制台/星图引擎页
 * 展示当前开发者星标概览、技术人格分析、技术雷达和宝藏项目推荐
 * 接入真实 API，支持 i18n，API 不可用时回退到 Demo 数据
 */

import React, { useState, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
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
  PieChart as PieChartIcon,
  Tags,
  Clock,
  TrendingUp,
} from "lucide-react"
import { getGlobalOverview, type GlobalOverview } from "@/lib/api"
import { PieChart, PieChartLegend } from "@/components/charts/PieChart"


// ===== 技术雷达六维映射规则 =====
const RADAR_TAG_MAP: Record<string, string[]> = {
  frontend: ['前端框架', '前端工具', 'CSS', 'UI 组件', 'React', 'Vue'],
  backend: ['后端框架', 'API', '数据库', 'Web 服务', 'Node.js', 'Python'],
  ai: ['AI/LLM', 'AI Agent', '机器学习', '深度学习', 'RAG', 'MCP'],
  tools: ['CLI 工具', '开发者工具', '编辑器', '版本控制'],
  infrastructure: ['DevOps', '容器化', 'CI/CD', '云平台', '监控'],
  data: ['数据处理', '数据可视化', '数据库', 'ETL'],
}

const RADAR_DIMENSIONS = [
  { key: 'frontend', color: '#0284c7' },
  { key: 'backend', color: '#059669' },
  { key: 'ai', color: '#7c3aed' },
  { key: 'tools', color: '#475569' },
  { key: 'infrastructure', color: '#006b5c' },
  { key: 'data', color: '#9b4420' },
]

// ===== Demo 数据（API 不可用时回退） =====
const demoPersonalityData = [
  { nameKey: 'pythonEcosystem', count: 254, color: 'bg-domain-backend' },
  { nameKey: 'tsEcosystem', count: 125, color: 'bg-domain-frontend' },
  { nameKey: 'systemTools', count: 89, color: 'bg-domain-tools' },
  { nameKey: 'jupyterNotes', count: 42, color: 'bg-domain-ai' },
]

const demoRadarData = [
  { labelKey: 'frontend', value: 75, color: '#0284c7' },
  { labelKey: 'backend', value: 90, color: '#059669' },
  { labelKey: 'ai', value: 65, color: '#7c3aed' },
  { labelKey: 'tools', value: 80, color: '#475569' },
  { labelKey: 'infrastructure', value: 55, color: '#006b5c' },
  { labelKey: 'data', value: 70, color: '#9b4420' },
]

const demoHotTopics = [
  '机器学习',
  '网页框架',
  '命令行工具',
  '数据科学',
  '开源项目',
  '开发者工具',
]

const demoGemRepos = [
  {
    fullName: 'karpathy/micrograd',
    description: '微型标量自动求导引擎，以及基于它实现的神经网络库。',
    stars: '10.2k',
    forks: '1.1k',
    language: 'Python',
    langColor: 'bg-domain-backend',
    htmlUrl: 'https://github.com/karpathy/micrograd',
  },
  {
    fullName: 'tiangolo/fastapi',
    description: '高性能、易学习、编码快、可用于生产环境的 FastAPI 框架。',
    stars: '78.5k',
    forks: '6.6k',
    language: 'Python',
    langColor: 'bg-domain-backend',
    htmlUrl: 'https://github.com/tiangolo/fastapi',
  },
  {
    fullName: 'charmbracelet/bubbletea',
    description: '轻量但能力完整的终端界面框架。',
    stars: '29.8k',
    forks: '800',
    language: 'Go',
    langColor: 'bg-domain-tools',
    htmlUrl: 'https://github.com/charmbracelet/bubbletea',
  },
]

// ===== 语言生态归类配置 =====
const CATEGORY_MAP: Record<string, { key: string; color: string }> = {
  'Python': { key: 'pythonEcosystem', color: 'bg-domain-backend' },
  'TypeScript': { key: 'tsEcosystem', color: 'bg-domain-frontend' },
  'JavaScript': { key: 'tsEcosystem', color: 'bg-domain-frontend' },
  'Rust': { key: 'systemTools', color: 'bg-domain-tools' },
  'Go': { key: 'systemTools', color: 'bg-domain-tools' },
  'C': { key: 'systemTools', color: 'bg-domain-tools' },
  'C++': { key: 'systemTools', color: 'bg-domain-tools' },
  'Shell': { key: 'systemTools', color: 'bg-domain-tools' },
  'Objective-C': { key: 'systemTools', color: 'bg-domain-tools' },
  'Zig': { key: 'systemTools', color: 'bg-domain-tools' },
  'Nim': { key: 'systemTools', color: 'bg-domain-tools' },
  'Swift': { key: 'systemTools', color: 'bg-domain-tools' },
  'Jupyter Notebook': { key: 'jupyterNotes', color: 'bg-domain-ai' },
  'Java': { key: 'jvmEcosystem', color: 'bg-domain-backend' },
  'Kotlin': { key: 'jvmEcosystem', color: 'bg-domain-backend' },
  'Scala': { key: 'jvmEcosystem', color: 'bg-domain-backend' },
  'Groovy': { key: 'jvmEcosystem', color: 'bg-domain-backend' },
  'HTML': { key: 'frontendEcosystem', color: 'bg-domain-frontend' },
  'CSS': { key: 'frontendEcosystem', color: 'bg-domain-frontend' },
  'Vue': { key: 'frontendEcosystem', color: 'bg-domain-frontend' },
  'PHP': { key: 'frontendEcosystem', color: 'bg-domain-frontend' },
  'Dart': { key: 'frontendEcosystem', color: 'bg-domain-frontend' },
}

const LANGUAGE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
]

interface PersonalityItem {
  nameKey: string
  count: number
  color: string
}

interface RadarItem {
  labelKey: string
  value: number
  color: string
}

interface GemRepo {
  fullName: string
  description: string
  stars: string
  forks: string
  language: string
  langColor: string
  htmlUrl: string
}

/**
 * 将语言分布归类为生态
 */
function categorizeLanguages(languages: { language: string; count: number }[]): PersonalityItem[] {
  const agg: Record<string, { key: string; color: string; count: number }> = {}
  for (const { language, count } of languages) {
    const cfg = CATEGORY_MAP[language]
    if (cfg) {
      const existing = agg[cfg.key]
      if (existing) {
        existing.count += count
      } else {
        agg[cfg.key] = { ...cfg, count }
      }
    } else {
      const other = agg['otherEcosystem']
      if (other) {
        other.count += count
      } else {
        agg['otherEcosystem'] = { key: 'otherEcosystem', color: 'bg-domain-backend', count }
      }
    }
  }
  return Object.values(agg)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map(item => ({ nameKey: item.key, count: item.count, color: item.color }))
}

/**
 * 计算技术雷达六维数据
 */
function calcRadarData(tags: { tag: string; count: number }[]): RadarItem[] {
  if (!tags || tags.length === 0) {
    return demoRadarData.map(d => ({ ...d }))
  }

  const tagMap = new Map(tags.map(t => [t.tag, t.count]))
  const dimCounts = RADAR_DIMENSIONS.map(dim => {
    const keywords = RADAR_TAG_MAP[dim.key]
    const count = keywords.reduce((sum, kw) => sum + (tagMap.get(kw) || 0), 0)
    return { ...dim, count }
  })

  const totalRelevant = dimCounts.reduce((sum, d) => sum + d.count, 0)
  if (totalRelevant === 0) {
    return demoRadarData.map(d => ({ ...d }))
  }

  const maxCount = Math.max(...dimCounts.map(d => d.count), 1)
  return dimCounts.map(dim => ({
    labelKey: dim.key,
    value: Math.round((dim.count / maxCount) * 60 + 40), // 映射到 40-100
    color: dim.color,
  }))
}

/**
 * 将全库概览中的仓库数据转换为卡片展示数据
 */
function adaptGemRepos(repos: GlobalOverview['gemRepos']): GemRepo[] {
  const langColorMap: Record<string, string> = {
    'Python': 'bg-domain-backend',
    'TypeScript': 'bg-domain-frontend',
    'JavaScript': 'bg-domain-frontend',
    'Go': 'bg-domain-tools',
    'Rust': 'bg-domain-tools',
    'C': 'bg-domain-tools',
    'C++': 'bg-domain-tools',
    'Java': 'bg-domain-backend',
  }

  return repos.map(r => ({
    fullName: r.full_name,
    description: r.description || '',
    stars: formatNumber(r.stars),
    forks: formatNumber(r.forks),
    language: r.language || 'Unknown',
    langColor: langColorMap[r.language || ''] || 'bg-domain-backend',
    htmlUrl: r.html_url,
  }))
}

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

function calcPercent(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((value / total) * 100)
}

function pickTopItems<T extends { count: number }>(items: T[], limit: number): T[] {
  return [...items].sort((a, b) => b.count - a.count).slice(0, limit)
}

function TrendBars({ data }: { data: { label: string; value: number }[] }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1)
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const peak = data.reduce((best, item) => item.value > best.value ? item : best, data[0])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-outline-variant/60 bg-surface-container-low px-3 py-2">
          <div className="text-xs text-muted-foreground">{total}</div>
          <div className="text-sm font-medium text-on-surface">近 12 月新增</div>
        </div>
        <div className="rounded-md border border-outline-variant/60 bg-surface-container-low px-3 py-2">
          <div className="text-xs text-muted-foreground">{peak?.label || "-"}</div>
          <div className="text-sm font-medium text-on-surface">峰值月份</div>
        </div>
        <div className="rounded-md border border-outline-variant/60 bg-surface-container-low px-3 py-2">
          <div className="text-xs text-muted-foreground">{peak?.value || 0}</div>
          <div className="text-sm font-medium text-on-surface">峰值数量</div>
        </div>
      </div>
      <div className="flex h-44 items-end gap-2 rounded-md border border-outline-variant/60 bg-surface-container-low px-3 py-3">
        {data.map((item) => {
          const height = Math.max(8, (item.value / maxValue) * 100)
          return (
            <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
              <div className="flex flex-1 items-end">
                <div
                  className="w-full rounded-t-sm bg-primary/80 transition-colors hover:bg-primary"
                  style={{ height: `${height}%` }}
                  title={`${item.label}: ${item.value}`}
                />
              </div>
              <div className="truncate text-center font-mono text-[10px] text-muted-foreground">{item.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CompactStatGrid({
  items,
  total,
  limit = 16,
}: {
  items: { label: string; count: number; color: string }[]
  total: number
  limit?: number
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {items.slice(0, limit).map((item) => (
        <div key={item.label} className="min-w-0 rounded-md border border-outline-variant/60 bg-surface-container-low px-3 py-2">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="truncate text-sm font-medium text-on-surface">{item.label}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-lg font-semibold text-on-surface">{item.count}</span>
            <span className="font-mono text-xs text-muted-foreground">{calcPercent(item.count, total)}%</span>
          </div>
        </div>
      ))}
    </div>
  )
}

const Dashboard: React.FC = () => {
  const { t } = useTranslation()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [personalityData, setPersonalityData] = useState<PersonalityItem[]>(demoPersonalityData)
  const [radarData, setRadarData] = useState<RadarItem[]>(demoRadarData)
  const [hotTopics, setHotTopics] = useState<string[]>(demoHotTopics)
  const [gemRepos, setGemRepos] = useState<GemRepo[]>(demoGemRepos)
  const [repoCount, setRepoCount] = useState(691)
  const [languageStats, setLanguageStats] = useState<{ language: string; count: number }[]>([])
  const [topicStats, setTopicStats] = useState<{ topic: string; count: number }[]>([])
  const [recentStars, setRecentStars] = useState<{ fullName: string; description: string; language: string; starredAt: string }[]>([])
  const [starTrend, setStarTrend] = useState<{ label: string; value: number }[]>([])
  const [userCount, setUserCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        setLoading(true)
        setError(null)

        const overview = await getGlobalOverview()

        if (cancelled) return
        if (!overview) {
          throw new Error(t('dashboard.loadError'))
        }

        // 技术人格：从全库语言分布计算
        setUserCount(overview.userCount)
        setRepoCount(overview.repoCount)
        if (overview.languages.length > 0) {
          setPersonalityData(categorizeLanguages(overview.languages))
          setLanguageStats(overview.languages)
        } else {
          setPersonalityData(demoPersonalityData)
          setLanguageStats([])
        }

        // 技术雷达：从全库 Topic 聚类计算
        setRadarData(calcRadarData(overview.topics.map((item) => ({ tag: item.topic, count: item.count }))))

        // 热门主题：从全库 topics 取前 6 个
        if (overview.topics.length > 0) {
          setHotTopics(overview.topics.slice(0, 6).map(t => t.topic))
          setTopicStats(overview.topics)
        } else {
          setHotTopics(demoHotTopics)
          setTopicStats([])
        }

        // 宝藏项目：从全库候选仓库生成
        const gems = adaptGemRepos(overview.gemRepos)
        if (gems.length > 0) {
          setGemRepos(gems)
        } else {
          setGemRepos(demoGemRepos)
        }

        // 最近星标：全库最近星标
        const recent = overview.recentStars
          .map((r) => ({
            fullName: r.full_name,
            description: r.description || '',
            language: r.language || 'Unknown',
            starredAt: r.starred_at,
          }))
        setRecentStars(recent)

        // 星标时间趋势：全库按月聚合
        setStarTrend(overview.starTrend)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        // 回退到 Demo 数据
        setPersonalityData(demoPersonalityData)
        setRadarData(demoRadarData)
        setHotTopics(demoHotTopics)
        setGemRepos(demoGemRepos)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [t])

  const radarGradient = useMemo(() => {
    const total = radarData.reduce((sum, r) => sum + r.value, 0)
    if (total === 0) return ''
    let start = 0
    const segments = radarData.map(d => {
      const segStart = start
      const segEnd = start + (d.value / total) * 360
      start = segEnd
      return `${d.color} ${segStart}deg ${segEnd}deg`
    })
    return `conic-gradient(${segments.join(', ')})`
  }, [radarData])

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
                {t('dashboard.globalOverview')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('dashboard.globalOverviewDesc', { count: userCount })}
              </p>
            </div>
          </div>
          <div className="flex items-baseline gap-2 pt-2">
            <span className="text-5xl font-bold tracking-tight text-primary">
              {repoCount}
            </span>
            <span className="text-lg text-muted-foreground">
              {t('dashboard.starCount')}
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
                <CardTitle className="text-xl">{t('dashboard.personality')}</CardTitle>
              </div>
              <CardDescription>
                {t('dashboard.personalityDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading && (
                <div className="text-sm text-muted-foreground">{t('dashboard.loading')}</div>
              )}
              {error && (
                <div className="text-sm text-destructive">{t('dashboard.loadError')}</div>
              )}

              {/* Bento Grid */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {personalityData.map((item) => (
                  <div
                    key={item.nameKey}
                    className="rounded-xl border border-outline-variant/50 bg-surface-container-high p-4 transition-colors hover:bg-surface-container"
                  >
                    <div className={`mb-3 h-2 w-full rounded-full ${item.color}`} />
                    <div className="text-2xl font-bold tracking-tight text-on-surface">
                      {item.count}
                    </div>
                    <div className="text-xs font-medium text-muted-foreground">
                      {t(`dashboard.${item.nameKey}`)}
                    </div>
                  </div>
                ))}
              </div>

              {/* 热门主题标签 */}
              <div className="space-y-2">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  {t('dashboard.hotTopics')}
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
                <CardTitle className="text-xl">{t('dashboard.radar')}</CardTitle>
              </div>
              <CardDescription>
                {t('dashboard.radarDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 圆形雷达图（CSS conic-gradient 模拟） */}
              <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full"
                style={{ background: radarGradient }}
              >
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-container-low">
                  <span className="text-lg font-bold text-primary">{t('dashboard.radarCenter')}</span>
                </div>
              </div>

              {/* 状态统计 */}
              <div className="space-y-2">
                {radarData.map((item) => (
                  <div key={item.labelKey} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-on-surface-variant">{t(`dashboard.${item.labelKey}`)}</span>
                    </div>
                    <span className="font-mono font-medium text-on-surface">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 语言分布饼图 */}
        {languageStats.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">{t("dashboard.languageDistribution")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 items-center">
                <PieChart
                  data={languageStats.slice(0, 8).map((l, i) => ({
                    label: l.language || "Unknown",
                    value: l.count,
                    color: LANGUAGE_COLORS[i % LANGUAGE_COLORS.length],
                  }))}
                  size={180}
                  donut
                />
                <PieChartLegend
                  data={languageStats.slice(0, 8).map((l, i) => ({
                    label: l.language || "Unknown",
                    value: l.count,
                    color: LANGUAGE_COLORS[i % LANGUAGE_COLORS.length],
                  }))}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* 最近星标 */}
        {recentStars.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">{t("dashboard.recentStars")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentStars.map((r) => (
                  <div key={r.fullName} className="flex items-center gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <Link to={`/repo/${r.fullName}`} className="text-sm font-medium text-primary hover:underline truncate block">
                        {r.fullName}
                      </Link>
                      <p className="text-xs text-muted-foreground truncate">{r.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="outline" className="text-[10px]">{r.language}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">{r.starredAt.slice(0, 10)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 星标时间趋势 */}
        {starTrend.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">{t("dashboard.starTrend")}</CardTitle>
              </div>
              <CardDescription>
                按全库真实用户的 starred_at 聚合最近 12 个月新增星标。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TrendBars data={starTrend} />
            </CardContent>
          </Card>
        )}

        {/* Top 标签 */}
        {topicStats.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Tags className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">{t("dashboard.tagCloud")}</CardTitle>
              </div>
              <CardDescription>
                Top 标签按全库仓库 topics 出现次数排序，数量表示命中仓库数。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CompactStatGrid
                total={topicStats.reduce((sum, item) => sum + item.count, 0)}
                items={pickTopItems(topicStats, 16).map((item, i) => ({
                  label: item.topic,
                  count: item.count,
                  color: LANGUAGE_COLORS[i % LANGUAGE_COLORS.length],
                }))}
              />
            </CardContent>
          </Card>
        )}

        {/* 宝藏项目网格 */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-on-surface">
                {t('dashboard.gemRepos')}
              </h2>
              <p className="text-sm text-muted-foreground">
                规则：真实用户星标中，GitHub stars 50-10000，最近 90 天有更新，按 stars 倒序取前 3。
              </p>
            </div>
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
