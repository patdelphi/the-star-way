/**
 * 路由定义与处理
 * 所有 API 路由集中管理，使用 Node.js 内置 http 模块
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type Database from 'better-sqlite3'
import { URL } from 'node:url'
import {
  queryRepos,
  queryRepoByName,
  queryLanguageStats,
  queryTopicStats,
  queryLicenseStats,
  queryRepoCount,
  queryActiveRepoCount,
} from '../repository/repo-queries.js'
import { classifyAllRepos } from '../classification/classifier.js'
import { syncStars } from '../sync/star-syncer.js'
import { exportCsv, exportJson, exportMarkdown } from '../export/exporter.js'
import { loadAiConfig } from '../ai/config.js'

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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(body)
}

/** 发送错误响应 */
function error(res: ServerResponse, code: string, message: string, status = 400): void {
  json(res, { error: { code, message } }, status)
}

/** 发送文本响应（用于导出） */
function text(res: ServerResponse, content: string, contentType: string, status = 200): void {
  res.writeHead(status, {
    'Content-Type': `${contentType}; charset=utf-8`,
    'Access-Control-Allow-Origin': '*',
  })
  res.end(content)
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
      // 通配段：匹配剩余所有路径部分，合并为 fullName（含 /）
      const remaining = pathParts.slice(si).join('/')
      params['*'] = remaining
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
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        })
        res.end()
        return
      }

      const url = req.url || '/'
      const method = req.method || 'GET'

      // ===== GET /api/users =====
      if (method === 'GET' && url === '/api/users') {
        const users = db.prepare('SELECT login, avatar_url, profile_url, synced_at FROM users ORDER BY login').all()
        json(res, { data: users })
        return
      }

      // ===== GET /api/users/:login/repos =====
      const reposMatch = matchRoute('/api/users/:login/repos', url.split('?')[0])
      if (method === 'GET' && reposMatch) {
        const { login } = reposMatch
        const query = parseQuery(url)

        // 验证用户是否存在
        const user = db.prepare('SELECT login FROM users WHERE login = ?').get(login)
        if (!user) {
          error(res, 'USER_NOT_FOUND', `用户 ${login} 不存在`, 404)
          return
        }

        const result = queryRepos(db, {
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
        const fullName = decodeURIComponent(repoMatch['*'] || '')
        const repo = queryRepoByName(db, fullName)
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
        const { login } = statsMatch
        const user = db.prepare('SELECT login FROM users WHERE login = ?').get(login)
        if (!user) {
          error(res, 'USER_NOT_FOUND', `用户 ${login} 不存在`, 404)
          return
        }

        json(res, {
          data: {
            languages: queryLanguageStats(db),
            topics: queryTopicStats(db),
            licenses: queryLicenseStats(db),
            repoCount: queryRepoCount(db),
            activeRepoCount: queryActiveRepoCount(db),
            aiEnabled: aiConfig.enabled,
          },
        })
        return
      }

      // ===== GET /api/users/:login/tags =====
      const tagsMatch = matchRoute('/api/users/:login/tags', url.split('?')[0])
      if (method === 'GET' && tagsMatch) {
        const { login } = tagsMatch
        const user = db.prepare('SELECT login FROM users WHERE login = ?').get(login)
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
        `).all(login)

        json(res, { data: tags })
        return
      }

      // ===== POST /api/users/:login/classify =====
      const classifyMatch = matchRoute('/api/users/:login/classify', url.split('?')[0])
      if (method === 'POST' && classifyMatch) {
        const result = classifyAllRepos(db)
        json(res, { data: result })
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
            token: payload.token,
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

      // ===== GET /api/export =====
      if (method === 'GET' && url.startsWith('/api/export')) {
        const query = parseQuery(url)
        const format = query.format || 'json'
        const login = query.login || 'demo-user'

        // 验证用户是否存在
        const user = db.prepare('SELECT login FROM users WHERE login = ?').get(login)
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
            default:
              error(res, 'INVALID_FORMAT', `不支持的导出格式: ${format}`)
              return
          }
        } catch (err: any) {
          error(res, 'EXPORT_ERROR', `导出失败: ${err?.message || err}`, 500)
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
