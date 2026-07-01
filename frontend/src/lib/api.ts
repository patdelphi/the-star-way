/**
 * 前端 API 客户端
 * 封装对后端 API 的 fetch 调用，API 不可用时返回静态 mock 数据（Demo 模式兜底）
 */
// ===== 类型定义 =====

// 仓库基本信息
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
}

// 仓库查询参数
export interface RepoQueryParams {
  language?: string
  tag?: string
  q?: string
  sort?: string
  direction?: string
  page?: number
  pageSize?: number
}

// 分页仓库列表
export interface RepoListResult {
  items: (Repo & { starred_at: string; tags: string[] })[]
  total: number
}

// 统计数据
export interface UserStats {
  languages: { language: string; count: number }[]
  topics: { topic: string; count: number }[]
  licenses: { license: string; count: number }[]
  repoCount: number
  activeRepoCount: number
  aiEnabled: boolean
}

// 用户信息
export interface UserInfo {
  login: string
  avatar_url: string | null
  profile_url: string | null
  synced_at: string | null
}

// API 错误响应
export interface ApiError {
  error: {
    code: string
    message: string
  }
}

// ===== 配置 =====

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3210'
const API_TIMEOUT = 8000 // 普通 API 8 秒超时
const SYNC_TIMEOUT = 180000 // GitHub 同步可能需要多页请求，单独放宽到 3 分钟
const TOKEN_KEY = 'starway-github-token'

// ===== Token 管理 =====

export function getGitHubToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setGitHubToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearGitHubToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

// ===== 工具函数 =====

/**
 * 带超时的 fetch 封装
 * @param url 请求 URL
 * @param options fetch 选项
 */
async function fetchWithTimeout(url: string, options?: RequestInit, timeoutMs = API_TIMEOUT): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 判断 API 是否可用
 */
let apiAvailable: boolean | null = null

async function checkApiAvailable(): Promise<boolean> {
  if (apiAvailable !== null) return apiAvailable
  try {
    const response = await fetchWithTimeout(`${API_BASE}/api/users`, {
      method: 'GET',
    })
    apiAvailable = response.ok
    return apiAvailable
  } catch {
    apiAvailable = false
    return false
  }
}

// ===== API 调用 =====

/**
 * 获取用户列表
 */
export async function getUsers(): Promise<UserInfo[]> {
  try {
    if (await checkApiAvailable()) {
      const res = await fetchWithTimeout(`${API_BASE}/api/users`)
      const data = await res.json()
      return data.data as UserInfo[]
    }
  } catch { /* 忽略错误，降级到 mock */ }
  // Demo 模式兜底
  return [{ login: 'patdelphi', avatar_url: null, profile_url: null, synced_at: null }]
}

/**
 * 获取仓库列表
 */
export async function getRepos(login: string, params: RepoQueryParams = {}): Promise<RepoListResult> {
  try {
    if (await checkApiAvailable()) {
      const query = new URLSearchParams()
      if (params.language) query.set('language', params.language)
      if (params.tag) query.set('tag', params.tag)
      if (params.q) query.set('q', params.q)
      if (params.sort) query.set('sort', params.sort)
      if (params.direction) query.set('direction', params.direction)
      if (params.page) query.set('page', String(params.page))
      if (params.pageSize) query.set('pageSize', String(params.pageSize))

      const res = await fetchWithTimeout(`${API_BASE}/api/users/${login}/repos?${query}`)
      const data = await res.json()
      return data.data as RepoListResult
    }
  } catch { /* 忽略错误，降级到 mock */ }
  // Demo 模式兜底 - 返回空列表
  return { items: [], total: 0 }
}

/**
 * 获取单个仓库详情
 */
export async function getRepo(login: string, fullName: string): Promise<(Repo & { starred_at: string; tags: string[] }) | null> {
  try {
    if (await checkApiAvailable()) {
      const res = await fetchWithTimeout(`${API_BASE}/api/users/${login}/repos/${fullName}`)
      if (res.ok) {
        const data = await res.json()
        return data.data as (Repo & { starred_at: string; tags: string[] })
      }
      return null
    }
  } catch { /* 忽略错误，降级到 mock */ }
  return null
}

/**
 * 获取统计数据
 */
export async function getStats(login: string): Promise<UserStats | null> {
  try {
    if (await checkApiAvailable()) {
      const res = await fetchWithTimeout(`${API_BASE}/api/users/${login}/stats`)
      const data = await res.json()
      return data.data as UserStats
    }
  } catch { /* 忽略错误，降级到 mock */ }
  return null
}

/**
 * 获取标签列表
 */
export async function getTags(login: string): Promise<{ tag: string; count: number }[]> {
  try {
    if (await checkApiAvailable()) {
      const res = await fetchWithTimeout(`${API_BASE}/api/users/${login}/tags`)
      const data = await res.json()
      return data.data as { tag: string; count: number }[]
    }
  } catch { /* 忽略错误，降级到 mock */ }
  return []
}

/**
 * 触发规则分类
 */
export async function classifyRepos(login: string): Promise<{ classified: number; errors: number } | null> {
  try {
    if (await checkApiAvailable()) {
      const res = await fetchWithTimeout(`${API_BASE}/api/users/${login}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      return data.data as { classified: number; errors: number }
    }
  } catch { /* 忽略错误 */ }
  return null
}

/**
 * 触发同步
 */
export async function syncStars(username: string, token?: string): Promise<any | null> {
  try {
    if (await checkApiAvailable()) {
      const body: Record<string, string> = { username }
      if (token) body.token = token
      const res = await fetchWithTimeout(`${API_BASE}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, SYNC_TIMEOUT)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error?.message || '同步失败')
      }
      return data.data
    }
  } catch (err) {
    if (err instanceof Error) throw err
  }
  return null
}

/**
 * 获取用户级统一摘要统计
 */
export async function getUserSummary(login: string): Promise<{
  repoCount: number
  activeRepoCount: number
  tagCount: number
  hiddenGemsCount: number
  sleepStarsCount: number
  licenseRiskCount: number
  lastSyncedAt: string | null
} | null> {
  try {
    if (await checkApiAvailable()) {
      const res = await fetchWithTimeout(`${API_BASE}/api/users/${login}/summary`)
      const data = await res.json()
      return data.data
    }
  } catch { /* 忽略错误 */ }
  return null
}

/**
 * 获取同步历史记录
 */
export async function getSyncRuns(login: string): Promise<{
  id: number
  user_login: string
  started_at: string
  ended_at: string | null
  status: string
  repos_upserted: number
  stars_upserted: number
  repos_removed: number
  pages_fetched: number
  rate_limit_remaining: number | null
  rate_limit_reset: string | null
  error_message: string | null
}[]> {
  try {
    if (await checkApiAvailable()) {
      const res = await fetchWithTimeout(`${API_BASE}/api/users/${login}/sync-runs`)
      const data = await res.json()
      return data.data ?? []
    }
  } catch { /* 忽略错误 */ }
  return []
}

/**
 * 获取已移除的星标仓库
 */
export async function getRemovedStars(login: string): Promise<Repo[]> {
  try {
    if (await checkApiAvailable()) {
      const res = await fetchWithTimeout(`${API_BASE}/api/users/${login}/removed-stars`)
      const data = await res.json()
      return (data.data ?? []).map(adaptApiRepo)
    }
  } catch { /* 忽略错误 */ }
  return []
}

/**
 * 获取仓库 README 中文摘要
 */
export async function getReadmeSummary(fullName: string): Promise<{
  summary: string
  cached: boolean
} | null> {
  try {
    if (await checkApiAvailable()) {
      const res = await fetchWithTimeout(`${API_BASE}/api/repos/${encodeURIComponent(fullName)}/readme-summary`)
      const data = await res.json()
      return data.data
    }
  } catch { /* 忽略错误 */ }
  return null
}

/**
 * 获取后端 GitHub Token 来源
 */
export async function getTokenSource(): Promise<{
  source: string | null
  hasToken: boolean
  envVar: string | null
} | null> {
  try {
    if (await checkApiAvailable()) {
      const res = await fetchWithTimeout(`${API_BASE}/api/token-source`)
      const data = await res.json()
      return data.data
    }
  } catch { /* 忽略错误 */ }
  return null
}

/**
 * 为仓库添加手动标签
 */
export async function addRepoTag(fullName: string, tag: string): Promise<boolean> {
  try {
    if (await checkApiAvailable()) {
      const res = await fetchWithTimeout(`${API_BASE}/api/repos/${encodeURIComponent(fullName)}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag }),
      })
      return res.ok
    }
  } catch { /* 忽略错误 */ }
  return false
}

/**
 * 删除仓库标签
 */
export async function removeRepoTag(fullName: string, tag: string): Promise<boolean> {
  try {
    if (await checkApiAvailable()) {
      const res = await fetchWithTimeout(`${API_BASE}/api/repos/${encodeURIComponent(fullName)}/tags/${encodeURIComponent(tag)}`, {
        method: 'DELETE',
      })
      return res.ok
    }
  } catch { /* 忽略错误 */ }
  return false
}

/**
 * 导出数据
 * @param format 导出格式：csv | json | markdown
 * @param login 用户名
 * @returns 导出内容的文本
 */
export async function exportData(
  format: 'csv' | 'json' | 'markdown',
  login: string,
  params: Omit<RepoQueryParams, 'page' | 'pageSize'> = {},
): Promise<string | null> {
  try {
    if (await checkApiAvailable()) {
      const query = new URLSearchParams({ format, login })
      if (params.language) query.set('language', params.language)
      if (params.tag) query.set('tag', params.tag)
      if (params.q) query.set('q', params.q)
      if (params.sort) query.set('sort', params.sort)
      if (params.direction) query.set('direction', params.direction)

      const res = await fetchWithTimeout(`${API_BASE}/api/export?${query}`)
      if (res.ok) {
        return await res.text()
      }
      return null
    }
  } catch { /* 忽略错误 */ }
  return null
}
