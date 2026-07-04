/**
 * 用户相关 API 契约类型
 * 跨 Node 后端和 Cloudflare Worker 共用
 */

// 用户基础信息（数据库 users 表）
export interface UserRow {
  login: string
  avatar_url: string | null
  profile_url: string | null
  synced_at: string | null // ISO 日期字符串
}

// 用户摘要信息（用户列表 API 返回）
export interface UserSummary {
  login: string
  avatar_url: string | null
  profile_url: string | null
  synced_at: string | null
  name: string | null
  bio: string | null
  company: string | null
  location: string | null
  followers: number | null
  public_repos: number | null
  repoCount: number
  tagCount: number
}

// 前端使用的用户信息（兼容 UserSummary 字段）
export type UserInfo = UserSummary
