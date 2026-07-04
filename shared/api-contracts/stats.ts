/**
 * 统计与概览相关 API 契约类型
 * 跨 Node 后端和 Cloudflare Worker 共用
 */

// 语言分布
export interface LanguageStat {
  language: string
  count: number
}

// 主题分布
export interface TopicStat {
  topic: string
  count: number
}

// License 分布
export interface LicenseStat {
  license: string
  count: number
}

// 用户统计
export interface UserStats {
  languages: LanguageStat[]
  topics: TopicStat[]
  licenses: LicenseStat[]
  repoCount: number
  activeRepoCount: number
  aiEnabled: boolean
}

// 用户摘要（含 Sleep Stars / Hidden Gems）
export interface UserSummaryResult {
  repoCount: number
  activeRepoCount: number
  tagCount: number
  hiddenGemsCount: number
  sleepStarsCount: number
  licenseRiskCount: number
  lastSyncedAt: string | null
}

// 最近星标仓库
export interface RecentStar {
  full_name: string
  description: string | null
  language: string | null
  starred_at: string
}

// 隐藏宝石仓库
export interface GemRepo {
  full_name: string
  description: string | null
  html_url: string
  language: string | null
  stars: number
  forks: number
}

// 星标趋势
export interface StarTrendPoint {
  label: string // YYYY-MM
  value: number
}

// 全局概览
export interface GlobalOverview extends UserStats {
  userCount: number
  tagCount: number
  hiddenGemsCount: number
  sleepStarsCount: number
  licenseRiskCount: number
  lastSyncedAt: string | null
  recentStars: RecentStar[]
  gemRepos: GemRepo[]
  starTrend: StarTrendPoint[]
}
