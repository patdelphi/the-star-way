/**
 * 自有公开项目相关 API 契约类型
 * 跨 Node 后端和 Cloudflare Worker 共用
 * 记录开发者自己发布的公开仓库（owner 为本人，排除 fork）
 */

// 自有项目列表查询参数（复用 RepoQueryParams 的筛选/排序/分页语义）
export interface OwnedReposQueryParams {
  language?: string
  search?: string
  sortBy?: 'stars' | 'forks' | 'open_issues' | 'pushed_at' | 'created_at'
  sortOrder?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
}

// 自有项目统计
export interface OwnedRepoStats {
  repoCount: number
  activeRepoCount: number
  totalStars: number
  languages: { language: string; count: number }[]
  topRepos: Array<{
    full_name: string
    description: string | null
    html_url: string
    language: string | null
    stars: number
    forks: number
    pushed_at: string | null
  }>
  lastSyncedAt: string | null
}