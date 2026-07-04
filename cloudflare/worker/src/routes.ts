/**
 * Worker API 路由处理
 * 实现 MVP 所需的全部路由，与 Node 后端保持 API 兼容
 *
 * 路由清单：
 * - GET  /api/users
 * - GET  /api/overview
 * - GET  /api/status
 * - GET  /api/token-source
 * - POST /api/sync
 * - GET  /api/users/:login/repos
 * - GET  /api/users/:login/repos/*fullName
 * - GET  /api/users/:login/stats
 * - GET  /api/users/:login/summary
 * - GET  /api/users/:login/tags
 * - GET  /api/users/:login/star-timeline
 * - GET  /api/users/:login/sync-runs
 * - POST /api/users/:login/classify
 * - GET  /api/repos/*fullName
 *
 * 第二阶段 API（AI、相似、导出、删除）返回 501 NOT_IMPLEMENTED
 */
import type { Env } from './env.js'
import { resolveGitHubToken, getGitHubTokenSource, isAiConfigured } from './env.js'
import { D1StarRepository, SYSTEM_DEMO_LOGIN } from './d1-repository.js'
import { WorkerApiError, errorResponse, dataResponse, jsonResponse } from './errors.js'
import { syncStars as syncStarsWorker } from './github-sync.js'
import { classifyRepo } from '@shared/classification/classifier.js'
import { getTagLabel } from '@shared/classification/tag-labels-bilingual.js'
import type { ThresholdOptions } from '@shared/scoring/thresholds.js'

// ===== 工具函数 =====

/**
 * 规范化 GitHub login，兼容 @login 和 URL 输入
 */
function normalizeGitHubLogin(login: string): string {
  return login.trim().replace(/^@+/, '')
}

/**
 * 安全解码路径参数
 */
function decodePathParam(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * 规范化路由中的用户 login
 */
function normalizeRouteLogin(login: string): string {
  return normalizeGitHubLogin(decodePathParam(login))
}

/**
 * 从 URL 路径中提取动态参数（支持 :login, :fullName, * 通配）
 * 与 backend Node 版本保持一致的匹配逻辑
 */
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

/**
 * 解析查询字符串为 Record
 */
function parseQuery(url: URL): Record<string, string> {
  const params: Record<string, string> = {}
  url.searchParams.forEach((v, k) => { params[k] = v })
  return params
}

/**
 * 从 query 解析业务阈值，非法或越界值回退 undefined
 * 与 backend Node 版本保持一致的校验逻辑
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

/**
 * 读取 POST 请求 body（JSON）
 */
async function readBody(request: Request): Promise<unknown> {
  try {
    const text = await request.text()
    return text ? JSON.parse(text) : {}
  } catch {
    throw new WorkerApiError('请求 body 不是有效的 JSON', 'INVALID_JSON', 400)
  }
}

// ===== 路由处理器 =====

/**
 * 处理 Worker API 请求
 * @param request Worker Request 对象
 * @param env Worker 环境变量
 * @param ctx Worker ExecutionContext
 */
export async function handleRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url)
  const pathname = url.pathname
  const method = request.method

  // CORS 预检请求
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  const repo = new D1StarRepository(env.DB)
  const aiEnabled = isAiConfigured(env)

  try {
    // ===== GET /api/users =====
    if (method === 'GET' && pathname === '/api/users') {
      const users = await repo.listUsers()
      return dataResponse(users)
    }

    // ===== GET /api/overview =====
    if (method === 'GET' && pathname === '/api/overview') {
      const thresholdOpts = parseThresholdOptions(parseQuery(url))
      const overview = await repo.getOverview(thresholdOpts)
      return dataResponse({ ...overview, aiEnabled })
    }

    // ===== GET /api/status =====
    if (method === 'GET' && pathname === '/api/status') {
      // Worker 版状态检测：只返回配置状态，不实际探测（避免阻塞）
      const token = resolveGitHubToken(env)
      const source = getGitHubTokenSource(env)
      return dataResponse({
        github: {
          configured: !!token,
          valid: !!token, // Worker 版无法实际验证，configured 即视为 valid
          source,
          message: token ? null : 'GitHub Token 未配置',
        },
        ai: {
          configured: aiEnabled,
          valid: false,
          message: 'Worker MVP 未启用 AI 功能',
        },
      })
    }

    // ===== GET /api/token-source =====
    if (method === 'GET' && pathname === '/api/token-source') {
      const source = getGitHubTokenSource(env)
      return dataResponse({
        source,
        hasToken: !!source,
        envVar: source,
      })
    }

    // ===== POST /api/sync =====
    if (method === 'POST' && pathname === '/api/sync') {
      const payload = await readBody(request) as { username?: string; token?: string }
      if (!payload.username) {
        throw new WorkerApiError('缺少 username 字段', 'MISSING_USERNAME', 400)
      }
      // Worker 版同步：token 从 env 读取，不支持请求 body 传 token
      const token = resolveGitHubToken(env)
      const result = await syncStarsWorker(env, payload.username, token)
      return dataResponse(result)
    }

    // ===== GET /api/users/:login/repos =====
    const reposMatch = matchRoute('/api/users/:login/repos', pathname)
    if (method === 'GET' && reposMatch) {
      const login = normalizeRouteLogin(reposMatch.login)
      const query = parseQuery(url)

      if (!(await repo.ensureUserExists(login))) {
        throw new WorkerApiError(`用户 ${login} 不存在`, 'USER_NOT_FOUND', 404)
      }

      const result = await repo.listRepos({
        userLogin: login,
        language: query.language,
        tag: query.tag,
        search: query.q || query.search,
        sortBy: (query.sort as any) || 'stars',
        sortOrder: (query.direction as any) || 'DESC',
        limit: parseInt(query.pageSize || query.limit || '20', 10),
        offset: parseInt(query.page ? ((parseInt(query.page, 10) - 1) * parseInt(query.pageSize || '20', 10)).toString() : '0', 10),
      })

      return dataResponse({
        items: result.items.map(item => ({
          ...item.repo,
          starred_at: item.starred_at,
          tags: item.tags,
        })),
        total: result.total,
      })
    }

    // ===== GET /api/users/:login/repos/*fullName =====
    const repoMatch = matchRoute('/api/users/:login/repos/*', pathname)
    if (method === 'GET' && repoMatch) {
      const fullName = decodePathParam(repoMatch['*'] || '')
      const login = normalizeRouteLogin(repoMatch.login)
      const repoData = await repo.getRepoForUser(login, fullName)
      if (!repoData) {
        throw new WorkerApiError(`仓库 ${fullName} 不存在`, 'REPO_NOT_FOUND', 404)
      }
      return dataResponse({
        ...repoData.repo,
        starred_at: repoData.starred_at,
        tags: repoData.tags,
      })
    }

    // ===== GET /api/users/:login/stats =====
    const statsMatch = matchRoute('/api/users/:login/stats', pathname)
    if (method === 'GET' && statsMatch) {
      const login = normalizeRouteLogin(statsMatch.login)
      if (!(await repo.ensureUserExists(login))) {
        throw new WorkerApiError(`用户 ${login} 不存在`, 'USER_NOT_FOUND', 404)
      }
      const [languages, topics, licenses, repoCount, activeRepoCount] = await Promise.all([
        repo.queryLanguageStats(login),
        repo.queryTopicStats(login),
        repo.queryLicenseStats(login),
        repo.queryRepoCount(login),
        repo.queryActiveRepoCount(login),
      ])
      return dataResponse({
        languages,
        topics,
        licenses,
        repoCount,
        activeRepoCount,
        aiEnabled,
      })
    }

    // ===== GET /api/users/:login/summary =====
    const summaryMatch = matchRoute('/api/users/:login/summary', pathname)
    if (method === 'GET' && summaryMatch) {
      const login = normalizeRouteLogin(summaryMatch.login)
      if (!(await repo.ensureUserExists(login))) {
        throw new WorkerApiError(`用户 ${login} 不存在`, 'USER_NOT_FOUND', 404)
      }
      const thresholdOpts = parseThresholdOptions(parseQuery(url))
      const summary = await repo.getUserSummary(login, thresholdOpts)
      return dataResponse(summary)
    }

    // ===== GET /api/users/:login/tags =====
    const tagsMatch = matchRoute('/api/users/:login/tags', pathname)
    if (method === 'GET' && tagsMatch) {
      const login = normalizeRouteLogin(tagsMatch.login)
      const lang = parseQuery(url).lang === 'en' ? 'en' : 'zh'
      if (!(await repo.ensureUserExists(login))) {
        throw new WorkerApiError(`用户 ${login} 不存在`, 'USER_NOT_FOUND', 404)
      }
      const tags = await repo.listTags(login)
      const tagsWithLabel = tags.map(t => ({
        ...t,
        label: getTagLabel(t.tag, lang as 'zh' | 'en'),
      }))
      return dataResponse(tagsWithLabel)
    }

    // ===== GET /api/users/:login/star-timeline =====
    const timelineMatch = matchRoute('/api/users/:login/star-timeline', pathname)
    if (method === 'GET' && timelineMatch) {
      const login = normalizeRouteLogin(timelineMatch.login)
      if (!(await repo.ensureUserExists(login))) {
        throw new WorkerApiError(`用户 ${login} 不存在`, 'USER_NOT_FOUND', 404)
      }
      const timeline = await repo.getUserStarTimeline(login)
      return dataResponse(timeline)
    }

    // ===== GET /api/users/:login/sync-runs =====
    const syncRunsMatch = matchRoute('/api/users/:login/sync-runs', pathname)
    if (method === 'GET' && syncRunsMatch) {
      const login = normalizeRouteLogin(syncRunsMatch.login)
      const runs = await repo.listSyncRuns(login)
      return dataResponse(runs)
    }

    // ===== POST /api/users/:login/classify =====
    const classifyMatch = matchRoute('/api/users/:login/classify', pathname)
    if (method === 'POST' && classifyMatch) {
      const login = normalizeRouteLogin(classifyMatch.login)
      if (!(await repo.ensureUserExists(login))) {
        throw new WorkerApiError(`用户 ${login} 不存在`, 'USER_NOT_FOUND', 404)
      }
      const result = await repo.classifyReposForUser(login)
      return dataResponse(result)
    }

    // ===== GET /api/repos/*fullName（全局仓库查询） =====
    // 排除 /similar、/readme-summary、/tags 等子路由
    const globalRepoMatch = matchRoute('/api/repos/*', pathname)
    if (method === 'GET' && globalRepoMatch) {
      const fullName = decodePathParam(globalRepoMatch['*'] || '')
      // 如果路径包含子路由后缀，跳过此路由
      if (fullName.endsWith('/similar') || fullName.endsWith('/readme-summary') || fullName.includes('/tags/')) {
        // 不处理，继续后续路由
      } else {
        const repoRow = await repo.getRepoGlobal(fullName)
        if (!repoRow) {
          throw new WorkerApiError(`仓库 ${fullName} 不存在`, 'REPO_NOT_FOUND', 404)
        }
        const tags = await repo.getRepoTags(fullName)
        return dataResponse({
          ...repoRow,
          starred_at: null,
          tags,
        })
      }
    }

    // ===== 第二阶段 API：返回 501 NOT_IMPLEMENTED =====
    // AI 接口
    const readmeMatch = matchRoute('/api/repos/*/readme-summary', pathname)
    if (method === 'GET' && readmeMatch) {
      throw new WorkerApiError('AI 摘要功能在 Worker MVP 阶段未启用', 'NOT_IMPLEMENTED', 501)
    }
    const starDnaMatch = matchRoute('/api/users/:login/star-dna', pathname)
    if (method === 'GET' && starDnaMatch) {
      throw new WorkerApiError('Star DNA 功能在 Worker MVP 阶段未启用', 'NOT_IMPLEMENTED', 501)
    }
    const learningMatch = matchRoute('/api/users/:login/learning-path', pathname)
    if (method === 'GET' && learningMatch) {
      throw new WorkerApiError('学习路径功能在 Worker MVP 阶段未启用', 'NOT_IMPLEMENTED', 501)
    }

    // 相似项目推荐
    const similarMatch = matchRoute('/api/repos/*/similar', pathname)
    if (method === 'GET' && similarMatch) {
      throw new WorkerApiError('相似项目推荐在 Worker MVP 阶段未启用', 'NOT_IMPLEMENTED', 501)
    }

    // 导出
    if (method === 'GET' && pathname.startsWith('/api/export')) {
      throw new WorkerApiError('导出功能在 Worker MVP 阶段未启用', 'NOT_IMPLEMENTED', 501)
    }

    // 报告
    const reportMatch = matchRoute('/api/users/:login/report', pathname)
    if (method === 'GET' && reportMatch) {
      throw new WorkerApiError('报告功能在 Worker MVP 阶段未启用', 'NOT_IMPLEMENTED', 501)
    }

    // 仓库标签管理
    const addTagMatch = matchRoute('/api/repos/*/tags', pathname)
    if (method === 'POST' && addTagMatch) {
      throw new WorkerApiError('标签管理在 Worker MVP 阶段未启用', 'NOT_IMPLEMENTED', 501)
    }
    const delTagMatch = matchRoute('/api/repos/*/tags/:tag', pathname)
    if (method === 'DELETE' && delTagMatch) {
      throw new WorkerApiError('标签管理在 Worker MVP 阶段未启用', 'NOT_IMPLEMENTED', 501)
    }

    // 已移除星标
    const removedMatch = matchRoute('/api/users/:login/removed-stars', pathname)
    if (method === 'GET' && removedMatch) {
      throw new WorkerApiError('已移除星标查询在 Worker MVP 阶段未启用', 'NOT_IMPLEMENTED', 501)
    }

    // 中文摘要批量
    const cnSumMatch = matchRoute('/api/users/:login/cn-summaries', pathname)
    if (method === 'GET' && cnSumMatch) {
      throw new WorkerApiError('中文摘要批量获取在 Worker MVP 阶段未启用', 'NOT_IMPLEMENTED', 501)
    }

    // 删除用户
    const deleteUserMatch = matchRoute('/api/users/:login', pathname)
    if (method === 'DELETE' && deleteUserMatch) {
      throw new WorkerApiError('删除用户在 Worker MVP 阶段未启用', 'NOT_IMPLEMENTED', 501)
    }

    // 404
    throw new WorkerApiError(`未找到路由: ${method} ${pathname}`, 'NOT_FOUND', 404)
  } catch (err) {
    return errorResponse(err)
  }
}
