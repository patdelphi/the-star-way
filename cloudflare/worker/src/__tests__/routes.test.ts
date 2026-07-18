/**
 * Worker 路由处理器测试
 * 验证 MVP 全部路由、CORS 预检、错误格式、501 响应
 *
 * 测试策略：
 * - 使用 Miniflare 创建 D1 实例
 * - 直接调用 handleRequest，传入 mock Request 和 env
 * - 不测试 /api/sync（依赖外部 GitHub API，在 github-sync.test.ts 中覆盖）
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { Miniflare } from 'miniflare'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleRequest } from '../routes.js'
import type { Env } from '../env.js'

// 当前文件所在目录
const __dirname = dirname(fileURLToPath(import.meta.url))

// migration SQL 文件路径
const MIGRATION_PATHS = [
  resolve(__dirname, '..', '..', '..', 'd1', 'migrations', '0001_init.sql'),
  resolve(__dirname, '..', '..', '..', 'd1', 'migrations', '0002_star_sync_continuation.sql'),
  resolve(__dirname, '..', '..', '..', 'd1', 'migrations', '0003_stars_repo_full_name_index.sql'),
]

let mf: Miniflare
let env: Env

/**
 * 初始化 miniflare 并加载 D1 schema
 */
async function setupMiniflare(): Promise<Miniflare> {
  const mf = new Miniflare({
    modules: true,
    script: `export default { fetch() { return new Response('ok') } }`,
    d1Databases: ['DB'],
  })

  const d1 = await mf.getD1Database('DB')
  for (const migrationPath of MIGRATION_PATHS) {
    const migrationSql = readFileSync(migrationPath, 'utf-8')
    const cleanSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
    const statements = cleanSql.split(';').map(s => s.trim()).filter(s => s.length > 0)
    await d1.batch(statements.map(s => d1.prepare(s)))
  }

  return mf
}

/**
 * 构造测试用 Request
 */
function makeRequest(method: string, path: string, body?: unknown): Request {
  const url = `https://worker.test${path}`
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  return new Request(url, init)
}

/**
 * 构造 mock ExecutionContext
 */
function mockCtx(): ExecutionContext {
  return {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext
}

/**
 * 插入测试数据：1 个用户 + 3 个仓库 + 3 条星标 + 2 个标签 + 1 条 sync_run
 */
async function seedTestData(): Promise<void> {
  const now = new Date().toISOString()
  const d1 = env.DB

  // 用户
  await d1.prepare(`
    INSERT INTO users (login, avatar_url, profile_url, synced_at, name, bio, company, location, followers, public_repos, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).bind(
    'testuser', 'https://avatars.test/testuser.png',
    'https://github.com/testuser', now,
    'Test User', 'Test bio', 'Test Co', 'Earth',
    100, 50,
  ).run()

  // 仓库
  const repos = [
    {
      github_id: 1, full_name: 'testuser/repo1', owner: 'testuser', name: 'repo1',
      html_url: 'https://github.com/testuser/repo1', description: 'First test repo',
      language: 'Python', license: 'MIT', stars: 100, forks: 10, open_issues: 5,
      topics_json: '["python", "ai", "llm"]', created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z', pushed_at: now, archived: 0, fork: 0, homepage: null,
    },
    {
      github_id: 2, full_name: 'testuser/repo2', owner: 'testuser', name: 'repo2',
      html_url: 'https://github.com/testuser/repo2', description: 'Second test repo',
      language: 'TypeScript', license: 'MIT', stars: 500, forks: 20, open_issues: 2,
      topics_json: '["typescript", "react"]', created_at: '2024-02-01T00:00:00Z',
      updated_at: '2024-07-01T00:00:00Z', pushed_at: now, archived: 0, fork: 0, homepage: 'https://test.com',
    },
    {
      github_id: 3, full_name: 'other/repo3', owner: 'other', name: 'repo3',
      html_url: 'https://github.com/other/repo3', description: 'Third repo (GPL)',
      language: 'Python', license: 'GPL-3.0', stars: 50, forks: 5, open_issues: 1,
      topics_json: '["python", "gpl"]', created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-06-01T00:00:00Z', pushed_at: '2023-06-01T00:00:00Z', archived: 0, fork: 0, homepage: null,
    },
  ]

  for (const r of repos) {
    await d1.prepare(`
      INSERT INTO repos (github_id, full_name, owner, name, html_url, description, language, license,
        stars, forks, open_issues, topics_json, created_at, updated_at, pushed_at, archived, fork, homepage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      r.github_id, r.full_name, r.owner, r.name, r.html_url, r.description,
      r.language, r.license, r.stars, r.forks, r.open_issues, r.topics_json,
      r.created_at, r.updated_at, r.pushed_at, r.archived, r.fork, r.homepage,
    ).run()
  }

  // 星标
  await d1.prepare(`
    INSERT INTO stars (user_login, repo_full_name, starred_at, first_seen_at, last_seen_at, removed_at)
    VALUES (?, ?, ?, ?, ?, NULL)
  `).bind('testuser', 'testuser/repo1', '2024-03-01T00:00:00Z', now, now).run()
  await d1.prepare(`
    INSERT INTO stars (user_login, repo_full_name, starred_at, first_seen_at, last_seen_at, removed_at)
    VALUES (?, ?, ?, ?, ?, NULL)
  `).bind('testuser', 'testuser/repo2', '2024-04-01T00:00:00Z', now, now).run()
  await d1.prepare(`
    INSERT INTO stars (user_login, repo_full_name, starred_at, first_seen_at, last_seen_at, removed_at)
    VALUES (?, ?, ?, ?, ?, NULL)
  `).bind('testuser', 'other/repo3', '2024-05-01T00:00:00Z', now, now).run()

  // 标签
  await d1.prepare(`
    INSERT INTO repo_tags (repo_full_name, tag, tag_source, confidence)
    VALUES (?, ?, ?, ?)
  `).bind('testuser/repo1', 'ai', 'topic', 0.95).run()
  await d1.prepare(`
    INSERT INTO repo_tags (repo_full_name, tag, tag_source, confidence)
    VALUES (?, ?, ?, ?)
  `).bind('testuser/repo2', 'frontend', 'topic', 0.95).run()

  // sync_runs
  await d1.prepare(`
    INSERT INTO sync_runs (user_login, started_at, status, ended_at, repos_upserted, stars_upserted, repos_removed, pages_fetched)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind('testuser', now, 'success', now, 3, 3, 0, 1).run()
}

beforeAll(async () => {
  mf = await setupMiniflare()
  const d1 = await mf.getD1Database('DB')
  env = { DB: d1, STARWAY_GITHUB_TOKEN: 'test-token' }
})

afterAll(async () => {
  await mf.dispose()
})

beforeEach(async () => {
  // 每个测试前清空数据并重新加载
  const d1 = env.DB
  await d1.prepare('DELETE FROM translations').run()
  await d1.prepare('DELETE FROM repo_tags').run()
  await d1.prepare('DELETE FROM sync_runs').run()
  await d1.prepare('DELETE FROM stars').run()
  await d1.prepare('DELETE FROM repos').run()
  await d1.prepare('DELETE FROM users').run()
  await seedTestData()
})

afterEach(() => {
  vi.unstubAllGlobals()
  env.STARWAY_AI_BASE_URL = undefined
  env.STARWAY_AI_API_KEY = undefined
  env.STARWAY_AI_MODEL = undefined
})

// ===== CORS 预检 =====
describe('CORS 预检', () => {
  it('OPTIONS 请求返回 204 + CORS 头', async () => {
    const res = await handleRequest(makeRequest('OPTIONS', '/api/users'), env, mockCtx())
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('DELETE')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS')
  })
})

// ===== 全局接口 =====
describe('全局接口', () => {
  it('GET /api/users 返回用户列表', async () => {
    const res = await handleRequest(makeRequest('GET', '/api/users'), env, mockCtx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeInstanceOf(Array)
    expect(body.data.length).toBe(1)
    expect(body.data[0].login).toBe('testuser')
    expect(body.data[0].repoCount).toBe(3)
  })

  it('GET /api/overview 返回全局概览', async () => {
    const res = await handleRequest(makeRequest('GET', '/api/overview'), env, mockCtx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.userCount).toBe(1)
    expect(body.data.repoCount).toBe(3)
    expect(body.data.starTrend).toBeInstanceOf(Array)
    expect(body.data.aiEnabled).toBe(false)
  })

  it('GET /api/overview 支持阈值参数', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/overview?sleepDays=60&gemStarsMin=10&gemStarsMax=200'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
  })

  it('GET /api/status 返回配置状态', async () => {
    const res = await handleRequest(makeRequest('GET', '/api/status'), env, mockCtx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.github.configured).toBe(true)
    expect(body.data.github.source).toBe('STARWAY_GITHUB_TOKEN')
    expect(body.data.ai.configured).toBe(false)
  })

  it('GET /api/token-source 返回 token 来源', async () => {
    const res = await handleRequest(makeRequest('GET', '/api/token-source'), env, mockCtx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.source).toBe('STARWAY_GITHUB_TOKEN')
    expect(body.data.hasToken).toBe(true)
  })
})

// ===== 用户仓库接口 =====
describe('用户仓库接口', () => {
  it('GET /api/users/:login/repos 返回分页仓库列表', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/repos?page=1&pageSize=10'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.items).toBeInstanceOf(Array)
    expect(body.data.items.length).toBe(3)
    expect(body.data.total).toBe(3)
    // 每项应包含 starred_at 和 tags
    expect(body.data.items[0].starred_at).toBeTruthy()
    expect(body.data.items[0].tags).toBeInstanceOf(Array)
  })

  it('GET /api/users/:login/repos 支持语言筛选', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/repos?language=Python'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.items.length).toBe(2) // repo1 和 repo3 都是 Python
    expect(body.data.items.every((r: any) => r.language === 'Python')).toBe(true)
  })

  it('GET /api/users/:login/repos 支持标签筛选', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/repos?tag=ai'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.items.length).toBe(1)
    expect(body.data.items[0].full_name).toBe('testuser/repo1')
  })

  it('GET /api/users/:login/repos 用户不存在返回 404', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/users/nonexistent/repos'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('USER_NOT_FOUND')
  })

  it('GET /api/users/:login/repos/*fullName 返回单个仓库（含斜杠）', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/repos/testuser/repo1'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.full_name).toBe('testuser/repo1')
    expect(body.data.starred_at).toBeTruthy()
    expect(body.data.tags).toBeInstanceOf(Array)
  })

  it('GET /api/users/:login/repos/*fullName 仓库不存在返回 404', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/repos/testuser/notfound'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('REPO_NOT_FOUND')
  })
})

// ===== 用户统计接口 =====
describe('用户统计接口', () => {
  it('GET /api/users/:login/stats 返回统计数据', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/stats'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.languages).toBeInstanceOf(Array)
    expect(body.data.topics).toBeInstanceOf(Array)
    expect(body.data.licenses).toBeInstanceOf(Array)
    expect(body.data.repoCount).toBe(3)
    expect(body.data.activeRepoCount).toBeGreaterThanOrEqual(0)
    expect(body.data.aiEnabled).toBe(false)
  })

  it('GET /api/users/:login/summary 返回用户摘要', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/summary'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
  })

  it('GET /api/users/:login/summary 支持阈值参数', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/summary?sleepDays=90&gemStarsMin=50'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
  })

  it('GET /api/users/:login/tags 返回标签列表（含 label 翻译）', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/tags?lang=zh'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeInstanceOf(Array)
    expect(body.data.length).toBeGreaterThan(0)
    // 每项应含 tag、count、label 字段
    expect(body.data[0].tag).toBeTruthy()
    expect(typeof body.data[0].count).toBe('number')
    expect(body.data[0].label).toBeTruthy()
  })

  it('GET /api/users/:login/tags lang=en 返回英文标签', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/tags?lang=en'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].label).toBeTruthy()
  })

  it('GET /api/users/:login/star-timeline 返回时间轴', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/star-timeline'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeInstanceOf(Array)
  })

  it('GET /api/users/:login/sync-runs 返回同步历史', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/sync-runs'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeInstanceOf(Array)
    expect(body.data.length).toBe(1)
    expect(body.data[0].status).toBe('success')
  })

  it('POST /api/users/:login/classify 执行规则分类', async () => {
    const res = await handleRequest(
      makeRequest('POST', '/api/users/testuser/classify'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.repoCount).toBe(3)
    expect(typeof body.data.tagsCreated).toBe('number')
  })
})

// ===== 全局仓库接口 =====
describe('全局仓库接口', () => {
  it('GET /api/repos/*fullName 返回全局仓库（含斜杠）', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/repos/testuser/repo1'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.full_name).toBe('testuser/repo1')
    expect(body.data.tags).toBeInstanceOf(Array)
    expect(body.data.starred_at).toBeNull() // 全局查询无 starred_at
  })

  it('GET /api/repos/*fullName 仓库不存在返回 404', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/repos/not/found'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('REPO_NOT_FOUND')
  })
})

// ===== AI 接口测试 =====
// AI 未配置时返回 503，有缓存时返回缓存，强制刷新且未配置时返回 503
describe('AI 接口', () => {
  it('GET /api/repos/*/readme-summary 未配置 AI 时返回 503', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/repos/testuser/repo1/readme-summary'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('AI_NOT_CONFIGURED')
  })

  it('GET /api/repos/*/readme-summary 有缓存时返回缓存', async () => {
    // 预写缓存
    const cached = JSON.stringify({
      summary: '缓存的摘要',
      starReason: '缓存的原因',
      reuseAdvice: '缓存的建议',
    })
    await env.DB.prepare(
      `INSERT INTO translations (repo_full_name, target_lang, translated_readme_summary, provider, updated_at)
       VALUES (?, ?, ?, 'ai', ?)`,
    ).bind('testuser/repo1', 'zh', cached, new Date().toISOString()).run()

    const res = await handleRequest(
      makeRequest('GET', '/api/repos/testuser/repo1/readme-summary'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.summary).toBe('缓存的摘要')
    expect(body.data.cached).toBe(true)
  })

  it('GET /api/repos/*/readme-summary force=1 且未配置 AI 时返回 503', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/repos/testuser/repo1/readme-summary?force=1'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('AI_NOT_CONFIGURED')
  })

  it('GET /api/users/:login/star-dna 未配置 AI 时返回 503', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/star-dna'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('AI_NOT_CONFIGURED')
  })

  it('GET /api/users/:login/star-dna 有缓存时返回缓存', async () => {
    const cached = '缓存的 DNA 画像'
    await env.DB.prepare(
      `INSERT INTO translations (repo_full_name, target_lang, translated_readme_summary, provider, updated_at)
       VALUES (?, ?, ?, 'ai', ?)`,
    ).bind('user:testuser', 'dna-zh', cached, new Date().toISOString()).run()

    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/star-dna'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.dna).toBe('缓存的 DNA 画像')
    expect(body.data.cached).toBe(true)
  })

  it('GET /api/users/:login/star-dna 英文缺缓存时翻译中文缓存，不重新生成', async () => {
    env.STARWAY_AI_BASE_URL = 'https://ai.test'
    env.STARWAY_AI_API_KEY = 'test-key'
    env.STARWAY_AI_MODEL = 'test-model'
    await env.DB.prepare(
      `INSERT INTO translations (repo_full_name, target_lang, translated_readme_summary, provider, updated_at)
       VALUES (?, ?, ?, 'ai', ?)`,
    ).bind('user:testuser', 'dna-zh', '缓存 DNA 画像', new Date().toISOString()).run()
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'Cached DNA in English' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/star-dna?lang=en'),
      env,
      mockCtx(),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual({ dna: 'Cached DNA in English', cached: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('GET /api/users/:login/star-dna 中文生成不等待英文翻译', async () => {
    env.STARWAY_AI_BASE_URL = 'https://ai.test'
    env.STARWAY_AI_API_KEY = 'test-key'
    env.STARWAY_AI_MODEL = 'test-model'
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '测试 DNA 画像' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/star-dna?lang=zh&force=1'),
      env,
      mockCtx(),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual({ dna: '测试 DNA 画像', cached: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('GET /api/users/:login/star-dna 最新同步为 partial 时拒绝生成新画像', async () => {
    const now = new Date(Date.now() + 1000).toISOString()
    await env.DB.prepare(`
      INSERT INTO sync_runs (user_login, started_at, status, ended_at, repos_upserted, stars_upserted, repos_removed, pages_fetched, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind('testuser', now, 'partial', now, 2000, 2000, 0, 20, '达到 Worker 同步上限').run()

    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/star-dna?force=1'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('SYNC_INCOMPLETE')
  })

  it('GET /api/users/:login/star-dna 用户不存在时返回 404', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/users/nonexistent-user/star-dna'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('USER_NOT_FOUND')
  })

  it('GET /api/users/:login/learning-path 未配置 AI 时返回 503', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/learning-path'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('AI_NOT_CONFIGURED')
  })

  it('GET /api/users/:login/learning-path 有缓存时返回缓存', async () => {
    const cached = '缓存的学习路径'
    await env.DB.prepare(
      `INSERT INTO translations (repo_full_name, target_lang, translated_readme_summary, provider, updated_at)
       VALUES (?, ?, ?, 'ai', ?)`,
    ).bind('user:testuser', 'learning-zh', cached, new Date().toISOString()).run()

    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/learning-path'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.path).toBe('缓存的学习路径')
    expect(body.data.cached).toBe(true)
  })

  it('GET /api/users/:login/learning-path 英文缺缓存时翻译中文缓存，不重新生成', async () => {
    env.STARWAY_AI_BASE_URL = 'https://ai.test'
    env.STARWAY_AI_API_KEY = 'test-key'
    env.STARWAY_AI_MODEL = 'test-model'
    await env.DB.prepare(
      `INSERT INTO translations (repo_full_name, target_lang, translated_readme_summary, provider, updated_at)
       VALUES (?, ?, ?, 'ai', ?)`,
    ).bind('user:testuser', 'learning-zh', '缓存学习路径', new Date().toISOString()).run()
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'Cached learning path in English' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/learning-path?lang=en'),
      env,
      mockCtx(),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual({ path: 'Cached learning path in English', cached: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('GET /api/users/:login/learning-path 中文生成不等待英文翻译', async () => {
    env.STARWAY_AI_BASE_URL = 'https://ai.test'
    env.STARWAY_AI_API_KEY = 'test-key'
    env.STARWAY_AI_MODEL = 'test-model'
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '## 阶段一：巩固基础\n- 测试学习路径' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/learning-path?lang=zh&force=1'),
      env,
      mockCtx(),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.path).toContain('阶段一')
    expect(body.data.cached).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('GET /api/users/:login/learning-path 最新同步为 partial 时拒绝生成新路径', async () => {
    const now = new Date(Date.now() + 1000).toISOString()
    await env.DB.prepare(`
      INSERT INTO sync_runs (user_login, started_at, status, ended_at, repos_upserted, stars_upserted, repos_removed, pages_fetched, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind('testuser', now, 'partial', now, 2000, 2000, 0, 20, '达到 Worker 同步上限').run()

    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/learning-path?force=1'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('SYNC_INCOMPLETE')
  })

  it('GET /api/users/:login/learning-path lang=en 时返回英文缓存', async () => {
    const cachedEn = 'cached learning path in english'
    await env.DB.prepare(
      `INSERT INTO translations (repo_full_name, target_lang, translated_readme_summary, provider, updated_at)
       VALUES (?, ?, ?, 'ai', ?)`,
    ).bind('user:testuser', 'learning-en', cachedEn, new Date().toISOString()).run()

    const res = await handleRequest(
      makeRequest('GET', '/api/users/testuser/learning-path?lang=en'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.path).toBe('cached learning path in english')
    expect(body.data.cached).toBe(true)
  })
})

// ===== 仍返回 501 的接口 =====
describe('未实现的接口返回 501', () => {
  it('GET /api/repos/*/similar 返回 501', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/repos/testuser/repo1/similar'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(501)
  })

  it('GET /api/export 返回 501', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/export?username=testuser&format=csv'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(501)
  })

  it('DELETE /api/users/:login 返回 501', async () => {
    const res = await handleRequest(
      makeRequest('DELETE', '/api/users/testuser'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(501)
  })

  it('POST /api/repos/*/tags 返回 501', async () => {
    const res = await handleRequest(
      makeRequest('POST', '/api/repos/testuser/repo1/tags'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(501)
  })
})

// ===== 404 处理 =====
describe('404 处理', () => {
  it('未匹配路由返回 404', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/unknown-endpoint'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('未匹配 HTTP 方法返回 404', async () => {
    const res = await handleRequest(
      makeRequest('PUT', '/api/users'),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(404)
  })
})

// ===== 统一响应格式 =====
describe('统一响应格式', () => {
  it('成功响应包装为 { data: ... }', async () => {
    const res = await handleRequest(makeRequest('GET', '/api/users'), env, mockCtx())
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(body).not.toHaveProperty('error')
  })

  it('错误响应格式为 { error: { code, message } }', async () => {
    const res = await handleRequest(
      makeRequest('GET', '/api/users/nonexistent/repos'),
      env,
      mockCtx(),
    )
    const body = await res.json()
    expect(body).toHaveProperty('error')
    expect(body.error).toHaveProperty('code')
    expect(body.error).toHaveProperty('message')
    expect(body).not.toHaveProperty('data')
  })

  it('所有响应含 CORS 头', async () => {
    const res = await handleRequest(makeRequest('GET', '/api/users'), env, mockCtx())
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Content-Type')).toContain('application/json')
  })
})

// ===== /api/sync 缺少 username =====
describe('POST /api/sync 参数校验', () => {
  it('缺少 username 返回 400', async () => {
    const res = await handleRequest(
      makeRequest('POST', '/api/sync', {}),
      env,
      mockCtx(),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('MISSING_USERNAME')
  })
})
