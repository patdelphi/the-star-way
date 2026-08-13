/**
 * 同步相关 API 契约类型
 * 跨 Node 后端和 Cloudflare Worker 共用
 * GitHub API 原始响应类型保留在 backend 本地（因依赖 sync/errors）
 */

// GitHub rate limit 响应头
export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number // Unix 时间戳
  used: number
}

// 同步结果
export interface SyncResult {
  username: string
  syncedAt: string
  reposUpserted: number
  starsUpserted: number
  reposMarkedRemoved: number
  totalPages: number
  rateLimit: RateLimitInfo | null
  complete: boolean
  /** 当前批次对应的 sync_runs.id，未完成时用于续传。 */
  syncId?: number
  /** 下一次请求应从 GitHub 哪一页开始。 */
  nextPage?: number
  warning?: string
  /** 本次同步抓取到的自有公开仓库数量（非必填，抓取失败或无数据时可为 0）。 */
  ownedReposUpserted?: number
  /** 标记为已移除（removed）的自有仓库数量。 */
  ownedReposRemoved?: number
  /** 自有仓库抓取失败时的错误信息（不影响标星同步结果）。 */
  ownedFetchError?: string | null
}

// 同步运行记录（数据库 sync_runs 表）
export interface SyncRunRow {
  user_login: string
  started_at: string
  finished_at: string | null
  status: 'running' | 'success' | 'partial' | 'failed'
  repos_synced: number | null
  stars_synced: number | null
  error_message: string | null
}
