/**
 * GitHub API Client
 * 支持匿名模式和 token 模式，分页获取 starred repos
 */
import { GitHubSyncError, createSyncError } from './errors.js'

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
}

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
}

/**
 * GitHub API Client 配置
 */
export interface GitHubClientConfig {
  token?: string
  baseUrl?: string // 用于测试 mock
  userAgent?: string
}

/**
 * GitHub API Client
 */
export class GitHubClient {
  private token: string | undefined
  private baseUrl: string
  private userAgent: string

  constructor(config: GitHubClientConfig = {}) {
    this.token = config.token
    this.baseUrl = config.baseUrl ?? 'https://api.github.com'
    this.userAgent = config.userAgent ?? 'the-star-way/1.0.0'
  }

  /**
   * 获取指定用户 starred repos（所有页面）
   * 使用 starred_at media type 获取标星时间
   */
  async listStarredRepos(
    username: string,
    onPage?: (page: number, repos: GitHubStarredRepo[]) => void,
  ): Promise<{ repos: GitHubStarredRepo[]; rateLimit: RateLimitInfo | null }> {
    const allRepos: GitHubStarredRepo[] = []
    let page = 1
    let rateLimit: RateLimitInfo | null = null
    // GitHub 默认每页 100 条，starred repos API 最大也支持 100
    const perPage = 100

    while (true) {
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
      if (data.length < perPage) break

      page++

      // 安全限制：防止无限循环（最多 1000 页 = 10 万条）
      if (page > 1000) {
        throw new GitHubSyncError(
          `用户 ${username} 星标仓库超过 100,000 条，已达到安全上限`,
          'GITHUB_TOO_MANY_STARS',
          undefined,
          false,
        )
      }
    }

    return { repos: allRepos, rateLimit }
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
 * 从 fetch Headers 解析 rate limit（兼容浏览器和 Node）
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
