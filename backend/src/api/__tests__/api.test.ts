/**
 * API 路由测试
 * 使用 mock 的 http 请求/响应对象测试路由逻辑
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createConnection, initDatabase } from '../../db/connection.js'
import { parseCsv, importCsvRecords, DEMO_USER_LOGIN } from '../../import/csv-importer.js'
import { createRouter, resolveGitHubToken } from '../routes.js'
import type Database from 'better-sqlite3'
import type { IncomingMessage, ServerResponse } from 'node:http'


vi.mock('../../ai/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../ai/client.js')>()
  return {
    ...actual,
    generateStarDna: vi.fn(async () => '测试 DNA 画像'),
    generateLearningPath: vi.fn(async () => '## 阶段一：巩固基础\n- 测试学习路径'),
    translateToEnglish: vi.fn(async (text: string) => `EN: ${text}`),
  }
})

const aiClient = await import('../../ai/client.js')

// 使用 :memory: 内存数据库：每个测试独立连接，彻底隔离，避免文件锁导致的数据残留

const MOCK_CSV = `序号,项目名称,星星数量,简介,中文简介,URL,编程语言,License,Forks,Open Issues,Topics,标星时间,最近更新
1,octocat/Hello-World,100,A simple Hello World repo,简单的 Hello World 仓库,https://github.com/octocat/Hello-World,JavaScript,MIT,50,10,"hello, world",2025-06-01,2026-01-15
2,torvalds/linux,200000,Linux kernel,Linux 内核,https://github.com/torvalds/linux,C,GPL-2.0,50000,100,"kernel, linux",2024-01-01,2026-06-30`

let db: Database.Database

// 创建 mock 的 req / res
function createMocks(url: string, method: string = 'GET', body?: string) {
  let bodyEmitted = false
  const req = {
    url,
    method,
    on: (event: string, cb: (...args: any[]) => void) => {
      if (event === 'data' && body && !bodyEmitted) {
        bodyEmitted = true
        cb(Buffer.from(body, 'utf-8'))
      }
      if (event === 'end') {
        cb()
      }
    },
  } as unknown as IncomingMessage

  let statusCode = 0
  let headers: Record<string, string> = {}
  let responseData = ''

  const res = {
    writeHead: (code: number, hdrs?: Record<string, string>) => {
      statusCode = code
      if (hdrs) headers = { ...headers, ...hdrs }
    },
    end: (data?: string) => {
      if (data) responseData = data
    },
  } as unknown as ServerResponse

  return { req, res, getStatusCode: () => statusCode, getHeaders: () => headers, getBody: () => responseData }
}

describe('API 路由', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // :memory: 数据库：每个测试全新实例，无需文件清理
    db = createConnection(':memory:')
    initDatabase(db)
    const records = parseCsv(MOCK_CSV)
    importCsvRecords(db, records)
    importCsvRecords(db, records, 'octocat')
  })

  afterEach(() => {
    db.close()
  })

  it('GET /api/users 应返回用户列表', async () => {
    const router = createRouter(db)
    const { req, res, getBody } = createMocks('/api/users')
    await router(req, res)
    const data = JSON.parse(getBody())
    expect(data.data).toBeDefined()
    expect(data.data.length).toBeGreaterThanOrEqual(1)
    expect(data.data.some((u: any) => u.login === DEMO_USER_LOGIN)).toBe(false)
    expect(data.data.some((u: any) => u.login === 'octocat' && u.repoCount === 2)).toBe(true)
  })

  it('DELETE /api/users/:login 应逻辑删除用户并在重新同步时恢复', async () => {
    const router = createRouter(db)
    const del = createMocks('/api/users/octocat', 'DELETE')
    await router(del.req, del.res)
    expect(del.getStatusCode()).toBe(200)

    let users = createMocks('/api/users')
    await router(users.req, users.res)
    let list = JSON.parse(users.getBody())
    expect(list.data.some((u: any) => u.login === 'octocat')).toBe(false)

    db.prepare(`
      INSERT INTO users (login, synced_at, deleted_at)
      VALUES (?, ?, NULL)
      ON CONFLICT(login) DO UPDATE SET deleted_at = NULL
    `).run('octocat', new Date().toISOString())

    users = createMocks('/api/users')
    await router(users.req, users.res)
    list = JSON.parse(users.getBody())
    expect(list.data.some((u: any) => u.login === 'octocat')).toBe(true)
  })

  it('GET /api/overview 应返回排除 demo-user 的全局概览', async () => {
    const router = createRouter(db)
    const { req, res, getBody } = createMocks('/api/overview')
    await router(req, res)
    const data = JSON.parse(getBody())
    expect(data.data.userCount).toBe(1)
    expect(data.data.repoCount).toBe(2)
    expect(data.data.languages.length).toBeGreaterThan(0)
    expect(data.data.recentStars.length).toBeGreaterThan(0)
  })

  it('GET /api/status 未配置 token 和 AI 时应返回未配置状态', async () => {
    const oldStarway = process.env.STARWAY_GITHUB_TOKEN
    const oldGithub = process.env.GITHUB_TOKEN
    const oldGh = process.env.GH_TOKEN
    const oldAiBase = process.env.STARWAY_AI_BASE_URL
    const oldAiKey = process.env.STARWAY_AI_API_KEY
    const oldAiModel = process.env.STARWAY_AI_MODEL
    process.env.STARWAY_GITHUB_TOKEN = ''
    process.env.GITHUB_TOKEN = ''
    process.env.GH_TOKEN = ''
    process.env.STARWAY_AI_BASE_URL = ''
    process.env.STARWAY_AI_API_KEY = ''
    process.env.STARWAY_AI_MODEL = ''

    const router = createRouter(db)
    const { req, res, getStatusCode, getBody } = createMocks('/api/status')
    await router(req, res)
    expect(getStatusCode()).toBe(200)
    const data = JSON.parse(getBody())
    expect(data.data.github.configured).toBe(false)
    expect(data.data.github.valid).toBe(false)
    expect(data.data.ai.configured).toBe(false)
    expect(data.data.ai.valid).toBe(false)

    if (oldStarway === undefined) delete process.env.STARWAY_GITHUB_TOKEN
    else process.env.STARWAY_GITHUB_TOKEN = oldStarway
    if (oldGithub === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = oldGithub
    if (oldGh === undefined) delete process.env.GH_TOKEN
    else process.env.GH_TOKEN = oldGh
    if (oldAiBase === undefined) delete process.env.STARWAY_AI_BASE_URL
    else process.env.STARWAY_AI_BASE_URL = oldAiBase
    if (oldAiKey === undefined) delete process.env.STARWAY_AI_API_KEY
    else process.env.STARWAY_AI_API_KEY = oldAiKey
    if (oldAiModel === undefined) delete process.env.STARWAY_AI_MODEL
    else process.env.STARWAY_AI_MODEL = oldAiModel
  })

  // ===== 业务阈值 query 参数测试（验证参数解析与回退，数值精确性由 threshold.test.ts 覆盖） =====
  it('GET /api/overview?sleepDays=365&gemStarsMin=200&gemStarsMax=50000 合法参数应正常返回', async () => {
    const router = createRouter(db)
    const { req, res, getStatusCode, getBody } = createMocks('/api/overview?sleepDays=365&gemStarsMin=200&gemStarsMax=50000')
    await router(req, res)
    expect(getStatusCode()).toBe(200)
    const data = JSON.parse(getBody())
    expect(data.data.activeRepoCount).toBeDefined()
    expect(data.data.sleepStarsCount).toBeDefined()
    expect(data.data.hiddenGemsCount).toBeDefined()
  })

  it('GET /api/overview?sleepDays=abc&gemStarsMin=xyz&gemStarsMax=-5 非法参数应回退默认不报错', async () => {
    const router = createRouter(db)
    const { req, res, getStatusCode, getBody } = createMocks('/api/overview?sleepDays=abc&gemStarsMin=xyz&gemStarsMax=-5')
    await router(req, res)
    expect(getStatusCode()).toBe(200)
    const data = JSON.parse(getBody())
    // 非法参数回退默认，与无参请求结果一致
    expect(data.data.activeRepoCount).toBeDefined()
  })

  it('GET /api/users/:login/summary?sleepDays=30&gemStarsMax=200 合法参数应正常返回', async () => {
    const router = createRouter(db)
    const { req, res, getStatusCode, getBody } = createMocks(`/api/users/octocat/summary?sleepDays=30&gemStarsMax=200`)
    await router(req, res)
    expect(getStatusCode()).toBe(200)
    const data = JSON.parse(getBody())
    expect(data.data.hiddenGemsCount).toBeDefined()
    expect(data.data.sleepStarsCount).toBeDefined()
  })

  it('GET /api/users/:login/repos 应返回仓库列表', async () => {
    const router = createRouter(db)
    const { req, res, getBody } = createMocks(`/api/users/${DEMO_USER_LOGIN}/repos`)
    await router(req, res)
    const data = JSON.parse(getBody())
    expect(data.data).toBeDefined()
    expect(data.data.items).toBeDefined()
    expect(data.data.total).toBe(2)
  })

  it('GET /api/users/:login/repos 应支持分页', async () => {
    const router = createRouter(db)
    const { req, res, getBody } = createMocks(`/api/users/${DEMO_USER_LOGIN}/repos?page=1&pageSize=1`)
    await router(req, res)
    const data = JSON.parse(getBody())
    expect(data.data.items).toHaveLength(1)
  })

  it('GET /api/users/:login/repos 应支持语言筛选', async () => {
    const router = createRouter(db)
    const { req, res, getBody } = createMocks(`/api/users/${DEMO_USER_LOGIN}/repos?language=C`)
    await router(req, res)
    const data = JSON.parse(getBody())
    expect(data.data.total).toBe(1)
    expect(data.data.items[0].full_name).toBe('torvalds/linux')
  })

  it('GET /api/users/:login/repos/:fullName 应返回单个仓库', async () => {
    const router = createRouter(db)
    const { req, res, getBody } = createMocks(`/api/users/${DEMO_USER_LOGIN}/repos/torvalds/linux`)
    await router(req, res)
    const data = JSON.parse(getBody())
    expect(data.data.full_name).toBe('torvalds/linux')
    expect(data.data.stars).toBe(200000)
  })

  it('GET /api/users/:login/repos/:fullName 不存在的仓库应返回 404', async () => {
    const router = createRouter(db)
    const { req, res, getBody, getStatusCode } = createMocks(`/api/users/${DEMO_USER_LOGIN}/repos/nonexistent/repo`)
    await router(req, res)
    expect(getStatusCode()).toBe(404)
    const data = JSON.parse(getBody())
    expect(data.error).toBeDefined()
    // 不存在仓库会匹配通配路由 → 返回 REPO_NOT_FOUND 或 NOT_FOUND
    expect(['REPO_NOT_FOUND', 'NOT_FOUND']).toContain(data.error.code)
  })

  it('路径参数编码异常时不应返回 500', async () => {
    const router = createRouter(db)
    const { req, res, getStatusCode } = createMocks('/api/repos/%E0%A4%A')
    await router(req, res)
    expect(getStatusCode()).toBe(404)
  })

  it('GET /api/users/:login/stats 应返回统计数据', async () => {
    const router = createRouter(db)
    const { req, res, getBody } = createMocks(`/api/users/${DEMO_USER_LOGIN}/stats`)
    await router(req, res)
    const data = JSON.parse(getBody())
    expect(data.data.languages).toBeDefined()
    expect(data.data.topics).toBeDefined()
    expect(data.data.licenses).toBeDefined()
    expect(data.data.repoCount).toBe(2)
    expect(data.data.aiEnabled).toBeDefined()
  })

  it('用户级 API 应统一兼容带 @ 的用户名', async () => {
    const router = createRouter(db)

    const stats = createMocks(`/api/users/@${DEMO_USER_LOGIN}/stats`)
    await router(stats.req, stats.res)
    expect(stats.getStatusCode()).toBe(200)
    expect(JSON.parse(stats.getBody()).data.repoCount).toBe(2)

    const repos = createMocks(`/api/users/@${DEMO_USER_LOGIN}/repos`)
    await router(repos.req, repos.res)
    expect(repos.getStatusCode()).toBe(200)
    expect(JSON.parse(repos.getBody()).data.total).toBe(2)

    const repo = createMocks(`/api/users/@${DEMO_USER_LOGIN}/repos/torvalds/linux`)
    await router(repo.req, repo.res)
    expect(repo.getStatusCode()).toBe(200)
    expect(JSON.parse(repo.getBody()).data.full_name).toBe('torvalds/linux')

    const summary = createMocks(`/api/users/@${DEMO_USER_LOGIN}/summary`)
    await router(summary.req, summary.res)
    expect(summary.getStatusCode()).toBe(200)
    expect(JSON.parse(summary.getBody()).data.repoCount).toBe(2)

    const timeline = createMocks(`/api/users/@${DEMO_USER_LOGIN}/star-timeline`)
    await router(timeline.req, timeline.res)
    expect(timeline.getStatusCode()).toBe(200)
    expect(JSON.parse(timeline.getBody()).data.length).toBeGreaterThan(0)

    const exportJson = createMocks(`/api/export?format=json&login=@${DEMO_USER_LOGIN}`)
    await router(exportJson.req, exportJson.res)
    expect(exportJson.getStatusCode()).toBe(200)
    expect(JSON.parse(exportJson.getBody()).login).toBe(DEMO_USER_LOGIN)

    const report = createMocks(`/api/users/@${DEMO_USER_LOGIN}/report`)
    await router(report.req, report.res)
    expect(report.getStatusCode()).toBe(200)
    expect(report.getBody()).toContain(`**用户**: \`${DEMO_USER_LOGIN}\``)
  })

  it('GET /api/users/:login/tags 应返回标签列表', async () => {
    const router = createRouter(db)
    const { req, res, getBody } = createMocks(`/api/users/${DEMO_USER_LOGIN}/tags`)
    await router(req, res)
    const data = JSON.parse(getBody())
    expect(data.data).toBeDefined()
    // 无分类时可能为空
  })

  it('GET /api/users/:login/star-dna 用户不存在应返回 404', async () => {
    const router = createRouter(db)
    const { req, res, getBody, getStatusCode } = createMocks('/api/users/missing/star-dna')
    await router(req, res)

    const data = JSON.parse(getBody())
    expect(getStatusCode()).toBe(404)
    expect(data.error.code).toBe('USER_NOT_FOUND')
    expect(vi.mocked(aiClient.generateStarDna)).not.toHaveBeenCalled()
  })

  it('GET /api/users/:login/learning-path 无星标数据应返回 400', async () => {
    db.prepare('INSERT INTO users (login) VALUES (?)').run('empty-user')
    const router = createRouter(db)
    const { req, res, getBody, getStatusCode } = createMocks('/api/users/empty-user/learning-path')
    await router(req, res)

    const data = JSON.parse(getBody())
    expect(getStatusCode()).toBe(400)
    expect(data.error.code).toBe('EMPTY_STAR_DATA')
    expect(vi.mocked(aiClient.generateLearningPath)).not.toHaveBeenCalled()
  })

  it('GET /api/users/:login/star-dna 应优先返回缓存', async () => {
    db.prepare(`
      INSERT INTO translations (repo_full_name, target_lang, translated_readme_summary, provider, updated_at)
      VALUES (?, 'dna-zh', ?, 'ai', ?)
    `).run(`user:${DEMO_USER_LOGIN}`, '缓存 DNA 画像', new Date().toISOString())

    const router = createRouter(db)
    const { req, res, getBody } = createMocks(`/api/users/${DEMO_USER_LOGIN}/star-dna?lang=zh`)
    await router(req, res)

    const data = JSON.parse(getBody())
    expect(data.data).toEqual({ dna: '缓存 DNA 画像', cached: true })
    expect(vi.mocked(aiClient.generateStarDna)).not.toHaveBeenCalled()
  })

  it('GET /api/users/:login/star-dna 应兼容带 @ 的用户名', async () => {
    db.prepare(`
      INSERT INTO translations (repo_full_name, target_lang, translated_readme_summary, provider, updated_at)
      VALUES (?, 'dna-zh', ?, 'ai', ?)
    `).run(`user:${DEMO_USER_LOGIN}`, '缓存 DNA 画像', new Date().toISOString())

    const router = createRouter(db)
    const { req, res, getBody } = createMocks(`/api/users/@${DEMO_USER_LOGIN}/star-dna?lang=zh`)
    await router(req, res)

    const data = JSON.parse(getBody())
    expect(data.data).toEqual({ dna: '缓存 DNA 画像', cached: true })
  })

  it('GET /api/users/:login/star-dna 强制生成失败时应回退已有缓存', async () => {
    db.prepare(`
      INSERT INTO translations (repo_full_name, target_lang, translated_readme_summary, provider, updated_at)
      VALUES (?, 'dna-zh', ?, 'ai', ?)
    `).run(`user:${DEMO_USER_LOGIN}`, '缓存 DNA 画像', new Date().toISOString())
    vi.mocked(aiClient.generateStarDna).mockRejectedValueOnce(new Error('AI unavailable'))

    const router = createRouter(db)
    const { req, res, getBody } = createMocks(`/api/users/${DEMO_USER_LOGIN}/star-dna?lang=zh&force=1`)
    await router(req, res)

    const data = JSON.parse(getBody())
    expect(data.data).toEqual({ dna: '缓存 DNA 画像', cached: true })
  })

  it('GET /api/users/:login/learning-path 应生成并缓存中英文结果', async () => {
    const router = createRouter(db)
    const { req, res, getBody } = createMocks(`/api/users/${DEMO_USER_LOGIN}/learning-path?force=1`)
    await router(req, res)

    const data = JSON.parse(getBody())
    expect(data.data.path).toContain('阶段一')
    expect(data.data.cached).toBe(false)

    const rows = db.prepare(`
      SELECT target_lang, translated_readme_summary
      FROM translations
      WHERE repo_full_name = ?
      ORDER BY target_lang
    `).all(`user:${DEMO_USER_LOGIN}`) as Array<{ target_lang: string; translated_readme_summary: string }>
    expect(rows.map(r => r.target_lang)).toEqual(['learning-en', 'learning-zh'])
    expect(rows.find(r => r.target_lang === 'learning-en')?.translated_readme_summary).toContain('EN:')
  })

  it('GET /api/users/:login/learning-path 强制生成失败时应回退已有缓存', async () => {
    db.prepare(`
      INSERT INTO translations (repo_full_name, target_lang, translated_readme_summary, provider, updated_at)
      VALUES (?, 'learning-zh', ?, 'ai', ?)
    `).run(`user:${DEMO_USER_LOGIN}`, '缓存学习路径', new Date().toISOString())
    vi.mocked(aiClient.generateLearningPath).mockRejectedValueOnce(new Error('AI unavailable'))

    const router = createRouter(db)
    const { req, res, getBody } = createMocks(`/api/users/@${DEMO_USER_LOGIN}/learning-path?lang=zh&force=1`)
    await router(req, res)

    const data = JSON.parse(getBody())
    expect(data.data).toEqual({ path: '缓存学习路径', cached: true })
  })

  it('GET /api/users/不存在的用户/repos 应返回 404', async () => {
    const router = createRouter(db)
    const { req, res, getBody, getStatusCode } = createMocks('/api/users/nonexistent/repos')
    await router(req, res)
    expect(getStatusCode()).toBe(404)
    const data = JSON.parse(getBody())
    expect(data.error.code).toBe('USER_NOT_FOUND')
  })

  it('GET /api/export?format=json 应导出 JSON', async () => {
    const router = createRouter(db)
    const { req, res, getBody, getHeaders } = createMocks(`/api/export?format=json&login=${DEMO_USER_LOGIN}`)
    await router(req, res)
    const data = JSON.parse(getBody())
    expect(data.login).toBe(DEMO_USER_LOGIN)
    expect(data.repos).toBeDefined()
    expect(getHeaders()['Content-Type']).toContain('application/json')
  })

  it('GET /api/export?format=csv 应导出 CSV', async () => {
    const router = createRouter(db)
    const { req, res, getBody, getHeaders } = createMocks(`/api/export?format=csv&login=${DEMO_USER_LOGIN}`)
    await router(req, res)
    expect(getBody().charCodeAt(0)).toBe(0xFEFF) // BOM
    expect(getHeaders()['Content-Type']).toContain('text/csv')
  })

  it('GET /api/export?format=markdown 应导出 Markdown', async () => {
    const router = createRouter(db)
    const { req, res, getBody, getHeaders } = createMocks(`/api/export?format=markdown&login=${DEMO_USER_LOGIN}`)
    await router(req, res)
    expect(getBody()).toContain('| Repository |')
    expect(getHeaders()['Content-Type']).toContain('text/markdown')
  })

  it('未匹配的路由应返回 404', async () => {
    const router = createRouter(db)
    const { req, res, getStatusCode } = createMocks('/api/nonexistent')
    await router(req, res)
    expect(getStatusCode()).toBe(404)
  })

  it('OPTIONS 请求应返回 CORS 头', async () => {
    const router = createRouter(db)
    const { req, res, getStatusCode, getHeaders } = createMocks('/api/users', 'OPTIONS')
    await router(req, res)
    expect(getStatusCode()).toBe(204)
    expect(getHeaders()['Access-Control-Allow-Origin']).toBe('*')
    expect(getHeaders()['Access-Control-Allow-Methods']).toContain('DELETE')
  })

  it('resolveGitHubToken 应优先使用请求 token，其次使用环境变量', () => {
    const oldStarway = process.env.STARWAY_GITHUB_TOKEN
    const oldGithub = process.env.GITHUB_TOKEN
    const oldGh = process.env.GH_TOKEN
    delete process.env.GITHUB_TOKEN
    delete process.env.GH_TOKEN
    process.env.STARWAY_GITHUB_TOKEN = 'env-token'

    expect(resolveGitHubToken('payload-token')).toBe('payload-token')
    expect(resolveGitHubToken()).toBe('env-token')

    delete process.env.STARWAY_GITHUB_TOKEN
    process.env.GITHUB_TOKEN = 'github-token'
    expect(resolveGitHubToken()).toBe('github-token')

    delete process.env.GITHUB_TOKEN
    process.env.GH_TOKEN = 'gh-token'
    expect(resolveGitHubToken()).toBe('gh-token')

    if (oldStarway === undefined) delete process.env.STARWAY_GITHUB_TOKEN
    else process.env.STARWAY_GITHUB_TOKEN = oldStarway
    if (oldGithub === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = oldGithub
    if (oldGh === undefined) delete process.env.GH_TOKEN
    else process.env.GH_TOKEN = oldGh
  })

  it('POST/DELETE /api/repos/:fullName/tags 应支持手动标签增删', async () => {
    const router = createRouter(db)
    const encodedName = encodeURIComponent('octocat/Hello-World')

    const add = createMocks(`/api/repos/${encodedName}/tags`, 'POST', JSON.stringify({ tag: 'manual-check' }))
    await router(add.req, add.res)
    expect(add.getStatusCode()).toBe(200)

    let row = db.prepare(`
      SELECT tag_source, confidence FROM repo_tags
      WHERE repo_full_name = ? AND tag = ?
    `).get('octocat/Hello-World', 'manual-check') as { tag_source: string; confidence: number } | undefined
    expect(row).toEqual({ tag_source: 'manual', confidence: 1 })

    const del = createMocks(`/api/repos/${encodedName}/tags/${encodeURIComponent('manual-check')}`, 'DELETE')
    await router(del.req, del.res)
    expect(del.getStatusCode()).toBe(200)

    row = db.prepare(`
      SELECT tag_source, confidence FROM repo_tags
      WHERE repo_full_name = ? AND tag = ?
    `).get('octocat/Hello-World', 'manual-check') as { tag_source: string; confidence: number } | undefined
    expect(row).toBeUndefined()
  })
})
