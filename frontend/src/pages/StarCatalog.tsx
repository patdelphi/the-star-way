/**
 * StarCatalog.tsx
 * 星项目目录页 - 统一标签 + 选中过滤
 * 所有标签显示在上方（多选），下方显示选中标签相关的项目
 */

import React, { useState, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Star, GitFork, Tags } from "lucide-react"
import { getRepos } from "@/lib/api"
import type { Repo } from "@/lib/api"
import { useDeveloper } from "@/contexts/DeveloperContext"

// 格式化星数
function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function repoDetailPath(repo: Repo): string {
  return `/analysis?repo=${encodeURIComponent(repo.full_name)}`
}

// 提取 autoTags 和 topics
function extractTags(apiRepo: Repo & { tags: string[] }): { autoTags: string[]; topics: string[] } {
  const autoTags = apiRepo.tags || []
  let topics: string[] = []
  try {
    topics = (apiRepo as any).topics_json ? JSON.parse((apiRepo as any).topics_json) : []
  } catch { /* ignore */ }
  return { autoTags, topics: topics.map((t: string) => t.toLowerCase()) }
}

interface CatalogRepo extends Repo {
  tags: string[]
  autoTags: string[]
  allTags: string[]
}

const StarCatalog: React.FC = () => {
  const { t } = useTranslation()
  const { currentLogin } = useDeveloper()

  // 数据状态
  const [repos, setRepos] = useState<CatalogRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [isDemoMode, setIsDemoMode] = useState(false)

  // UI 状态
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // 加载仓库数据
  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      try {
        const reposRes = await getRepos(currentLogin, { pageSize: 10000 })

        if (cancelled) return

        const hasRepos = reposRes.items && reposRes.items.length > 0
        if (hasRepos) {
          const enriched: CatalogRepo[] = reposRes.items.map((r) => {
            const { autoTags, topics } = extractTags(r)
            return { ...r, autoTags, allTags: [...new Set([...autoTags, ...topics])] }
          })
          setRepos(enriched)
          setIsDemoMode(false)
        } else {
          setRepos([])
          setIsDemoMode(true)
        }
      } catch {
        if (!cancelled) {
          setRepos([])
          setIsDemoMode(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [currentLogin])

  // 统一标签云：autoTags 全部保留 + topics 按数量取前 64
  const tagCounts = useMemo(() => {
    const autoTagCounts = new Map<string, number>()
    const topicCounts = new Map<string, number>()

    for (const repo of repos) {
      for (const tag of repo.autoTags) {
        autoTagCounts.set(tag, (autoTagCounts.get(tag) || 0) + 1)
      }
    }

    // 统计 topics 数量（排除已是 autoTags 的）
    for (const repo of repos) {
      const { topics } = extractTags(repo)
      for (const t of topics) {
        // 跳过和 autoTag 同名的（忽略大小写）
        const isAutoTag = [...autoTagCounts.keys()].some(at => at.toLowerCase() === t)
        if (isAutoTag) continue
        topicCounts.set(t, (topicCounts.get(t) || 0) + 1)
      }
    }

    // topics 按数量降序取前 64
    const topTopics = [...topicCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 64)

    // 合并：autoTags + topTopics，按数量降序
    const merged = [...autoTagCounts.entries(), ...topTopics]
    return merged.sort((a, b) => b[1] - a[1])
  }, [repos])

  // 搜索 + 标签过滤
  const filteredRepos = useMemo(() => {
    let result = repos
    // 标签过滤：选中为空显示全部，否则匹配任一选中标签（OR）
    if (selectedTags.length > 0) {
      result = result.filter((r) => selectedTags.some((tag) => r.allTags.includes(tag)))
    }
    // 搜索过滤
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q))
      )
    }
    return result
  }, [repos, selectedTags, searchQuery])

  // 切换标签选中
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  return (
    <div className="min-h-screen bg-grid-pattern p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-on-surface">
            {t("starCatalog.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("starCatalog.desc", { count: repos.length })}
          </p>
        </div>

        {/* Demo 模式提示 */}
        {isDemoMode && (
          <Card className="border-yellow-500/50 bg-yellow-500/10">
            <CardContent className="p-3">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                {t("starCatalog.demoMode")}
              </p>
            </CardContent>
          </Card>
        )}

        {/* 搜索框 */}
        <Card className="glass-panel">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("starCatalog.searchPlaceholder")}
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 统一标签云 */}
        {!loading && tagCounts.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Tags className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-on-surface">{t("starCatalog.allTags")}</span>
                {selectedTags.length > 0 && (
                  <button
                    className="ml-auto text-xs text-muted-foreground hover:text-primary"
                    onClick={() => setSelectedTags([])}
                  >
                    {t("starCatalog.clearTags")}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {tagCounts.map(([tag, count]) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      selectedTags.includes(tag)
                        ? "border-primary bg-primary text-on-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-on-surface"
                    }`}
                  >
                    <span className="font-medium">{tag}</span>
                    <span className={`text-[10px] ${selectedTags.includes(tag) ? "text-on-primary/70" : "text-muted-foreground"}`}>{count}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">{t("starCatalog.loading")}</p>
          </div>
        )}

        {/* 选中标签提示 */}
        {!loading && selectedTags.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t("starCatalog.filteredBy")}</span>
            {selectedTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button
                  onClick={() => toggleTag(tag)}
                  className="ml-0.5 rounded-full hover:bg-surface-container-high"
                >
                  ×
                </button>
              </Badge>
            ))}
            <span className="ml-2">{filteredRepos.length} {t("starCatalog.repos")}</span>
          </div>
        )}

        {/* 仓库卡片网格 */}
        {!loading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredRepos.map((repo) => (
              <Card key={repo.full_name} className="glass-panel transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  {/* 仓库名 */}
                  <Link
                    to={repoDetailPath(repo)}
                    className="font-medium text-primary hover:underline line-clamp-1"
                  >
                    {repo.full_name}
                  </Link>

                  {/* 描述 */}
                  <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                    {repo.description || t("starCatalog.noDesc")}
                  </p>

                  {/* 标签 */}
                  {repo.allTags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {repo.allTags.slice(0, 4).map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className={`text-[10px] cursor-pointer ${selectedTags.includes(tag) ? "border-primary text-primary" : ""}`}
                          onClick={() => toggleTag(tag)}
                        >
                          {tag}
                        </Badge>
                      ))}
                      {repo.allTags.length > 4 && (
                        <span className="text-[10px] text-muted-foreground">+{repo.allTags.length - 4}</span>
                      )}
                    </div>
                  )}

                  {/* 统计信息 */}
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium text-on-surface">{formatStars(repo.stars)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <GitFork className="h-3.5 w-3.5" />
                      <span className="font-medium text-on-surface">{formatStars(repo.forks)}</span>
                    </div>
                    {repo.language && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {repo.language}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* 无结果 */}
            {filteredRepos.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <p className="text-muted-foreground">{t("starCatalog.noResults")}</p>
              </div>
            )}

            {/* 无标签数据 */}
            {repos.length === 0 && !isDemoMode && (
              <div className="col-span-full py-20 text-center">
                <p className="text-muted-foreground">{t("starCatalog.noTags")}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default StarCatalog
