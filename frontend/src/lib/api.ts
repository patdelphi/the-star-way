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
  topics_json: string | null
  archived: number
  fork: number
  homepage: string | null
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

export type RepoWithStar = Repo & { starred_at: string; tags: string[] }

// 统计数据
export interface UserStats {
  languages: { language: string; count: number }[]
  topics: { topic: string; count: number }[]
  licenses: { license: string; count: number }[]
  repoCount: number
  activeRepoCount: number
  aiEnabled: boolean
}

export type GlobalOverview = UserStats & {
  userCount: number
  tagCount: number
  hiddenGemsCount: number
  sleepStarsCount: number
  licenseRiskCount: number
  lastSyncedAt: string | null
  recentStars: {
    full_name: string
    description: string | null
    language: string | null
    starred_at: string
  }[]
  gemRepos: {
    full_name: string
    description: string | null
    html_url: string
    language: string | null
    stars: number
    forks: number
  }[]
  starTrend: { label: string; value: number }[]
}

// 用户信息
export interface UserInfo {
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

// API 错误响应
export interface ApiError {
  error: {
    code: string
    message: string
  }
}

// ===== 配置 =====

const API_BASE = import.meta.env.VITE_API_BASE || ''
const API_TIMEOUT = 8000 // 普通 API 8 秒超时
const AI_TIMEOUT = 60000 // AI 生成接口可能需要 10-30 秒，放宽到 60 秒
const SYNC_TIMEOUT = 180000 // GitHub 同步可能需要多页请求，单独放宽到 3 分钟
const TOKEN_KEY = 'starway-github-token'

// API 错误对象：AI 生成功能需要把后端错误展示给页面，而不是静默降级
export class ApiRequestError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.status = status
  }
}

/**
 * 获取当前 i18n 语言对应的后端 lang 参数
 */
function getLangParam(): string {
  // 从 localStorage 读取语言偏好（与 i18n detection 配置一致）
  const lang = typeof window !== 'undefined' ? localStorage.getItem('starway-lang') : null
  return lang && lang.startsWith('en') ? 'en' : 'zh'
}

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

/** 编码用户 login，避免 @、空格等字符破坏路径参数 */
function encodeLogin(login: string): string {
  return encodeURIComponent(login.trim())
}

/** 统一把不可信 API 数组响应兜底为空数组，避免页面直接 map/length 白屏 */
function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

/** 兜底仓库列表结构，保证调用方总能读取 items/total */
function normalizeRepoList(value: any): RepoListResult {
  const items = safeArray<Repo & { starred_at?: string | null; tags?: string[] }>(value?.items).map((repo) => ({
    ...repo,
    starred_at: repo.starred_at || "",
    tags: safeArray<string>(repo.tags),
  })) as RepoListResult["items"]
  return {
    items,
    total: Number.isFinite(value?.total) ? value.total : items.length,
  }
}

/** 兜底用户统计结构，保证图表和列表读取数组字段时不崩溃 */
function normalizeUserStats(value: any): UserStats {
  return {
    languages: safeArray(value?.languages),
    topics: safeArray(value?.topics),
    licenses: safeArray(value?.licenses),
    repoCount: Number.isFinite(value?.repoCount) ? value.repoCount : 0,
    activeRepoCount: Number.isFinite(value?.activeRepoCount) ? value.activeRepoCount : 0,
    aiEnabled: Boolean(value?.aiEnabled),
  }
}

/** 兜底全局概览结构，避免 Dashboard 处理半结构响应时白屏 */
function normalizeGlobalOverview(value: any): GlobalOverview {
  const stats = normalizeUserStats(value)
  return {
    ...stats,
    userCount: Number.isFinite(value?.userCount) ? value.userCount : 0,
    tagCount: Number.isFinite(value?.tagCount) ? value.tagCount : 0,
    hiddenGemsCount: Number.isFinite(value?.hiddenGemsCount) ? value.hiddenGemsCount : 0,
    sleepStarsCount: Number.isFinite(value?.sleepStarsCount) ? value.sleepStarsCount : 0,
    licenseRiskCount: Number.isFinite(value?.licenseRiskCount) ? value.licenseRiskCount : 0,
    lastSyncedAt: value?.lastSyncedAt ?? null,
    recentStars: safeArray(value?.recentStars),
    gemRepos: safeArray(value?.gemRepos),
    starTrend: safeArray(value?.starTrend),
  }
}

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
 * 读取 JSON API 响应；非 2xx 时抛出带后端 code/message 的异常
 */
async function readJsonDataOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json()
  if (!res.ok) {
    throw new ApiRequestError(
      data?.error?.code || 'API_ERROR',
      data?.error?.message || `请求失败 (${res.status})`,
      res.status,
    )
  }
  return data.data as T
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
      return safeArray<UserInfo>(data.data)
    }
  } catch { /* 忽略错误，降级到 mock */ }
  // Demo 模式兜底
  return [{ login: 'patdelphi', avatar_url: null, profile_url: null, synced_at: null, repoCount: 0, tagCount: 0 }]
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

      const res = await fetchWithTimeout(`${API_BASE}/api/users/${encodeLogin(login)}/repos?${query}`)
      const data = await res.json()
      return normalizeRepoList(data.data)
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
      // 先尝试从当前用户获取
      const res = await fetchWithTimeout(`${API_BASE}/api/users/${encodeLogin(login)}/repos/${encodeURIComponent(fullName)}`)
      if (res.ok) {
        const data = await res.json()
        const repo = data.data as (Repo & { starred_at?: string | null; tags?: string[] }) | null
        return repo ? { ...repo, starred_at: repo.starred_at || "", tags: safeArray<string>(repo.tags) } : null
      }
      // 回退到全局仓库查询
      const globalRes = await fetchWithTimeout(`${API_BASE}/api/repos/${encodeURIComponent(fullName)}`)
      if (globalRes.ok) {
        const data = await globalRes.json()
        const repo = data.data as (Repo & { starred_at?: string | null; tags?: string[] }) | null
        return repo ? { ...repo, starred_at: repo.starred_at || "", tags: safeArray<string>(repo.tags) } : null
      }
      return null
    }
  } catch { /* 忽略错误，降级到 mock */ }
  return null
}

/** 相似项目推荐类型 */
export interface SimilarRepo {
  full_name: string
  description: string | null
  language: string | null
  stars: number
  html_url: string
  reason: string
  score: number
}

/**
 * 获取相似项目推荐
 */
export async function getSimilarRepos(fullName: string): Promise<SimilarRepo[]> {
  try {
    if (await checkApiAvailable()) {
      const res = await fetchWithTimeout(`${API_BASE}/api/repos/${encodeURIComponent(fullName)}/similar`)
      if (res.ok) {
        const data = await res.json()
        return safeArray<SimilarRepo>(data.data)
      }
    }
  } catch { /* 忽略 */ }
  return []
}

/**
 * 获取统计数据
 */
export async function getStats(login: string): Promise<UserStats | null> {
  try {
    if (await checkApiAvailable()) {
      const res = await fetchWithTimeout(`${API_BASE}/api/users/${encodeLogin(login)}/stats`)
      const data = await res.json()
      return normalizeUserStats(data.data)
    }
  } catch { /* 忽略错误，降级到 mock */ }
  return null
}

/**
 * 获取用户按月 star 仓库数量时间轴
 */
export async function getUserStarTimeline(login: string): Promise<Array<{ month: string; count: number }> | null> {
  try {
    if (await checkApiAvailable()) {
      const res = await fetchWithTimeout(`${API_BASE}/api/users/${encodeLogin(login)}/star-timeline`)
      const data = await res.json()
      return safeArray<{ month: string; count: number }>(data.data)
    }
  } catch { /* 忽略错误 */ }
  return null
}

/**
 * 获取数据库全局概览
 */
export async function getGlobalOverview(): Promise<GlobalOverview | null> {
  try {
    if (await checkApiAvailable()) {
      const res = await fetchWithTimeout(`${API_BASE}/api/overview`)
      const data = await res.json()
      return normalizeGlobalOverview(data.data)
    }
  } catch { /* 忽略错误，降级到 mock */ }
  return null
}

/**
 * 获取标签列表
 */
export async function getTags(login: string): Promise<{ tag: string; count: number; label: string }[]> {
  try {
    if (await checkApiAvailable()) {
      const params = new URLSearchParams()
      params.set('lang', getLangParam())
      const res = await fetchWithTimeout(`${API_BASE}/api/users/${encodeLogin(login)}/tags?${params}`)
      const data = await res.json()
      return safeArray<{ tag: string; count: number; label: string }>(data.data)
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
      const res = await fetchWithTimeout(`${API_BASE}/api/users/${encodeLogin(login)}/classify`, {
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
        throw new Error(data?.error?.message || 'SYNC_FAILED')
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
      const res = await fetchWithTimeout(`${API_BASE}/api/users/${encodeLogin(login)}/summary`)
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
      const res = await fetchWithTimeout(`${API_BASE}/api/users/${encodeLogin(login)}/sync-runs`)
      const data = await res.json()
      return safeArray(data.data)
    }
  } catch { /* 忽略错误 */ }
  return []
}

/**
 * 获取已移除的星标仓库
 */
export async function getRemovedStars(login: string): Promise<RepoWithStar[]> {
  try {
    if (await checkApiAvailable()) {
      const res = await fetchWithTimeout(`${API_BASE}/api/users/${encodeLogin(login)}/removed-stars`)
      const data = await res.json()
      return safeArray<Repo & { starred_at?: string | null; tags?: string[] }>(data.data).map((repo) => ({
        ...repo,
        starred_at: repo.starred_at || "",
        tags: repo.tags || [],
      }))
    }
  } catch { /* 忽略错误 */ }
  return []
}

/**
 * 获取仓库 README 中文摘要
 * @param force 为 true 时强制重新生成（忽略缓存）
 */
export interface RepoSummaryResult {
  summary: string
  starReason?: string
  reuseAdvice?: string
  cached: boolean
}

export async function getReadmeSummary(fullName: string, force = false): Promise<RepoSummaryResult | null> {
  try {
    if (await checkApiAvailable()) {
      const params = new URLSearchParams()
      if (force) params.set('force', '1')
      params.set('lang', getLangParam())
      const res = await fetchWithTimeout(`${API_BASE}/api/repos/${encodeURIComponent(fullName)}/readme-summary?${params}`, undefined, AI_TIMEOUT)
      const data = await res.json()
      return data.data
    }
  } catch { /* 忽略错误 */ }
  return null
}

/**
 * 获取开发者 Star DNA 画像
 */
export async function getStarDna(login: string, force = false): Promise<{
  dna: string
  cached: boolean
} | null> {
  if (await checkApiAvailable()) {
    const params = new URLSearchParams()
    if (force) params.set('force', '1')
    params.set('lang', getLangParam())
    const res = await fetchWithTimeout(`${API_BASE}/api/users/${encodeLogin(login)}/star-dna?${params}`, undefined, AI_TIMEOUT)
    return readJsonDataOrThrow<{ dna: string; cached: boolean }>(res)
  }
  return null
}

/**
 * 下载分析报告（Markdown）
 */
export function downloadReport(login: string): void {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const url = `${API_BASE}/api/users/${encodeLogin(login)}/report`
  const a = document.createElement('a')
  a.href = url
  a.download = `${login}-star-report-${ts}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * 获取学习路径推荐
 */
export async function getLearningPath(login: string, force = false): Promise<{
  path: string
  cached: boolean
} | null> {
  if (await checkApiAvailable()) {
    const params = new URLSearchParams()
    if (force) params.set('force', '1')
    params.set('lang', getLangParam())
    const res = await fetchWithTimeout(`${API_BASE}/api/users/${encodeLogin(login)}/learning-path?${params}`, undefined, AI_TIMEOUT)
    return readJsonDataOrThrow<{ path: string; cached: boolean }>(res)
  }
  return null
}

/**
 * 批量获取仓库中文摘要
 */
export async function getCnSummaries(login: string): Promise<Record<string, string>> {
  try {
    if (await checkApiAvailable()) {
      const res = await fetchWithTimeout(`${API_BASE}/api/users/${encodeLogin(login)}/cn-summaries`)
      const data = await res.json()
      return data.data ?? {}
    }
  } catch { /* 忽略错误 */ }
  return {}
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
 * @param format 导出格式：csv | json | markdown | html
 * @param login 用户名
 * @returns 导出内容的文本
 */
export async function exportData(
  format: 'csv' | 'json' | 'markdown' | 'html',
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
