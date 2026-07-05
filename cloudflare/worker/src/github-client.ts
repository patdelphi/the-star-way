/**
 * Worker 版 GitHub API Client
 * 适配 Cloudflare Worker 运行时（使用原生 fetch，无 Node 依赖）
 *
 * 与 backend/src/sync/github-client.ts 的差异：
 * - 使用 Worker 原生 fetch，不引入 node:http
 * - 分页上限 20 页（2000 条），避免 Worker CPU 超时；超过上限返回 partial 语义
 * - 错误类型沿用 backend 的 GitHubSyncError，保持业务语义一致
 *
 * 安全考虑：
 * - 不读取请求 body 中的 token，仅从 env 注入
 * - User-Agent 固定标识，便于 GitHub 侧识别
 */
import { GitHubSyncError, createSyncError } from './sync-errors.js'

// GitHub starred repo API 返回的数据结构（使用 starred_at media type）
export interface GitHubStarredRepo {
  starred_at: string
  repo: {
    id: number
    full_name: string
    owner: { login: string; avatar_url: string }
    name: string
    html_url: string
    description: string | null
    language: string | null
    license: { spdx_id: string; name: string } | null
    stargazers_count: number
    forks_count: number
    open_issues_count: number
    topics: string[]
    created_at: string
    updated_at: string
    pushed_at: string | null
    archived: boolean
    fork: boolean
    homepage: string | null
  }
}

export interface GitHubUserProfile {
  login: string
  avatar_url: string | null
  html_url: string
  name: string | null
  bio: string | null
  company: string | null
  location: string | null
  followers: number
  public_repos: number
}

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number // Unix 时间戳
  used: number
}

/**
 * Worker 版 GitHub Client 配置
 */
export interface GitHubClientConfig {
  token?: string
  baseUrl?: string // 用于测试 mock
  userAgent?: string
  // 可选：最大页数（默认 20 页 = 2000 条），防止 Worker CPU 超时
  maxPages?: number
}

/**
 * Worker 版 GitHub API Client
 */
export class GitHubClient {
  private token: string | undefined
  private baseUrl: string
  private userAgent: string
  private maxPages: number

  constructor(config: GitHubClientConfig = {}) {
    this.token = config.token
    this.baseUrl = config.baseUrl ?? 'https://api.github.com'
    this.userAgent = config.userAgent ?? 'the-star-way-worker/1.0.0'
    // Worker 单次请求需要有上限；超过上限时由同步流程标记为 partial。
    this.maxPages = config.maxPages ?? 20
  }

  /**
   * 获取指定用户 starred repos（限制页数）
   * 使用 starred_at media type 获取标星时间
   * @param username GitHub 用户名
   * @param onPage 每页回调（用于跟踪进度）
   */
  async listStarredRepos(
    username: string,
    onPage?: (page: number, repos: GitHubStarredRepo[]) => void,
  ): Promise<{ repos: GitHubStarredRepo[]; rateLimit: RateLimitInfo | null; totalPages: number; complete: boolean; warning?: string }> {
    const allRepos: GitHubStarredRepo[] = []
    let page = 1
    let rateLimit: RateLimitInfo | null = null
    // GitHub 默认每页 100 条，starred repos API 最大也支持 100
    const perPage = 100

    while (page <= this.maxPages) {
      const url = `${this.baseUrl}/users/${encodeURIComponent(username)}/starred?per_page=${perPage}&page=${page}`
      const response = await this.fetchWithAuth(url)

      if (!response.ok) {
        throw createSyncError(response.status, await response.text())
      }

      rateLimit = parseRateLimitHeaders(response.headers)
      const data = await response.json() as GitHubStarredRepo[]

      if (data.length === 0) break

      allRepos.push(...data)
      onPage?.(page, data)

      // 如果返回数量小于 perPage，说明已经是最后一页
      if (data.length < perPage) {
        return { repos: allRepos, rateLimit, totalPages: page, complete: true }
      }

      page++
    }

    // 达到页数上限时不再声明成功，避免 AI 使用不完整数据生成画像。
    if (allRepos.length >= this.maxPages * perPage) {
      const warning = `用户 ${username} 星标仓库达到 Worker 同步上限 ${this.maxPages * perPage} 条，本次只同步前 ${this.maxPages} 页`
      console.warn(warning)
      return { repos: allRepos, rateLimit, totalPages: this.maxPages, complete: false, warning }
    }

    return { repos: allRepos, rateLimit, totalPages: Math.min(page, this.maxPages), complete: true }
  }

  /**
   * 获取指定 GitHub 用户公开资料
   */
  async getUserProfile(username: string): Promise<GitHubUserProfile> {
    const url = `${this.baseUrl}/users/${encodeURIComponent(username)}`
    const response = await this.fetchWithAuth(url)

    if (!response.ok) {
      throw createSyncError(response.status, await response.text())
    }

    return await response.json() as GitHubUserProfile
  }

  /**
   * 验证 token 是否有效（获取当前认证用户信息）
   * Worker /api/status 调用
   */
  async validateToken(): Promise<{ login: string; avatar_url: string }> {
    if (!this.token) {
      throw new GitHubSyncError('未配置 token', 'GITHUB_NO_TOKEN', undefined, false)
    }

    const response = await this.fetchWithAuth(`${this.baseUrl}/user`)
    if (!response.ok) {
      throw createSyncError(response.status, await response.text())
    }

    return await response.json() as { login: string; avatar_url: string }
  }

  /**
   * 带认证的 fetch 请求
   * Worker 运行时原生支持 fetch，无需 polyfill
   */
  private async fetchWithAuth(url: string): Promise<Response> {
    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
      // 使用 starred_at media type 获取标星时间
      Accept: 'application/vnd.github.star+json',
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    try {
      const response = await fetch(url, { headers })
      return response
    } catch (err) {
      // 网络错误处理
      if (err instanceof TypeError) {
        throw new GitHubSyncError(
          `网络连接失败：${(err as Error).message}`,
          'GITHUB_NETWORK_ERROR',
          undefined,
          true,
        )
      }
      throw new GitHubSyncError(
        `未知网络错误：${(err as Error).message}`,
        'GITHUB_UNKNOWN_ERROR',
        undefined,
        false,
      )
    }
  }
}

/**
 * 从 fetch Headers 解析 rate limit（Worker 与 Node 通用）
 */
function parseRateLimitHeaders(headers: Headers): RateLimitInfo | null {
  const limit = headers.get('x-ratelimit-limit')
  const remaining = headers.get('x-ratelimit-remaining')
  const reset = headers.get('x-ratelimit-reset')
  const used = headers.get('x-ratelimit-used')

  if (!limit || !remaining || !reset) return null

  return {
    limit: parseInt(limit, 10),
    remaining: parseInt(remaining, 10),
    reset: parseInt(reset, 10),
    used: used ? parseInt(used, 10) : 0,
  }
}
