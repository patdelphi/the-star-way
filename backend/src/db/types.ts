/**
 * the-star-way 数据库类型定义
 * 定义所有数据库表的行类型和查询参数类型
 */

// ===== 用户表 =====
export interface UserRow {
  login: string
  avatar_url: string | null
  profile_url: string | null
  synced_at: string | null // ISO 日期字符串
}

// ===== 仓库表 =====
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

// ===== 星标表 =====
export interface StarRow {
  user_login: string
  repo_full_name: string
  starred_at: string | null
  first_seen_at: string
  last_seen_at: string
  removed_at: string | null
}

// ===== 仓库标签表 =====
export interface RepoTagRow {
  repo_full_name: string
  tag: string
  tag_source: string // 'topic' | 'name' | 'description' | 'manual'
  confidence: number // 0.00 ~ 1.00
}

// ===== 翻译缓存表（Phase 7 使用） =====
export interface TranslationRow {
  repo_full_name: string
  target_lang: string
  translated_description: string | null
  translated_readme_summary: string | null
  provider: string | null
  updated_at: string
}

// ===== 分析报告表 =====
export interface AnalysisReportRow {
  user_login: string
  report_type: string
  lang: string
  content_json: string
  created_at: string
}

// ===== 查询参数类型 =====
export interface RepoQueryParams {
  language?: string
  tag?: string
  search?: string
  sortBy?: 'stars' | 'forks' | 'open_issues' | 'starred_at' | 'pushed_at'
  sortOrder?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
}

export interface StarStatsParams {
  userLogin?: string
}

// 统计结果类型
export interface LanguageStat {
  language: string
  count: number
}

export interface TopicStat {
  topic: string
  count: number
}

export interface LicenseStat {
  license: string
  count: number
}

// 仓库列表查询结果（带星标时间）
export interface RepoWithStar {
  repo: RepoRow
  starred_at: string | null
  tags: string[]
}
