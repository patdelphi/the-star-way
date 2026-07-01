/**
 * API 路由测试
 * 使用 mock 的 http 请求/响应对象测试路由逻辑
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createConnection, initDatabase } from '../../db/connection.js'
import { parseCsv, importCsvRecords, DEMO_USER_LOGIN } from '../../import/csv-importer.js'
import { createRouter, resolveGitHubToken } from '../routes.js'
import type Database from 'better-sqlite3'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const TEST_DB_DIR = join(tmpdir(), 'starway-test-api-' + process.pid)
function getTestDbPath() { return join(TEST_DB_DIR, 'test.db') }
function cleanup() { if (existsSync(TEST_DB_DIR)) rmSync(TEST_DB_DIR, { recursive: true, force: true }) }

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
    cleanup()
    db = createConnection(getTestDbPath())
    initDatabase(db)
    const records = parseCsv(MOCK_CSV)
    importCsvRecords(db, records)
  })

  afterEach(() => {
    db.close()
    cleanup()
  })

  it('GET /api/users 应返回用户列表', async () => {
    const router = createRouter(db)
    const { req, res, getBody } = createMocks('/api/users')
    await router(req, res)
    const data = JSON.parse(getBody())
    expect(data.data).toBeDefined()
    expect(data.data.length).toBeGreaterThanOrEqual(1)
    expect(data.data.some((u: any) => u.login === DEMO_USER_LOGIN)).toBe(true)
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

  it('GET /api/users/:login/tags 应返回标签列表', async () => {
    const router = createRouter(db)
    const { req, res, getBody } = createMocks(`/api/users/${DEMO_USER_LOGIN}/tags`)
    await router(req, res)
    const data = JSON.parse(getBody())
    expect(data.data).toBeDefined()
    // 无分类时可能为空
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
  })

  it('resolveGitHubToken 应优先使用请求 token，其次使用环境变量', () => {
    const old = process.env.STARWAY_GITHUB_TOKEN
    process.env.STARWAY_GITHUB_TOKEN = 'env-token'

    expect(resolveGitHubToken('payload-token')).toBe('payload-token')
    expect(resolveGitHubToken()).toBe('env-token')

    if (old === undefined) delete process.env.STARWAY_GITHUB_TOKEN
    else process.env.STARWAY_GITHUB_TOKEN = old
  })
})
