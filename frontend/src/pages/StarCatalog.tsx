/**
 * StarCatalog.tsx
 * 星项目目录页 - 按标签分类浏览视图（类似 Awesome-list）
 * 展示所有仓库按标签分组，支持搜索筛选、展开/折叠
 */

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Star, GitFork, ChevronDown, ChevronRight } from "lucide-react"
import { getRepos, getTags } from "@/lib/api"
import type { Repo } from "@/lib/api"
import { useDeveloper } from "@/contexts/DeveloperContext"

// 格式化星数
function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function repoDetailPath(repo: Repo): string {
  const [owner, name] = repo.full_name.split("/")
  return `/repo/${encodeURIComponent(repo.owner || owner || "")}/${encodeURIComponent(repo.name || name || "")}`
}

const StarCatalog: React.FC = () => {
  const { t } = useTranslation()
  const { currentLogin } = useDeveloper()

  // 数据状态
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([])
  const [repos, setRepos] = useState<(Repo & { tags: string[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [isDemoMode, setIsDemoMode] = useState(false)

  // UI 状态
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())

  // 加载标签和仓库数据
  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      try {
        const [tagsRes, reposRes] = await Promise.all([
          getTags(currentLogin),
          getRepos(currentLogin, { pageSize: 10000 }),
        ])

        if (cancelled) return

        // 判断是否为 demo 模式（API 不可用时使用本地 demo 数据）
        const hasRepos = reposRes.items && reposRes.items.length > 0
        const hasTags = tagsRes && tagsRes.length > 0

        if (hasTags && hasRepos) {
          // API 正常，使用真实数据
          setTags(tagsRes)
          setRepos(reposRes.items)
          setIsDemoMode(false)
        } else {
          setTags([])
          setRepos([])
          setIsDemoMode(true)
        }
      } catch {
        if (!cancelled) {
          setTags([])
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

  // 默认展开前 3 个标签（按 count 降序）
  useEffect(() => {
    if (tags.length > 0 && expandedTags.size === 0) {
      const top3 = [...tags].sort((a, b) => b.count - a.count).slice(0, 3).map(t => t.tag)
      setExpandedTags(new Set(top3))
    }
  }, [tags])

  // 搜索过滤
  const filteredRepos = useMemo(() => {
    if (!searchQuery.trim()) return repos
    const q = searchQuery.toLowerCase()
    return repos.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    )
  }, [repos, searchQuery])

  // 按标签分组的仓库
  const tagSections = useMemo(() => {
    return tags.map((tagInfo) => {
      const tagRepos = filteredRepos.filter((r) => r.tags?.includes(tagInfo.tag))
      return { ...tagInfo, repos: tagRepos }
    })
  }, [tags, filteredRepos])

  // 切换标签展开/折叠
  const toggleTag = useCallback((tag: string) => {
    setExpandedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) {
        next.delete(tag)
      } else {
        next.add(tag)
      }
      return next
    })
  }, [])

  // 点击标签时滚动到对应 section
  const scrollToTag = useCallback((tag: string) => {
    const el = document.getElementById(`tag-section-${tag}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
      // 同时展开
      if (!expandedTags.has(tag)) {
        toggleTag(tag)
      }
    }
  }, [expandedTags, toggleTag])

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

        {/* 搜索框（Glassmorphism Card） */}
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

        {/* 标签列表（水平滚动） */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tags.map((tagInfo) => (
            <button
              key={tagInfo.tag}
              onClick={() => scrollToTag(tagInfo.tag)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                expandedTags.has(tagInfo.tag)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-on-surface"
              }`}
            >
              <span className="font-medium">{tagInfo.tag}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {tagInfo.count}
              </Badge>
            </button>
          ))}
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">{t("starCatalog.loading")}</p>
          </div>
        )}

        {/* 标签分类内容区 */}
        {!loading && (
          <div className="space-y-6">
            {tagSections.map((section) => (
              <div key={section.tag} id={`tag-section-${section.tag}`}>
                {/* 标签标题行（可点击展开/折叠） */}
                <button
                  onClick={() => toggleTag(section.tag)}
                  className="flex w-full items-center gap-2 rounded-lg p-3 transition-colors hover:bg-surface-container-high/50"
                >
                  {expandedTags.has(section.tag) ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                  <h2 className="text-lg font-semibold text-on-surface">{section.tag}</h2>
                  <Badge variant="secondary" className="text-xs">
                    {section.repos.length} {t("starCatalog.repos")}
                  </Badge>
                </button>

                {/* 仓库卡片网格 */}
                {expandedTags.has(section.tag) && (
                  <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {section.repos.map((repo) => (
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
                          <p className="mt-1.5 text-sm text-muted-foreground line-clamp-1">
                            {repo.description || t("starCatalog.noDesc")}
                          </p>

                          {/* 统计信息 */}
                          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                            {/* Stars */}
                            <div className="flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 text-primary" />
                              <span className="font-medium text-on-surface">{formatStars(repo.stars)}</span>
                            </div>
                            {/* Forks */}
                            <div className="flex items-center gap-1">
                              <GitFork className="h-3.5 w-3.5" />
                              <span className="font-medium text-on-surface">{formatStars(repo.forks)}</span>
                            </div>
                            {/* Language */}
                            {repo.language && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {repo.language}
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {/* 无仓库 */}
                    {section.repos.length === 0 && (
                      <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
                        {t("starCatalog.noReposInTag")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* 无标签数据 */}
            {tags.length === 0 && (
              <div className="py-20 text-center">
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
