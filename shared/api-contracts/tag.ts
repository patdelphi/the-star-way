/**
 * 标签相关 API 契约类型
 * 跨 Node 后端和 Cloudflare Worker 共用
 */

// 仓库标签行（数据库 repo_tags 表）
export interface RepoTagRow {
  repo_full_name: string
  tag: string
  tag_source: 'topic' | 'name' | 'description' | 'manual'
  confidence: number // 0.00 ~ 1.00
}

// 标签摘要（API 返回，含中英文 label）
export interface TagSummary {
  tag: string
  count: number
  label: string
}
