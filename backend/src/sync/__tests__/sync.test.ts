/**
 * GitHub 同步模块测试（mock，不调用真实 API）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createConnection, initDatabase, withTransaction } from '../../db/connection.js'
import { syncStars } from '../star-syncer.js'
import { GitHubSyncError, createSyncError } from '../errors.js'
import type Database from 'better-sqlite3'
import type { GitHubStarredRepo, RateLimitInfo } from '../github-client.js'
import { rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const TEST_DB_DIR = join(tmpdir(), 'starway-test-sync-' + process.pid)
function getTestDbPath() { return join(TEST_DB_DIR, 'test.db') }
function cleanup() { if (existsSync(TEST_DB_DIR)) rmSync(TEST_DB_DIR, { recursive: true, force: true }) }

// ===== Mock 数据工厂 =====

function makeMockRepo(overrides: Partial<GitHubStarredRepo['repo']> = {}): GitHubStarredRepo['repo'] {
  return {
    id: 1000 + Math.floor(Math.random() * 100000),
    full_name: 'mock-owner/repo-' + Math.floor(Math.random() * 10000),
    owner: { login: 'mock-owner', avatar_url: 'https://example.com/avatar.png' },
    name: 'repo-' + Math.floor(Math.random() * 10000),
    html_url: 'https://github.com/mock-owner/repo-1',
    description: 'A mock repository for testing',
    language: 'TypeScript',
    license: { spdx_id: 'MIT', name: 'MIT License' },
    stargazers_count: 100,
    forks_count: 10,
    open_issues_count: 5,
    topics: ['test', 'mock'],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    pushed_at: '2026-06-01T00:00:00Z',
    archived: false,
    fork: false,
    homepage: null,
    ...overrides,
  }
}

function makeMockStarredRepo(overrides: Partial<GitHubStarredRepo> = {}): GitHubStarredRepo {
  const repo = makeMockRepo(overrides.repo)
  return {
    starred_at: '2025-06-01T00:00:00Z',
    repo,
    ...overrides,
  }
}

// 3 个固定 mock 仓库
const MOCK_REPOS: GitHubStarredRepo[] = [
  makeMockStarredRepo({
    starred_at: '2025-06-01T00:00:00Z',
    repo: makeMockRepo({
      id: 1001,
      full_name: 'testuser/alpha-project',
      owner: { login: 'testuser', avatar_url: 'https://github.com/testuser.png' },
      name: 'alpha-project',
      html_url: 'https://github.com/testuser/alpha-project',
      language: 'TypeScript',
      stargazers_count: 500,
      forks_count: 50,
      topics: ['typescript', 'web'],
    }),
  }),
  makeMockStarredRepo({
    starred_at: '2025-09-15T00:00:00Z',
    repo: makeMockRepo({
      id: 1002,
      full_name: 'testuser/beta-tool',
      owner: { login: 'testuser', avatar_url: 'https://github.com/testuser.png' },
      name: 'beta-tool',
      html_url: 'https://github.com/testuser/beta-tool',
      language: 'Python',
      license: { spdx_id: 'Apache-2.0', name: 'Apache License 2.0' },
      stargazers_count: 200,
      forks_count: 20,
      topics: ['python', 'cli'],
    }),
  }),
  makeMockStarredRepo({
    starred_at: '2026-01-20T00:00:00Z',
    repo: makeMockRepo({
      id: 1003,
      full_name: 'testuser/gamma-lib',
      owner: { login: 'testuser', avatar_url: 'https://github.com/testuser.png' },
      name: 'gamma-lib',
      html_url: 'https://github.com/testuser/gamma-lib',
      language: 'Rust',
      license: { spdx_id: 'MIT', name: 'MIT License' },
      stargazers_count: 1000,
      forks_count: 100,
      topics: ['rust', 'library'],
    }),
  }),
]

let db: Database.Database
let callCount = 0

// Mock GitHubClient 的 listStarredRepos 方法
vi.mock('../../sync/github-client.js', () => {
  return {
    GitHubClient: vi.fn().mockImplementation(() => ({
      getUserProfile: vi.fn().mockImplementation((username: string) => Promise.resolve({
        login: username,
        avatar_url: `https://github.com/${username}-profile.png`,
        html_url: `https://github.com/${username}`,
      })),
      listStarredRepos: vi.fn().mockImplementation(() => {
        callCount++
        // callCount > 10 时返回 2 个仓库（用于 removed_at 测试）
        if (callCount > 10) {
          return Promise.resolve({
            repos: MOCK_REPOS.slice(1), // 去掉 alpha-project
            rateLimit: null,
          })
        }
        return Promise.resolve({
          repos: MOCK_REPOS,
          rateLimit: { limit: 60, remaining: 55, reset: 1234567890, used: 5 },
        })
      }),
    })),
  }
})

describe('GitHub 同步', () => {
  beforeEach(() => {
    callCount = 0 // 每个测试重置 mock 调用计数
    cleanup()
    db = createConnection(getTestDbPath())
    initDatabase(db)
  })

  afterEach(() => {
    db.close()
    cleanup()
  })

  it('应正确同步 starred repos 到数据库', async () => {
    const result = await syncStars(db, 'testuser')

    expect(result.username).toBe('testuser')
    expect(result.reposUpserted).toBe(3)
    expect(result.starsUpserted).toBe(3)
    expect(result.reposMarkedRemoved).toBe(0)
  })

  it('同步后应可查询仓库和星标', async () => {
    await syncStars(db, 'testuser')

    // 检查用户
    const user = db.prepare('SELECT * FROM users WHERE login = ?').get('testuser')
    expect(user).toBeDefined()
    expect((user as any).synced_at).toBeTruthy()

    // 检查仓库
    const repos = db.prepare('SELECT * FROM repos WHERE full_name = ?').get('testuser/alpha-project')
    expect(repos).toBeDefined()
    expect((repos as any).language).toBe('TypeScript')
    expect((repos as any).stars).toBe(500)

    // 检查星标
    const star = db.prepare('SELECT * FROM stars WHERE user_login = ? AND repo_full_name = ?')
      .get('testuser', 'testuser/alpha-project')
    expect(star).toBeDefined()
    expect((star as any).starred_at).toBe('2025-06-01T00:00:00Z')
    expect((star as any).removed_at).toBeNull()
  })

  it('同步用户头像应来自用户资料而不是仓库 owner', async () => {
    await syncStars(db, 'testuser')

    const user = db.prepare('SELECT avatar_url, profile_url FROM users WHERE login = ?').get('testuser') as any
    expect(user.avatar_url).toBe('https://github.com/testuser-profile.png')
    expect(user.profile_url).toBe('https://github.com/testuser')
  })

  it('重复同步不应产生重复数据', async () => {
    const first = await syncStars(db, 'testuser')
    const second = await syncStars(db, 'testuser')

    expect(first.reposUpserted).toBe(3)
    expect(second.reposUpserted).toBe(3)

    // 仓库总数不变
    const { total } = db.prepare('SELECT COUNT(*) as total FROM repos').get() as { total: number }
    expect(total).toBe(3)

    // 星标总数不变
    const { starTotal } = db.prepare('SELECT COUNT(*) as starTotal FROM stars').get() as { starTotal: number }
    expect(starTotal).toBe(3)
  })

  it('仓库被取消星标应标记 removed_at 而不是删除', async () => {
    // 手动模拟第一次同步：插入 3 个仓库和星标
    const now = '2026-01-01T00:00:00Z'
    db.prepare('INSERT OR IGNORE INTO users (login, synced_at) VALUES (?, ?)').run('testuser', now)
    for (const item of MOCK_REPOS) {
      const repo = item.repo
      db.prepare(`INSERT OR IGNORE INTO repos (github_id, full_name, owner, name, html_url, description, language, license, stars, forks, open_issues, topics_json, created_at, updated_at, pushed_at, archived, fork, homepage) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        repo.id, repo.full_name, repo.owner.login, repo.name, repo.html_url, repo.description,
        repo.language, repo.license?.spdx_id ?? null, repo.stargazers_count, repo.forks_count,
        repo.open_issues_count, JSON.stringify(repo.topics), repo.created_at, repo.updated_at,
        repo.pushed_at, repo.archived ? 1 : 0, repo.fork ? 1 : 0, repo.homepage,
      )
      db.prepare(`INSERT OR IGNORE INTO stars (user_login, repo_full_name, starred_at, first_seen_at, last_seen_at, removed_at) VALUES (?,?,?,?,?,NULL)`).run(
        'testuser', repo.full_name, item.starred_at, now, now,
      )
    }
    expect(db.prepare('SELECT COUNT(*) as cnt FROM repos').get() as any).toEqual({ cnt: 3 })

    // 让 mock 第二次返回 2 个仓库（alpha 被取消星标）
    callCount = 999 // 触发 mock 返回 slice(1)
    const result = await syncStars(db, 'testuser')

    // reposUpserted 是 2（只有 beta 和 gamma）
    expect(result.reposUpserted).toBe(2)
    // reposMarkedRemoved 是 1（alpha 被标记 removed）
    expect(result.reposMarkedRemoved).toBe(1)

    // 仓库记录仍在（不删除）
    const alpha = db.prepare('SELECT * FROM repos WHERE full_name = ?').get('testuser/alpha-project')
    expect(alpha).toBeDefined()

    // 星标记录有 removed_at
    const alphaStar = db.prepare('SELECT * FROM stars WHERE user_login = ? AND repo_full_name = ?')
      .get('testuser', 'testuser/alpha-project') as any
    expect(alphaStar).toBeDefined()
    expect(alphaStar.removed_at).toBeTruthy()
  })

  it('topics 应正确保存为 JSON', async () => {
    await syncStars(db, 'testuser')

    const repo = db.prepare("SELECT topics_json FROM repos WHERE full_name = ?")
      .get('testuser/alpha-project') as { topics_json: string }
    const topics = JSON.parse(repo.topics_json)
    expect(topics).toEqual(['typescript', 'web'])
  })

  it('同步结果应包含 rate limit 信息', async () => {
    const result = await syncStars(db, 'testuser')
    expect(result.rateLimit).not.toBeNull()
    expect(result.rateLimit!.remaining).toBe(55)
  })
})

describe('GitHub 同步错误处理', () => {
  it('createSyncError 应正确分类状态码', () => {
    const err401 = createSyncError(401, 'Unauthorized')
    expect(err401.code).toBe('GITHUB_UNAUTHORIZED')
    expect(err401.retryable).toBe(false)

    const err404 = createSyncError(404, 'Not Found')
    expect(err404.code).toBe('GITHUB_NOT_FOUND')

    const err429 = createSyncError(429, 'Rate limited')
    expect(err429.code).toBe('GITHUB_RATE_LIMITED')

    const err503 = createSyncError(503, 'Service Unavailable')
    expect(err503.code).toBe('GITHUB_SERVER_ERROR')
    expect(err503.retryable).toBe(true)

    const err418 = createSyncError(418, 'I am a teapot')
    expect(err418.code).toBe('GITHUB_API_ERROR')
    expect(err418.retryable).toBe(false)
  })

  it('GitHubSyncError 应继承自 Error', () => {
    const err = new GitHubSyncError('test error', 'TEST_CODE', 500, true)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('test error')
    expect(err.code).toBe('TEST_CODE')
    expect(err.statusCode).toBe(500)
    expect(err.retryable).toBe(true)
  })
})
