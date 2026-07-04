/**
 * 仓库相关 API 契约类型
 * 跨 Node 后端和 Cloudflare Worker 共用
 */

// 仓库基础信息（数据库 repos 表）
export interface RepoRow {
  github_id: number
  full_name: string
  owner: string
  name: string
  html_url: string
  description: string | null
  language: string | null
  license: string | null
  stars: number
  forks: number
  open_issues: number
  topics_json: string | null // JSON 数组字符串
  created_at: string | null
  updated_at: string | null
  pushed_at: string | null
  archived: number // 0 或 1
  fork: number // 0 或 1
  homepage: string | null
}

// 仓库查询参数
export interface RepoQueryParams {
  userLogin?: string
  language?: string
  tag?: string
  search?: string
  sortBy?: 'stars' | 'forks' | 'open_issues' | 'starred_at' | 'pushed_at'
  sortOrder?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
}

// 仓库列表查询结果（带星标时间和标签）
export interface RepoWithStar {
  repo: RepoRow
  starred_at: string | null
  tags: string[]
}

// 分页仓库列表
export interface RepoListResult {
  items: RepoWithStar[]
  total: number
}

// 前端使用的仓库类型（扁平结构，便于直接渲染）
export interface Repo {
  github_id: number
  full_name: string
  owner: string
  name: string
  description: string | null
  html_url: string
  language: string | null
  license: string | null
  stars: number
  forks: number
  open_issues: number
  pushed_at: string | null
  created_at: string | null
  topics_json: string | null
  archived: number
  fork: number
  homepage: string | null
}
