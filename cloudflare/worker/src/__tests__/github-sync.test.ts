/**
 * Worker 版 GitHub 同步流程测试
 * 验证 syncStars 完整流程：profile 拉取 → 用户创建 → 分页拉取 → batch upsert → markRemoved → sync_runs 更新
 *
 * 测试策略：
 * - 使用 Miniflare 创建 D1 实例
 * - 用 vi.stubGlobal('fetch', ...) mock 全局 fetch，模拟 GitHub API 响应
 * - 调用 syncStars，验证 D1 状态变化（用户、仓库、星标、sync_runs）
 *
 * 覆盖场景：
 * - 正常同步（单页）
 * - 正常同步（多页）
 * - 用户名规范化（@login、URL）
 * - 缺少 token 抛错
 * - GitHub API 失败时 sync_runs 标记为 failed
 * - 用户不存在的 404 错误
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { Miniflare } from 'miniflare'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { syncStars, normalizeGitHubUsername } from '../github-sync.js'
import type { Env } from '../env.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATION_PATH = resolve(__dirname, '..', '..', '..', 'd1', 'migrations', '0001_init.sql')

let mf: Miniflare
let env: Env
let originalFetch: typeof globalThis.fetch

/**
 * 初始化 Miniflare + D1 schema
 */
async function setupMiniflare(): Promise<Miniflare> {
  const mf = new Miniflare({
    modules: true,
    script: `export default { fetch() { return new Response('ok') } }`,
    d1Databases: ['DB'],
  })

  const migrationSql = readFileSync(MIGRATION_PATH, 'utf-8')
  const d1 = await mf.getD1Database('DB')
  const cleanSql = migrationSql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
  const statements = cleanSql.split(';').map(s => s.trim()).filter(s => s.length > 0)
  await d1.batch(statements.map(s => d1.prepare(s)))

  return mf
}

/**
 * 构造 GitHub 用户 profile 响应
 */
function makeProfileResponse(login: string) {
  return {
    login,
    avatar_url: `https://avatars.githubusercontent.com/u/123?v=4`,
    html_url: `https://github.com/${login}`,
    name: 'Test User',
    bio: 'Test bio',
    company: 'Test Co',
    location: 'Earth',
    followers: 42,
    public_repos: 10,
  }
}

/**
 * 构造 GitHub starred repo 响应项
 */
function makeStarredRepo(id: number, fullName: string, starredAt: string, language = 'Python') {
  const [owner, name] = fullName.split('/')
  return {
    starred_at: starredAt,
    repo: {
      id,
      full_name: fullName,
      owner: { login: owner, avatar_url: `https://avatars.githubusercontent.com/u/${id}` },
      name,
      html_url: `https://github.com/${fullName}`,
      description: `${name} test repo`,
      language,
      license: { spdx_id: 'MIT', name: 'MIT License' },
      stargazers_count: id * 10,
      forks_count: id,
      open_issues_count: 1,
      topics: [language.toLowerCase(), 'test'],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
      pushed_at: '2024-06-01T00:00:00Z',
      archived: false,
      fork: false,
      homepage: null,
    },
  }
}

/**
 * 构造 mock fetch 函数
 * @param profileLogin 用于 /users/:login/profile
 * @param starredRepos starred repos 列表
 * @param perPage 每页条数（用于分页测试）
 */
function makeMockFetch(profileLogin: string, starredRepos: any[], perPage = 100) {
  return async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof url === 'string' ? url : url.toString()

    // /user endpoint (validateToken)
    if (urlStr.endsWith('/user')) {
      return new Response(JSON.stringify({ login: profileLogin, avatar_url: 'test' }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'x-ratelimit-remaining': '5000' },
      })
    }

    // /users/:login endpoint (profile)
    const profileMatch = urlStr.match(/\/users\/([^/]+)$/)
    if (profileMatch) {
      const login = decodeURIComponent(profileMatch[1])
      if (login !== profileLogin) {
        return new Response('Not Found', { status: 404 })
      }
      return new Response(JSON.stringify(makeProfileResponse(login)), {
        status: 200,
        headers: { 'content-type': 'application/json', 'x-ratelimit-remaining': '5000' },
      })
    }

    // /users/:login/starred endpoint (分页)
    const starredMatch = urlStr.match(/\/users\/([^/]+)\/starred\?per_page=(\d+)&page=(\d+)/)
    if (starredMatch) {
      const login = decodeURIComponent(starredMatch[1])
      if (login !== profileLogin) {
        return new Response('Not Found', { status: 404 })
      }
      const page = parseInt(starredMatch[3], 10)
      const start = (page - 1) * perPage
      const end = start + perPage
      const pageData = starredRepos.slice(start, end)
      return new Response(JSON.stringify(pageData), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
          'x-ratelimit-used': '1',
        },
      })
    }

    // 默认：未匹配的请求返回 404
    return new Response('Not Found', { status: 404 })
  }
}

beforeAll(async () => {
  mf = await setupMiniflare()
})

afterAll(async () => {
  await mf.dispose()
})

beforeEach(async () => {
  const d1 = await mf.getD1Database('DB')
  env = { DB: d1, STARWAY_GITHUB_TOKEN: 'test-token' }

  // 清空数据
  await d1.prepare('DELETE FROM repo_tags').run()
  await d1.prepare('DELETE FROM sync_runs').run()
  await d1.prepare('DELETE FROM stars').run()
  await d1.prepare('DELETE FROM repos').run()
  await d1.prepare('DELETE FROM users').run()

  // 保存原始 fetch
  originalFetch = globalThis.fetch
})

afterEach(() => {
  // 恢复原始 fetch
  globalThis.fetch = originalFetch
  vi.unstubAllGlobals()
})

// ===== 用户名规范化 =====
describe('normalizeGitHubUsername', () => {
  it('直接 login 输入', () => {
    expect(normalizeGitHubUsername('testuser')).toBe('testuser')
  })

  it('@login 输入', () => {
    expect(normalizeGitHubUsername('@testuser')).toBe('testuser')
  })

  it('GitHub URL 输入', () => {
    expect(normalizeGitHubUsername('https://github.com/testuser')).toBe('testuser')
  })

  it('带首尾空白', () => {
    expect(normalizeGitHubUsername('  testuser  ')).toBe('testuser')
  })

  it('URL 带路径后缀', () => {
    expect(normalizeGitHubUsername('https://github.com/testuser/repo')).toBe('testuser')
  })

  it('空字符串', () => {
    expect(normalizeGitHubUsername('')).toBe('')
  })
})

// ===== 正常同步流程 =====
describe('正常同步流程', () => {
  it('单页同步：写入用户、仓库、星标、sync_runs', async () => {
    const repos = [
      makeStarredRepo(1, 'testuser/repo1', '2024-03-01T00:00:00Z', 'Python'),
      makeStarredRepo(2, 'testuser/repo2', '2024-04-01T00:00:00Z', 'TypeScript'),
    ]
    globalThis.fetch = makeMockFetch('testuser', repos) as any

    const result = await syncStars(env, 'testuser', 'test-token')

    expect(result.username).toBe('testuser')
    expect(result.reposUpserted).toBe(2)
    expect(result.starsUpserted).toBe(2)
    expect(result.reposMarkedRemoved).toBe(0)
    expect(result.totalPages).toBe(1)

    // 验证 D1 状态
    const d1 = env.DB

    // 用户表：1 条记录
    const users = await d1.prepare('SELECT login, name, bio, company FROM users WHERE login = ?').bind('testuser').all<{ login: string; name: string | null; bio: string | null; company: string | null }>()
    expect(users.results.length).toBe(1)
    expect(users.results[0].name).toBe('Test User')
    expect(users.results[0].bio).toBe('Test bio')
    expect(users.results[0].company).toBe('Test Co')

    // 仓库表：2 条记录
    const repoRows = await d1.prepare('SELECT full_name, language, stars FROM repos ORDER BY full_name').all<{ full_name: string; language: string; stars: number }>()
    expect(repoRows.results.length).toBe(2)
    expect(repoRows.results[0].full_name).toBe('testuser/repo1')
    expect(repoRows.results[0].language).toBe('Python')
    expect(repoRows.results[0].stars).toBe(10)

    // 星标表：2 条记录
    const starRows = await d1.prepare('SELECT user_login, repo_full_name, starred_at, removed_at FROM stars ORDER BY repo_full_name').all<{ user_login: string; repo_full_name: string; starred_at: string; removed_at: string | null }>()
    expect(starRows.results.length).toBe(2)
    expect(starRows.results[0].user_login).toBe('testuser')
    expect(starRows.results[0].removed_at).toBeNull()

    // sync_runs 表：1 条成功记录
    const syncRuns = await d1.prepare('SELECT user_login, status, repos_upserted, stars_upserted FROM sync_runs').all<{ user_login: string; status: string; repos_upserted: number; stars_upserted: number }>()
    expect(syncRuns.results.length).toBe(1)
    expect(syncRuns.results[0].user_login).toBe('testuser')
    expect(syncRuns.results[0].status).toBe('success')
    expect(syncRuns.results[0].repos_upserted).toBe(2)
    expect(syncRuns.results[0].stars_upserted).toBe(2)
  })

  it('多页同步：正确分页拉取', async () => {
    // 250 个仓库，每页 100，需要 3 页
    const repos: any[] = []
    for (let i = 1; i <= 250; i++) {
      repos.push(makeStarredRepo(i, `testuser/repo${i}`, '2024-03-01T00:00:00Z'))
    }
    globalThis.fetch = makeMockFetch('testuser', repos) as any

    const result = await syncStars(env, 'testuser', 'test-token')

    expect(result.reposUpserted).toBe(250)
    expect(result.starsUpserted).toBe(250)
    expect(result.totalPages).toBe(3)

    // 验证全部仓库已写入
    const repoCount = await env.DB.prepare('SELECT COUNT(*) as cnt FROM repos').first<{ cnt: number }>()
    expect(repoCount?.cnt).toBe(250)

    // 验证全部星标已写入
    const starCount = await env.DB.prepare('SELECT COUNT(*) as cnt FROM stars WHERE user_login = ?').bind('testuser').first<{ cnt: number }>()
    expect(starCount?.cnt).toBe(250)
  })

  it('超过 Worker 同步上限时标记为 partial，且不标记未拉取的旧星标为 removed', async () => {
    const now = new Date().toISOString()
    const repos: any[] = []
    env.STARWAY_GITHUB_MAX_PAGES = '3'
    for (let i = 1; i <= 350; i++) {
      repos.push(makeStarredRepo(i, `testuser/repo${i}`, '2024-03-01T00:00:00Z'))
    }
    globalThis.fetch = makeMockFetch('testuser', repos) as any

    await env.DB.prepare(`
      INSERT INTO users (login, synced_at, deleted_at)
      VALUES (?, ?, NULL)
    `).bind('testuser', now).run()
    await env.DB.prepare(`
      INSERT INTO repos (github_id, full_name, owner, name, html_url, created_at, updated_at, archived, fork)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      999999,
      'testuser/old-outside-window',
      'testuser',
      'old-outside-window',
      'https://github.com/testuser/old-outside-window',
      now,
      now,
      0,
      0,
    ).run()
    await env.DB.prepare(`
      INSERT INTO stars (user_login, repo_full_name, starred_at, first_seen_at, last_seen_at, removed_at)
      VALUES (?, ?, ?, ?, ?, NULL)
    `).bind('testuser', 'testuser/old-outside-window', now, now, now).run()

    const result = await syncStars(env, 'testuser', 'test-token')

    expect(result.complete).toBe(false)
    expect(result.warning).toContain('同步上限')
    expect(result.reposUpserted).toBe(300)
    expect(result.reposMarkedRemoved).toBe(0)

    const run = await env.DB
      .prepare('SELECT status, error_message, pages_fetched FROM sync_runs WHERE user_login = ? ORDER BY id DESC LIMIT 1')
      .bind('testuser')
      .first<{ status: string; error_message: string | null; pages_fetched: number }>()
    expect(run?.status).toBe('partial')
    expect(run?.error_message).toContain('同步上限')
    expect(run?.pages_fetched).toBe(3)

    const oldStar = await env.DB
      .prepare('SELECT removed_at FROM stars WHERE user_login = ? AND repo_full_name = ?')
      .bind('testuser', 'testuser/old-outside-window')
      .first<{ removed_at: string | null }>()
    expect(oldStar?.removed_at).toBeNull()
  })

  it('用户名规范化：@login 形式输入', async () => {
    const repos = [makeStarredRepo(1, 'testuser/repo1', '2024-03-01T00:00:00Z')]
    globalThis.fetch = makeMockFetch('testuser', repos) as any

    const result = await syncStars(env, '@testuser', 'test-token')
    expect(result.username).toBe('testuser')
  })

  it('用户名规范化：GitHub URL 形式输入', async () => {
    const repos = [makeStarredRepo(1, 'testuser/repo1', '2024-03-01T00:00:00Z')]
    globalThis.fetch = makeMockFetch('testuser', repos) as any

    const result = await syncStars(env, 'https://github.com/testuser', 'test-token')
    expect(result.username).toBe('testuser')
  })

  it('增量同步：标记已移除的星标', async () => {
    // 第一次同步：2 个仓库
    const initialRepos = [
      makeStarredRepo(1, 'testuser/repo1', '2024-03-01T00:00:00Z'),
      makeStarredRepo(2, 'testuser/repo2', '2024-04-01T00:00:00Z'),
    ]
    globalThis.fetch = makeMockFetch('testuser', initialRepos) as any
    await syncStars(env, 'testuser', 'test-token')

    // 第二次同步：只剩 1 个仓库（repo1 被移除）
    const updatedRepos = [makeStarredRepo(1, 'testuser/repo1', '2024-03-01T00:00:00Z')]
    globalThis.fetch = makeMockFetch('testuser', updatedRepos) as any
    const result = await syncStars(env, 'testuser', 'test-token')

    expect(result.reposMarkedRemoved).toBe(1)

    // 验证 repo2 星标被标记 removed_at
    const removedStar = await env.DB
      .prepare('SELECT removed_at FROM stars WHERE user_login = ? AND repo_full_name = ?')
      .bind('testuser', 'testuser/repo2')
      .first<{ removed_at: string | null }>()
    expect(removedStar?.removed_at).not.toBeNull()

    // 验证 repo1 星标未被标记
    const activeStar = await env.DB
      .prepare('SELECT removed_at FROM stars WHERE user_login = ? AND repo_full_name = ?')
      .bind('testuser', 'testuser/repo1')
      .first<{ removed_at: string | null }>()
    expect(activeStar?.removed_at).toBeNull()
  })
})

// ===== 错误处理 =====
describe('错误处理', () => {
  it('缺少 token 抛 GITHUB_NO_TOKEN', async () => {
    await expect(syncStars(env, 'testuser', undefined)).rejects.toThrow(/未配置 STARWAY_GITHUB_TOKEN/)
  })

  it('GitHub 用户不存在抛 GITHUB_NOT_FOUND 并标记 sync_runs 为 failed', async () => {
    // mock /users/nonexistent 返回 404
    globalThis.fetch = makeMockFetch('testuser', []) as any

    await expect(syncStars(env, 'nonexistent', 'test-token')).rejects.toThrow(/用户不存在或仓库不可见/)

    // 用户不存在时，profile 拉取失败，未创建 sync_runs
    const syncRuns = await env.DB.prepare('SELECT COUNT(*) as cnt FROM sync_runs').first<{ cnt: number }>()
    expect(syncRuns?.cnt).toBe(0)
  })

  it('GitHub API 失败时 sync_runs 标记为 failed', async () => {
    // 先创建用户（模拟用户已存在）
    const now = new Date().toISOString()
    await env.DB.prepare('INSERT INTO users (login, synced_at, deleted_at) VALUES (?, ?, NULL)').bind('testuser', now).run()

    // mock profile 成功，但 starred 失败（500）
    const mockFetch = async (url: string | URL | Request, _init?: RequestInit): Promise<Response> => {
      const urlStr = typeof url === 'string' ? url : url.toString()
      if (urlStr.match(/\/users\/[^/]+$/)) {
        return new Response(JSON.stringify(makeProfileResponse('testuser')), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (urlStr.includes('/starred')) {
        return new Response('Server Error', { status: 500 })
      }
      return new Response('Not Found', { status: 404 })
    }
    globalThis.fetch = mockFetch as any

    await expect(syncStars(env, 'testuser', 'test-token')).rejects.toThrow(/GitHub 服务错误/)

    // sync_runs 应标记为 failed
    const syncRuns = await env.DB
      .prepare('SELECT status, error_message FROM sync_runs WHERE user_login = ?')
      .bind('testuser')
      .all<{ status: string; error_message: string | null }>()
    expect(syncRuns.results.length).toBe(1)
    expect(syncRuns.results[0].status).toBe('failed')
    expect(syncRuns.results[0].error_message).toBeTruthy()
  })
})

// ===== 同步结果结构 =====
describe('同步结果结构', () => {
  it('返回 StarSyncResult 标准结构', async () => {
    const repos = [makeStarredRepo(1, 'testuser/repo1', '2024-03-01T00:00:00Z')]
    globalThis.fetch = makeMockFetch('testuser', repos) as any

    const result = await syncStars(env, 'testuser', 'test-token')

    // 验证返回结构完整
    expect(result).toHaveProperty('username')
    expect(result).toHaveProperty('syncedAt')
    expect(result).toHaveProperty('reposUpserted')
    expect(result).toHaveProperty('starsUpserted')
    expect(result).toHaveProperty('reposMarkedRemoved')
    expect(result).toHaveProperty('totalPages')
    expect(result).toHaveProperty('rateLimit')

    // rateLimit 字段
    expect(result.rateLimit).not.toBeNull()
    expect(result.rateLimit).toHaveProperty('remaining')
    expect(result.rateLimit).toHaveProperty('reset')
  })
})
