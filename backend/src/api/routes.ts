/**
 * 路由定义与处理
 * 所有 API 路由集中管理，使用 Node.js 内置 http 模块
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type Database from 'better-sqlite3'
import { URL } from 'node:url'
import {
  queryRepos,
  queryRepoByNameForUser,
  queryLanguageStats,
  queryTopicStats,
  queryLicenseStats,
  queryRepoCount,
  queryActiveRepoCount,
  queryUserSummary,
  queryUserListSummaries,
  queryGlobalOverview,
  queryUserStarTimeline,
  SYSTEM_DEMO_LOGIN,
  type ThresholdOptions,
} from '../repository/repo-queries.js'
import { classifyReposForUser } from '../classification/classifier.js'
import { syncStars } from '../sync/star-syncer.js'
import { exportCsv, exportJson, exportMarkdown, exportHtml, exportReportMarkdown } from '../export/exporter.js'
import { loadAiConfig } from '../ai/config.js'
import { generateReadmeSummary, generateRepoAnalysis, translateRepoAnalysisToEnglish, translateToEnglish, generateStarDna, generateLearningPath, type RepoAnalysisResult } from '../ai/client.js'
import { getTagLabel } from '../classification/tag-labels-bilingual.js'
import { loadEnv } from '../config/env.js'
import { getUserAiCacheKey } from '@shared/ai/index.js'
import {
  canGenerateUserAiFromSyncStatus,
  getIncompleteSyncMessage,
  type SyncStatus,
} from '@shared/sync/index.js'

// ===== 工具函数 =====

/** 解析查询字符串参数 */
function parseQuery(url: string): Record<string, string> {
  try {
    const u = new URL(url, 'http://localhost')
    const params: Record<string, string> = {}
    u.searchParams.forEach((v, k) => { params[k] = v })
    return params
  } catch {
    return {}
  }
}

/**
 * 从 query 解析业务阈值，非法或越界值回退 undefined（走默认常量）
 * 范围与前端 settings.ts 保持一致：sleepDays 30-365, gemStarsMin 0-10000, gemStarsMax 1-50000
 */
function parseThresholdOptions(query: Record<string, string>): ThresholdOptions | undefined {
  const opts: ThresholdOptions = {}
  let hasAny = false
  const sleepDays = parseInt(query.sleepDays, 10)
  if (Number.isInteger(sleepDays) && sleepDays >= 30 && sleepDays <= 365) {
    opts.sleepDays = sleepDays
    hasAny = true
  }
  const gemStarsMin = parseInt(query.gemStarsMin, 10)
  if (Number.isInteger(gemStarsMin) && gemStarsMin >= 0 && gemStarsMin <= 10000) {
    opts.gemStarsMin = gemStarsMin
    hasAny = true
  }
  const gemStarsMax = parseInt(query.gemStarsMax, 10)
  if (Number.isInteger(gemStarsMax) && gemStarsMax >= 1 && gemStarsMax <= 50000) {
    opts.gemStarsMax = gemStarsMax
    hasAny = true
  }
  // 交叉校验：若 min/max 同时提供但 min >= max，则两者都丢弃走默认
  if (typeof opts.gemStarsMin === 'number' && typeof opts.gemStarsMax === 'number' && opts.gemStarsMin >= opts.gemStarsMax) {
    opts.gemStarsMin = undefined
    opts.gemStarsMax = undefined
  }
  return hasAny ? opts : undefined
}

/** 读取 POST 请求 body（JSON） */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

/** 发送 JSON 响应 */
function json(res: ServerResponse, data: unknown, status = 200): void {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(body)
}

/** 发送错误响应 */
function error(res: ServerResponse, code: string, message: string, status = 400): void {
  json(res, { error: { code, message } }, status)
}

/** 校验用户存在，避免为不存在的 login 生成 AI 内容 */
function ensureUserExists(db: Database.Database, login: string): boolean {
  return !!db.prepare('SELECT login FROM users WHERE login = ? AND deleted_at IS NULL').get(login)
}

/** 规范化 GitHub login，兼容用户输入 @login 的习惯 */
function normalizeGitHubLogin(login: string): string {
  return login.trim().replace(/^@+/, '')
}

/** 安全解码路径参数，避免异常编码直接打断整个请求 */
function decodePathParam(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** 规范化路由中的用户 login，确保所有用户级 API 行为一致 */
function normalizeRouteLogin(login: string): string {
  return normalizeGitHubLogin(decodePathParam(login))
}

/** 读取用户级 AI 文本缓存 */
function getUserAiTextCache(db: Database.Database, login: string, key: string): string | null {
  const cached = db.prepare(`
    SELECT translated_readme_summary
    FROM translations
    WHERE repo_full_name = ? AND target_lang = ?
  `).get(getUserAiCacheKey(login), key) as { translated_readme_summary: string } | undefined
  return cached?.translated_readme_summary || null
}

/** 读取最新同步状态，用于阻止基于不完整数据生成 AI 缓存 */
function getLatestSyncStatus(db: Database.Database, login: string): { status: SyncStatus; error_message: string | null } | null {
  const row = db.prepare(`
    SELECT status, error_message
    FROM sync_runs
    WHERE user_login = ?
    ORDER BY started_at DESC, id DESC
    LIMIT 1
  `).get(login) as { status: SyncStatus; error_message: string | null } | undefined
  return row ?? null
}

/** AI 画像/学习路径依赖完整星标数据，本地和 Worker 使用同一状态语义 */
function assertUserAiDataReady(db: Database.Database, login: string): string | null {
  const latestRun = getLatestSyncStatus(db, login)
  if (!latestRun) return null
  if (canGenerateUserAiFromSyncStatus(latestRun.status)) return null
  return getIncompleteSyncMessage(login, latestRun.status, latestRun.error_message)
}

/** 获取用户星标数量，用于 AI 内容生成前的空数据保护 */
function getUserStarCount(db: Database.Database, login: string): number {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM stars WHERE user_login = ?').get(login) as { cnt: number }
  return row.cnt
}

/** 缓存用户级 AI 文本，所有写入放在同一事务中 */
function cacheUserAiTextPair(
  db: Database.Database,
  login: string,
  zhKey: string,
  zhText: string,
  enKey: string,
  enText: string,
  updatedAt: string,
): void {
  const save = db.transaction(() => {
    db.prepare(`
      INSERT INTO translations (repo_full_name, target_lang, translated_readme_summary, provider, updated_at)
      VALUES (?, ?, ?, 'ai', ?)
      ON CONFLICT(repo_full_name, target_lang) DO UPDATE SET
        translated_readme_summary = excluded.translated_readme_summary,
        provider = excluded.provider,
        updated_at = excluded.updated_at
    `).run(getUserAiCacheKey(login), zhKey, zhText, updatedAt)

    if (enText) {
      db.prepare(`
        INSERT INTO translations (repo_full_name, target_lang, translated_readme_summary, provider, updated_at)
        VALUES (?, ?, ?, 'ai', ?)
        ON CONFLICT(repo_full_name, target_lang) DO UPDATE SET
          translated_readme_summary = excluded.translated_readme_summary,
          provider = excluded.provider,
          updated_at = excluded.updated_at
      `).run(getUserAiCacheKey(login), enKey, enText, updatedAt)
    }
  })

  save()
}

/** 发送文本响应（用于导出） */
function text(res: ServerResponse, content: string, contentType: string, status = 200): void {
  res.writeHead(status, {
    'Content-Type': `${contentType}; charset=utf-8`,
    'Access-Control-Allow-Origin': '*',
  })
  res.end(content)
}

/** 解析同步用 GitHub Token：请求 body 优先，其次读取环境变量 */
export function resolveGitHubToken(payloadToken?: string): string | undefined {
  return payloadToken || process.env.STARWAY_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || undefined
}

/**
 * 获取当前后端 GitHub Token 的来源
 * @returns 来源标识：'STARWAY_GITHUB_TOKEN' | 'GITHUB_TOKEN' | 'GH_TOKEN' | null
 */
export function getGitHubTokenSource(): string | null {
  if (process.env.STARWAY_GITHUB_TOKEN) return 'STARWAY_GITHUB_TOKEN'
  if (process.env.GITHUB_TOKEN) return 'GITHUB_TOKEN'
  if (process.env.GH_TOKEN) return 'GH_TOKEN'
  return null
}

/** 短超时 fetch，用于设置页状态检测，避免外部服务阻塞页面 */
async function fetchStatusWithTimeout(url: string, options: RequestInit, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** 给任意状态探测 Promise 增加超时保护 */
function withStatusTimeout<T>(promise: Promise<T>, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('状态检测超时')), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

/** 校验 OpenAI-compatible 配置是否可访问 */
async function validateAiApi(): Promise<{ configured: boolean; valid: boolean; message: string | null }> {
  const config = loadAiConfig()
  if (!config.enabled) {
    return { configured: false, valid: false, message: 'AI API 未配置完整' }
  }

  try {
    const res = await fetchStatusWithTimeout(`${config.base_url.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.api_key}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0,
      }),
    })
    return {
      configured: true,
      valid: res.ok,
      message: res.ok ? null : `HTTP ${res.status}`,
    }
  } catch (err: any) {
    return { configured: true, valid: false, message: err?.message || 'AI API 校验失败' }
  }
}

/** 校验后端环境变量中的 GitHub Token 是否有效 */
async function validateGitHubToken(): Promise<{ configured: boolean; valid: boolean; source: string | null; message: string | null }> {
  const token = resolveGitHubToken()
  const source = getGitHubTokenSource()
  if (!token) {
    return { configured: false, valid: false, source, message: 'GitHub Token 未配置' }
  }

  try {
    const res = await withStatusTimeout(fetchStatusWithTimeout('https://api.github.com/user', {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'the-star-way',
      },
    }))
    if (!res.ok) {
      return { configured: true, valid: false, source, message: `HTTP ${res.status}` }
    }
    const profile = await res.json() as { login?: string }
    return { configured: true, valid: true, source, message: profile.login || null }
  } catch (err: any) {
    return { configured: true, valid: false, source, message: err?.message || 'GitHub Token 校验失败' }
  }
}

/** 从 URL 路径中提取动态参数（支持 :login, :fullName 等） */
function matchRoute(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split('/')
  const pathParts = pathname.split('/')

  const params: Record<string, string> = {}

  let pi = 0
  let si = 0
  for (; si < pathParts.length && pi < patternParts.length; si++) {
    const p = patternParts[pi]
    const v = pathParts[si]

    if (p === '*') {
      // 通配段：匹配剩余路径中除后续 pattern 段之外的部分
      const afterStar = patternParts.slice(pi + 1)
      if (afterStar.length === 0) {
        // * 后无更多段：匹配剩余所有部分（含 /）
        params['*'] = pathParts.slice(si).join('/')
        return params
      }
      // * 后有段：从路径末尾倒推，保留足够的段给后续 pattern
      const remainingParts = pathParts.slice(si)
      if (remainingParts.length <= afterStar.length) return null
      // * 匹配除最后 afterStar.length 段之外的部分
      const starParts = remainingParts.slice(0, remainingParts.length - afterStar.length)
      params['*'] = starParts.join('/')
      // 继续匹配后续段
      for (let j = 0; j < afterStar.length; j++) {
        const ap = afterStar[j]
        const av = remainingParts[starParts.length + j]
        if (ap.startsWith(':')) {
          params[ap.slice(1)] = av
        } else if (ap !== av) {
          return null
        }
      }
      return params
    }

    if (p.startsWith(':')) {
      params[p.slice(1)] = v
    } else if (p !== v) {
      return null
    }
    pi++
  }

  // 段数必须精确匹配（非通配模式）
  if (pi !== patternParts.length || si !== pathParts.length) return null
  return params
}

// ===== 路由处理器 =====

/**
 * 处理所有 API 请求
 * @param db 数据库连接
 */
export function createRouter(db: Database.Database) {
  // 加载 AI 配置
  const aiConfig = loadAiConfig()

  return async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      // CORS 预检请求
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        })
        res.end()
        return
      }

      const url = req.url || '/'
      const method = req.method || 'GET'

      // ===== GET /api/users =====
      if (method === 'GET' && url === '/api/users') {
        json(res, { data: queryUserListSummaries(db) })
        return
      }

      // ===== DELETE /api/users/:login =====
      const deleteUserMatch = matchRoute('/api/users/:login', url.split('?')[0])
      if (method === 'DELETE' && deleteUserMatch) {
        const login = normalizeRouteLogin(deleteUserMatch.login)
        const result = db.transaction(() => {
          return db.prepare(`
            UPDATE users
            SET deleted_at = ?
            WHERE login = ? AND deleted_at IS NULL
          `).run(new Date().toISOString(), login)
        })()

        if (result.changes === 0) {
          error(res, 'USER_NOT_FOUND', `用户 ${login} 不存在`, 404)
          return
        }

        json(res, { data: { login, deleted: true } })
        return
      }

      // ===== GET /api/overview（支持 sleepDays/gemStarsMin/gemStarsMax query 参数） =====
      if (method === 'GET' && url.split('?')[0] === '/api/overview') {
        const thresholdOpts = parseThresholdOptions(parseQuery(url))
        json(res, { data: { ...queryGlobalOverview(db, thresholdOpts), aiEnabled: aiConfig.enabled } })
        return
      }

      // ===== GET /api/status =====
      if (method === 'GET' && url === '/api/status') {
        loadEnv({ force: true })
        const [github, ai] = await Promise.all([
          validateGitHubToken(),
          validateAiApi(),
        ])
        json(res, { data: { github, ai } })
        return
      }

      // ===== GET /api/repos/*fullName/similar（相似项目推荐，必须在通配路由之前匹配） =====
      const similarMatch = matchRoute('/api/repos/*/similar', url.split('?')[0])
      if (method === 'GET' && similarMatch) {
        const repoFullName = decodePathParam(similarMatch['*'] || '')
        const repo = db.prepare(`SELECT * FROM repos WHERE full_name = ?`).get(repoFullName) as any
        if (!repo) {
          error(res, 'REPO_NOT_FOUND', `仓库 ${repoFullName} 不存在`, 404)
          return
        }

        let currentTopics: string[] = []
        try {
          currentTopics = repo.topics_json ? JSON.parse(repo.topics_json) : []
        } catch { /* 忽略 */ }

        let candidates: Array<{
          full_name: string
          description: string | null
          language: string | null
          stars: number
          html_url: string
          shared_topics: number
          score: number
        }> = []

        if (currentTopics.length > 0) {
          const topicRows = db.prepare(`
            SELECT r.full_name, r.description, r.language, r.stars, r.html_url, r.topics_json
            FROM repos r
            WHERE r.full_name != ?
              AND r.language IS NOT NULL
              AND r.topics_json IS NOT NULL
              AND r.topics_json != '[]'
            LIMIT 5000
          `).all(repoFullName) as Array<any>

          for (const r of topicRows) {
            let rTopics: string[] = []
            try { rTopics = JSON.parse(r.topics_json) } catch { continue }
            const shared = rTopics.filter((t: string) => currentTopics.includes(t))
            if (shared.length === 0) continue
            const sameLang = r.language === repo.language ? 2 : 0
            const starsSimilarity = Math.max(0, 1 - Math.abs(Math.log10(r.stars + 1) - Math.log10(repo.stars + 1)) / 3)
            const score = shared.length * 3 + sameLang + Math.round(starsSimilarity)
            candidates.push({
              full_name: r.full_name,
              description: r.description,
              language: r.language,
              stars: r.stars,
              html_url: r.html_url,
              shared_topics: shared.length,
              score,
            })
          }
        } else if (repo.language) {
          const langRows = db.prepare(`
            SELECT r.full_name, r.description, r.language, r.stars, r.html_url
            FROM repos r
            WHERE r.full_name != ?
              AND r.language = ?
            ORDER BY ABS(r.stars - ?) ASC
            LIMIT 10
          `).all(repoFullName, repo.language, repo.stars) as Array<any>

          for (const r of langRows) {
            const starsSimilarity = Math.max(0, 1 - Math.abs(Math.log10(r.stars + 1) - Math.log10(repo.stars + 1)) / 3)
            candidates.push({
              full_name: r.full_name,
              description: r.description,
              language: r.language,
              stars: r.stars,
              html_url: r.html_url,
              shared_topics: 0,
              score: 2 + Math.round(starsSimilarity),
            })
          }
        }

        candidates.sort((a, b) => b.score - a.score)
        const result = candidates.slice(0, 6).map(c => ({
          full_name: c.full_name,
          description: c.description,
          language: c.language,
          stars: c.stars,
          html_url: c.html_url,
          reason: c.shared_topics > 0
            ? `共享 ${c.shared_topics} 个主题${c.language === repo.language ? ' + 同语言' : ''}`
            : '同语言 + 星标相近',
          score: c.score,
        }))

        json(res, { data: result })
        return
      }

      // ===== GET /api/repos/*fullName（全局仓库查询，直接查 repos 表） =====
      // 排除 /similar、/readme-summary、/tags 等子路由（它们有自己的处理逻辑）
      const globalRepoMatch = matchRoute('/api/repos/*', url.split('?')[0])
      if (method === 'GET' && globalRepoMatch) {
        const fullName = decodePathParam(globalRepoMatch['*'] || '')
        // 如果路径包含子路由后缀，跳过此路由
        if (fullName.endsWith('/similar') || fullName.endsWith('/readme-summary') || fullName.includes('/tags/')) {
          // 不处理，继续后续路由
        } else {
        const row = db.prepare(`SELECT * FROM repos WHERE full_name = ?`).get(fullName) as any
        if (!row) {
          error(res, 'REPO_NOT_FOUND', `仓库 ${fullName} 不存在`, 404)
          return
        }
        const tags = db.prepare(`
          SELECT tag FROM repo_tags WHERE repo_full_name = ?
        `).all(fullName) as { tag: string }[]
        json(res, {
          data: {
            github_id: row.github_id,
            full_name: row.full_name,
            owner: row.owner,
            name: row.name,
            html_url: row.html_url,
            description: row.description,
            language: row.language,
            license: row.license,
            stars: row.stars,
            forks: row.forks,
            open_issues: row.open_issues,
            topics_json: row.topics_json,
            created_at: row.created_at,
            updated_at: row.updated_at,
            pushed_at: row.pushed_at,
            archived: row.archived,
            fork: row.fork,
            homepage: row.homepage,
            starred_at: null,
            tags: tags.map(t => t.tag),
          },
        })
        return
        }
      }

      // ===== GET /api/users/:login/repos =====
      const reposMatch = matchRoute('/api/users/:login/repos', url.split('?')[0])
      if (method === 'GET' && reposMatch) {
        const login = normalizeRouteLogin(reposMatch.login)
        const query = parseQuery(url)

        // 验证用户是否存在
        const user = db.prepare('SELECT login FROM users WHERE login = ? AND deleted_at IS NULL').get(login)
        if (!user) {
          error(res, 'USER_NOT_FOUND', `用户 ${login} 不存在`, 404)
          return
        }

        const result = queryRepos(db, {
          userLogin: login,
          language: query.language,
          tag: query.tag,
          search: query.q || query.search,
          sortBy: (query.sort as any) || 'stars',
          sortOrder: (query.direction as any) || 'DESC',
          limit: parseInt(query.pageSize || query.limit || '20', 10),
          offset: parseInt(query.page ? ((parseInt(query.page, 10) - 1) * parseInt(query.pageSize || '20', 10)).toString() : '0', 10),
        })

        json(res, {
          data: {
            items: result.items.map(item => ({
              ...item.repo,
              starred_at: item.starred_at,
              tags: item.tags,
            })),
            total: result.total,
          },
        })
        return
      }

      // ===== GET /api/users/:login/repos/*fullName（支持 owner/repo 格式） =====
      const repoMatch = matchRoute('/api/users/:login/repos/*', url.split('?')[0])
      if (method === 'GET' && repoMatch) {
        const fullName = decodePathParam(repoMatch['*'] || '')
        const login = normalizeRouteLogin(repoMatch.login)
        const repo = queryRepoByNameForUser(db, login, fullName)
        if (!repo) {
          error(res, 'REPO_NOT_FOUND', `仓库 ${fullName} 不存在`, 404)
          return
        }
        json(res, {
          data: {
            ...repo.repo,
            starred_at: repo.starred_at,
            tags: repo.tags,
          },
        })
        return
      }

      // ===== GET /api/users/:login/stats =====
      const statsMatch = matchRoute('/api/users/:login/stats', url.split('?')[0])
      if (method === 'GET' && statsMatch) {
        const login = normalizeRouteLogin(statsMatch.login)
        const user = db.prepare('SELECT login FROM users WHERE login = ? AND deleted_at IS NULL').get(login)
        if (!user) {
          error(res, 'USER_NOT_FOUND', `用户 ${login} 不存在`, 404)
          return
        }

        json(res, {
          data: {
            languages: queryLanguageStats(db, login),
            topics: queryTopicStats(db, login),
            licenses: queryLicenseStats(db, login),
            repoCount: queryRepoCount(db, login),
            activeRepoCount: queryActiveRepoCount(db, login),
            aiEnabled: aiConfig.enabled,
          },
        })
        return
      }

      // ===== GET /api/users/:login/star-timeline =====
      const timelineMatch = matchRoute('/api/users/:login/star-timeline', url.split('?')[0])
      if (method === 'GET' && timelineMatch) {
        const login = normalizeRouteLogin(timelineMatch.login)
        const user = db.prepare('SELECT login FROM users WHERE login = ? AND deleted_at IS NULL').get(login)
        if (!user) {
          error(res, 'USER_NOT_FOUND', `用户 ${login} 不存在`, 404)
          return
        }
        json(res, { data: queryUserStarTimeline(db, login) })
        return
      }

      // ===== GET /api/users/:login/summary（支持 sleepDays/gemStarsMin/gemStarsMax query 参数） =====
      const summaryMatch = matchRoute('/api/users/:login/summary', url.split('?')[0])
      if (method === 'GET' && summaryMatch) {
        const login = normalizeRouteLogin(summaryMatch.login)
        const user = db.prepare('SELECT login FROM users WHERE login = ? AND deleted_at IS NULL').get(login)
        if (!user) {
          error(res, 'USER_NOT_FOUND', `用户 ${login} 不存在`, 404)
          return
        }

        const thresholdOpts = parseThresholdOptions(parseQuery(url))
        json(res, { data: queryUserSummary(db, login, thresholdOpts) })
        return
      }

      // ===== GET /api/users/:login/tags =====
      const tagsMatch = matchRoute('/api/users/:login/tags', url.split('?')[0])
      if (method === 'GET' && tagsMatch) {
        const login = normalizeRouteLogin(tagsMatch.login)
        const lang = parseQuery(url).lang === 'en' ? 'en' : 'zh'
        const user = db.prepare('SELECT login FROM users WHERE login = ? AND deleted_at IS NULL').get(login)
        if (!user) {
          error(res, 'USER_NOT_FOUND', `用户 ${login} 不存在`, 404)
          return
        }

        const tags = db.prepare(`
          SELECT tag, COUNT(*) as count
          FROM repo_tags
          WHERE repo_full_name IN (SELECT repo_full_name FROM stars WHERE user_login = ?)
          GROUP BY tag
          ORDER BY count DESC
        `).all(login) as { tag: string; count: number }[]

        // 返回带 label 字段的标签列表（label 根据语言翻译）
        const tagsWithLabel = tags.map(t => ({
          ...t,
          label: getTagLabel(t.tag, lang as 'zh' | 'en'),
        }))

        json(res, { data: tagsWithLabel })
        return
      }

      // ===== POST /api/users/:login/classify =====
      const classifyMatch = matchRoute('/api/users/:login/classify', url.split('?')[0])
      if (method === 'POST' && classifyMatch) {
        const login = normalizeRouteLogin(classifyMatch.login)
        if (!ensureUserExists(db, login)) {
          error(res, 'USER_NOT_FOUND', `用户 ${login} 不存在`, 404)
          return
        }
        const result = classifyReposForUser(db, login)
        json(res, { data: result })
        return
      }

      // ===== GET /api/users/:login/star-dna =====
      const starDnaMatch = matchRoute('/api/users/:login/star-dna', url.split('?')[0])
      if (method === 'GET' && starDnaMatch) {
        const login = normalizeRouteLogin(starDnaMatch.login)
        const force = parseQuery(url).force === '1'
        const lang = parseQuery(url).lang === 'en' ? 'en' : 'zh'
        const cacheKey = `dna-${lang}`
        const cachedText = getUserAiTextCache(db, login, cacheKey)

        if (!ensureUserExists(db, login)) {
          error(res, 'USER_NOT_FOUND', `用户 ${login} 不存在`, 404)
          return
        }

        // 查缓存（非强制刷新时）
        if (!force && cachedText) {
          json(res, { data: { dna: cachedText, cached: true } })
          return
        }
        if (!force && lang === 'en') {
          const cachedZh = getUserAiTextCache(db, login, 'dna-zh')
          if (cachedZh) {
            try {
              const translated = await translateToEnglish(cachedZh)
              cacheUserAiTextPair(db, login, 'dna-zh', cachedZh, 'dna-en', translated, new Date().toISOString())
              json(res, { data: { dna: translated || cachedZh, cached: false } })
            } catch {
              json(res, { data: { dna: cachedZh, cached: true } })
            }
            return
          }
        }

        const incompleteSyncMessage = assertUserAiDataReady(db, login)
        if (incompleteSyncMessage) {
          error(res, 'SYNC_INCOMPLETE', incompleteSyncMessage, 409)
          return
        }

        const starCount = getUserStarCount(db, login)
        if (starCount === 0) {
          error(res, 'EMPTY_STAR_DATA', `用户 ${login} 暂无星标数据，请先同步星标`, 400)
          return
        }

        // 收集统计
        const languages = db.prepare(`
          SELECT language, COUNT(*) as count FROM repos
          WHERE full_name IN (SELECT repo_full_name FROM stars WHERE user_login = ?)
          GROUP BY language ORDER BY count DESC LIMIT 5
        `).all(login) as { language: string; count: number }[]

        const tags = db.prepare(`
          SELECT tag, COUNT(*) as count FROM repo_tags
          WHERE repo_full_name IN (SELECT repo_full_name FROM stars WHERE user_login = ?)
          GROUP BY tag ORDER BY count DESC LIMIT 8
        `).all(login) as { tag: string; count: number }[]

        const activeRepoCount = queryActiveRepoCount(db, login)

        // 获取代表性星标项目（按 stars 排序取前 5）
        const topRepos = db.prepare(`
          SELECT r.full_name, r.description, r.stars
          FROM repos r JOIN stars s ON r.full_name = s.repo_full_name
          WHERE s.user_login = ? AND r.description IS NOT NULL
          ORDER BY r.stars DESC LIMIT 5
        `).all(login) as { full_name: string; description: string; stars: number }[]

        try {
          // 先生成中文
          const dnaZh = await generateStarDna(login, {
            repoCount: starCount,
            activeRepoCount,
            languages,
            tags,
            topRepos,
          })

          const now = new Date().toISOString()

          // 中文请求不等待英文翻译，避免长耗时翻译拖垮首次生成。
          let dnaEn = ''
          if (lang === 'en') {
            try {
              dnaEn = await translateToEnglish(dnaZh)
            } catch { /* 翻译失败不阻塞 */ }
          }

          cacheUserAiTextPair(db, login, 'dna-zh', dnaZh, 'dna-en', dnaEn, now)
          json(res, { data: { dna: lang === 'en' ? (dnaEn || dnaZh) : dnaZh, cached: false } })
        } catch (err: any) {
          if (cachedText) {
            json(res, { data: { dna: cachedText, cached: true } })
            return
          }
          error(res, 'AI_ERROR', err?.message || 'AI 生成画像失败', 500)
        }
        return
      }

      // ===== GET /api/users/:login/cn-summaries =====
      const cnSumMatch = matchRoute('/api/users/:login/cn-summaries', url.split('?')[0])
      if (method === 'GET' && cnSumMatch) {
        const login = normalizeRouteLogin(cnSumMatch.login)
        const rows = db.prepare(`
          SELECT t.repo_full_name, t.translated_readme_summary
          FROM translations t
          WHERE t.target_lang = 'zh'
            AND t.translated_readme_summary IS NOT NULL
            AND t.translated_readme_summary != ''
            AND t.repo_full_name IN (
              SELECT repo_full_name FROM stars WHERE user_login = ?
            )
        `).all(login) as Array<{ repo_full_name: string; translated_readme_summary: string }>

        const map: Record<string, string> = {}
        for (const r of rows) {
          // 兼容新格式（JSON）和旧格式（纯文本）
          try {
            const parsed = JSON.parse(r.translated_readme_summary)
            if (parsed.summary) {
              map[r.repo_full_name] = parsed.summary
              continue
            }
          } catch { /* 旧格式纯文本 */ }
          map[r.repo_full_name] = r.translated_readme_summary
        }
        json(res, { data: map })
        return
      }

      // ===== GET /api/users/:login/learning-path =====
      const learningMatch = matchRoute('/api/users/:login/learning-path', url.split('?')[0])
      if (method === 'GET' && learningMatch) {
        const login = normalizeRouteLogin(learningMatch.login)
        const force = parseQuery(url).force === '1'
        const lang = parseQuery(url).lang === 'en' ? 'en' : 'zh'
        const cacheKey = `learning-${lang}`
        const cachedText = getUserAiTextCache(db, login, cacheKey)

        if (!ensureUserExists(db, login)) {
          error(res, 'USER_NOT_FOUND', `用户 ${login} 不存在`, 404)
          return
        }

        // 查缓存（非强制刷新时）
        if (!force && cachedText) {
          json(res, { data: { path: cachedText, cached: true } })
          return
        }
        if (!force && lang === 'en') {
          const cachedZh = getUserAiTextCache(db, login, 'learning-zh')
          if (cachedZh) {
            try {
              const translated = await translateToEnglish(cachedZh)
              cacheUserAiTextPair(db, login, 'learning-zh', cachedZh, 'learning-en', translated, new Date().toISOString())
              json(res, { data: { path: translated || cachedZh, cached: false } })
            } catch {
              json(res, { data: { path: cachedZh, cached: true } })
            }
            return
          }
        }

        const incompleteSyncMessage = assertUserAiDataReady(db, login)
        if (incompleteSyncMessage) {
          error(res, 'SYNC_INCOMPLETE', incompleteSyncMessage, 409)
          return
        }

        const starCount = getUserStarCount(db, login)
        if (starCount === 0) {
          error(res, 'EMPTY_STAR_DATA', `用户 ${login} 暂无星标数据，请先同步星标`, 400)
          return
        }

        // 收集统计
        const languages = db.prepare(`
          SELECT language, COUNT(*) as count FROM repos
          WHERE full_name IN (SELECT repo_full_name FROM stars WHERE user_login = ?)
          GROUP BY language ORDER BY count DESC LIMIT 5
        `).all(login) as { language: string; count: number }[]

        const tags = db.prepare(`
          SELECT tag, COUNT(*) as count FROM repo_tags
          WHERE repo_full_name IN (SELECT repo_full_name FROM stars WHERE user_login = ?)
          GROUP BY tag ORDER BY count DESC LIMIT 10
        `).all(login) as { tag: string; count: number }[]

        // 获取代表性星标项目（按 stars 排序取前 8）
        const topRepos = db.prepare(`
          SELECT r.full_name, r.description, r.stars
          FROM repos r JOIN stars s ON r.full_name = s.repo_full_name
          WHERE s.user_login = ? AND r.description IS NOT NULL
          ORDER BY r.stars DESC LIMIT 8
        `).all(login) as { full_name: string; description: string; stars: number }[]

        try {
          // 先生成中文
          const pathZh = await generateLearningPath(login, {
            repoCount: starCount,
            languages,
            tags,
            topRepos,
          })

          const now = new Date().toISOString()

          // 中文请求不等待英文翻译，避免长耗时翻译拖垮首次生成。
          let pathEn = ''
          if (lang === 'en') {
            try {
              pathEn = await translateToEnglish(pathZh)
            } catch { /* 翻译失败不阻塞 */ }
          }

          cacheUserAiTextPair(db, login, 'learning-zh', pathZh, 'learning-en', pathEn, now)
          json(res, { data: { path: lang === 'en' ? (pathEn || pathZh) : pathZh, cached: false } })
        } catch (err: any) {
          if (cachedText) {
            json(res, { data: { path: cachedText, cached: true } })
            return
          }
          error(res, 'AI_ERROR', err?.message || 'AI 生成学习路径失败', 500)
        }
        return
      }

      // ===== GET /api/users/:login/removed-stars =====
      const removedMatch = matchRoute('/api/users/:login/removed-stars', url.split('?')[0])
      if (method === 'GET' && removedMatch) {
        const login = normalizeRouteLogin(removedMatch.login)
        const repos = db.prepare(`
          SELECT r.*, s.starred_at, s.removed_at
          FROM repos r
          JOIN stars s ON r.full_name = s.repo_full_name
          WHERE s.user_login = ? AND s.removed_at IS NOT NULL
          ORDER BY s.removed_at DESC
        `).all(login)

        json(res, { data: repos })
        return
      }

      // ===== GET /api/users/:login/sync-runs =====
      const syncRunsMatch = matchRoute('/api/users/:login/sync-runs', url.split('?')[0])
      if (method === 'GET' && syncRunsMatch) {
        const login = normalizeRouteLogin(syncRunsMatch.login)
        const runs = db.prepare(`
          SELECT id, user_login, started_at, ended_at, status,
                 repos_upserted, stars_upserted, repos_removed, pages_fetched,
                 rate_limit_remaining, rate_limit_reset, error_message
          FROM sync_runs
          WHERE user_login = ?
          ORDER BY started_at DESC
          LIMIT 20
        `).all(login)

        json(res, { data: runs })
        return
      }

      // ===== GET /api/token-source =====
      if (method === 'GET' && url === '/api/token-source') {
        const source = getGitHubTokenSource()
        json(res, {
          data: {
            source,
            hasToken: !!source,
            envVar: source,
          },
        })
        return
      }

      // ===== POST /api/sync =====
      if (method === 'POST' && url === '/api/sync') {
        const body = await readBody(req)
        let payload: { username?: string; token?: string }
        try {
          payload = JSON.parse(body)
        } catch {
          error(res, 'INVALID_JSON', '请求 body 不是有效的 JSON')
          return
        }

        if (!payload.username) {
          error(res, 'MISSING_USERNAME', '缺少 username 字段')
          return
        }

        try {
          const result = await syncStars(db, payload.username, {
            token: resolveGitHubToken(payload.token),
          })
          json(res, { data: result })
        } catch (err: any) {
          const msg = err?.message || '同步失败'
          // 判断是否为已知同步错误
          if (err?.code) {
            error(res, err.code, msg, err?.statusCode || 500)
          } else {
            error(res, 'SYNC_ERROR', msg, 500)
          }
        }
        return
      }

      // ===== GET /api/repos/*fullName/readme-summary =====
      const readmeMatch = matchRoute('/api/repos/*/readme-summary', url.split('?')[0])
      if (method === 'GET' && readmeMatch) {
        const fullName = decodePathParam(readmeMatch['*'] || '')
        const query = parseQuery(url)
        const force = query.force === '1'
        const lang = query.lang === 'en' ? 'en' : 'zh'

        // 先查缓存（非强制刷新时）
        if (!force) {
          const cached = db.prepare(`
            SELECT translated_readme_summary FROM translations
            WHERE repo_full_name = ? AND target_lang = ?
          `).get(fullName, lang) as { translated_readme_summary: string } | undefined

          if (cached?.translated_readme_summary) {
            try {
              const parsed = JSON.parse(cached.translated_readme_summary)
              if (parsed.summary) {
                json(res, { data: { ...parsed, cached: true } })
                return
              }
            } catch { /* 旧格式，按纯文本处理 */ }
            json(res, { data: { summary: cached.translated_readme_summary, starReason: '', reuseAdvice: '', cached: true } })
            return
          }
        }

        // 获取仓库信息
        const repo = db.prepare(`
          SELECT description, language, topics_json FROM repos WHERE full_name = ?
        `).get(fullName) as { description: string; language: string; topics_json: string } | undefined

        if (!repo) {
          error(res, 'REPO_NOT_FOUND', `仓库 ${fullName} 不存在`, 404)
          return
        }

        // 调用 AI 生成分析
        try {
          const topics: string[] = repo.topics_json ? JSON.parse(repo.topics_json) : []
          const analysisZh = await generateRepoAnalysis(fullName, repo.description || '', repo.language || '', topics)

          const now = new Date().toISOString()
          const cacheJsonZh = JSON.stringify(analysisZh)

          // 缓存中文
          db.prepare(`
            INSERT INTO translations (repo_full_name, target_lang, translated_readme_summary, provider, updated_at)
            VALUES (?, 'zh', ?, 'ai', ?)
            ON CONFLICT(repo_full_name, target_lang) DO UPDATE SET
              translated_readme_summary = excluded.translated_readme_summary,
              provider = excluded.provider,
              updated_at = excluded.updated_at
          `).run(fullName, cacheJsonZh, now)

          // 自动翻译英文
          let analysisEn: RepoAnalysisResult | null = null
          try {
            analysisEn = await translateRepoAnalysisToEnglish(analysisZh)
            db.prepare(`
              INSERT INTO translations (repo_full_name, target_lang, translated_readme_summary, provider, updated_at)
              VALUES (?, 'en', ?, 'ai', ?)
              ON CONFLICT(repo_full_name, target_lang) DO UPDATE SET
                translated_readme_summary = excluded.translated_readme_summary,
                provider = excluded.provider,
                updated_at = excluded.updated_at
            `).run(fullName, JSON.stringify(analysisEn), now)
          } catch { /* 翻译失败不阻塞 */ }

          json(res, { data: { ...(lang === 'en' && analysisEn ? analysisEn : analysisZh), cached: false } })
        } catch (err: any) {
          error(res, 'AI_ERROR', err?.message || 'AI 生成摘要失败', 500)
        }
        return
      }

      // ===== POST /api/repos/*fullName/tags =====
      const addTagMatch = matchRoute('/api/repos/*/tags', url.split('?')[0])
      if (method === 'POST' && addTagMatch) {
        const fullName = decodePathParam(addTagMatch['*'] || '')
        const body = await readBody(req)
        let payload: { tag?: string }
        try {
          payload = JSON.parse(body)
        } catch {
          error(res, 'INVALID_JSON', '请求 body 不是有效的 JSON')
          return
        }
        if (!payload.tag || !payload.tag.trim()) {
          error(res, 'MISSING_TAG', '缺少 tag 字段')
          return
        }
        const tag = payload.tag.trim()
        const addTag = db.transaction((repoFullName: string, tagName: string) => {
          db.prepare(`
            INSERT INTO repo_tags (repo_full_name, tag, tag_source, confidence)
            VALUES (?, ?, 'manual', 1.0)
            ON CONFLICT(repo_full_name, tag) DO UPDATE SET
              tag_source = 'manual',
              confidence = 1.0
          `).run(repoFullName, tagName)
        })
        addTag(fullName, tag)
        json(res, { data: { fullName, tag, source: 'manual' } })
        return
      }

      // ===== DELETE /api/repos/*fullName/tags/:tag =====
      const delTagMatch = matchRoute('/api/repos/*/tags/:tag', url.split('?')[0])
      if (method === 'DELETE' && delTagMatch) {
        const fullName = decodePathParam(delTagMatch['*'] || '')
        const tag = decodePathParam(delTagMatch.tag)
        const deleteTag = db.transaction((repoFullName: string, tagName: string) => {
          db.prepare(`DELETE FROM repo_tags WHERE repo_full_name = ? AND tag = ?`).run(repoFullName, tagName)
        })
        deleteTag(fullName, tag)
        json(res, { data: { fullName, tag, deleted: true } })
        return
      }

      // ===== GET /api/export =====
      if (method === 'GET' && url.startsWith('/api/export')) {
        const query = parseQuery(url)
        const format = query.format || 'json'
        const defaultUser = db.prepare(`
          SELECT login FROM users
          WHERE login != ?
          ORDER BY synced_at DESC, login
          LIMIT 1
        `).get(SYSTEM_DEMO_LOGIN) as { login: string } | undefined
        const login = normalizeGitHubLogin(query.login || defaultUser?.login || '')

        // 验证用户是否存在
        const user = db.prepare('SELECT login FROM users WHERE login = ? AND deleted_at IS NULL').get(login)
        if (!user) {
          error(res, 'USER_NOT_FOUND', `用户 ${login} 不存在`, 404)
          return
        }

        // 支持与仓库列表一致的筛选参数
        const params = {
          language: query.language,
          tag: query.tag,
          search: query.q || query.search,
          sortBy: (query.sort as any) || 'stars',
          sortOrder: (query.direction as any) || 'DESC',
        }

        try {
          switch (format) {
            case 'csv':
              text(res, exportCsv(db, login, params), 'text/csv', 200)
              return
            case 'json':
              text(res, exportJson(db, login, params), 'application/json', 200)
              return
            case 'markdown':
              text(res, exportMarkdown(db, login, params), 'text/markdown', 200)
              return
            case 'html':
              text(res, exportHtml(db, login, params), 'text/html', 200)
              return
            default:
              error(res, 'INVALID_FORMAT', `不支持的导出格式: ${format}`)
              return
          }
        } catch (err: any) {
          error(res, 'EXPORT_ERROR', `导出失败: ${err?.message || err}`, 500)
        }
        return
      }

      // ===== GET /api/users/:login/report =====
      const reportMatch = matchRoute('/api/users/:login/report', url.split('?')[0])
      if (method === 'GET' && reportMatch) {
        const login = normalizeRouteLogin(reportMatch.login)
        if (!ensureUserExists(db, login)) {
          error(res, 'USER_NOT_FOUND', `用户 ${login} 不存在`, 404)
          return
        }
        try {
          const md = exportReportMarkdown(db, login)
          text(res, md, 'text/markdown', 200)
        } catch (err: any) {
          error(res, 'REPORT_ERROR', `生成报告失败: ${err?.message || err}`, 500)
        }
        return
      }

      // 404
      error(res, 'NOT_FOUND', `未找到路由: ${method} ${url}`, 404)

    } catch (err: any) {
      // 全局异常处理
      console.error('API 未捕获异常:', err)
      error(res, 'INTERNAL_ERROR', `服务器内部错误: ${err?.message || err}`, 500)
    }
  }
}
