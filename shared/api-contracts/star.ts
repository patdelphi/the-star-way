/**
 * 星标关系相关 API 契约类型
 * 跨 Node 后端和 Cloudflare Worker 共用
 */

// 星标关系行（数据库 stars 表）
export interface StarRow {
  user_login: string
  repo_full_name: string
  starred_at: string | null
  first_seen_at: string
  last_seen_at: string
  removed_at: string | null
}

// 星标统计参数
export interface StarStatsParams {
  userLogin?: string
}
