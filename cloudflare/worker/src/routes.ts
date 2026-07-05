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
import {
  generateRepoAnalysis,
  generateStarDna,
  generateLearningPath,
  translateToEnglish,
  translateRepoAnalysisToEnglish,
  type RepoAnalysisResult,
} from './ai/client.js'
import { classifyRepo } from '@shared/classification/classifier.js'
import { getTagLabel } from '@shared/classification/tag-labels-bilingual.js'
import type { ThresholdOptions } from '@shared/scoring/thresholds.js'
import {
  canGenerateUserAiFromSyncStatus,
  getIncompleteSyncMessage,
  type SyncStatus,
} from '@shared/sync/index.js'

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
 * AI 画像/学习路径依赖完整星标数据。
 * 最新同步仍在运行、失败或 partial 时，禁止生成新的用户级 AI 缓存。
 */
async function assertUserAiDataReady(repo: D1StarRepository, login: string): Promise<void> {
  const latestRun = await repo.getLatestSyncRun(login)
  if (!latestRun) return

  const status = latestRun.status as SyncStatus
  if (!canGenerateUserAiFromSyncStatus(status)) {
    throw new WorkerApiError(
      getIncompleteSyncMessage(login, status, latestRun.error_message),
      'SYNC_INCOMPLETE',
      409,
    )
  }
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

  // 根路径返回 API 入口说明（不重定向）
  // 前端页面由 Cloudflare Pages 托管，通过 Pages 自定义域名绑定处理
  if (!pathname.startsWith('/api/')) {
    const apiBase = url.origin + '/api'
    return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>the-star-way API</title></head>
<body style="font-family: sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem;">
<h1>the-star-way API</h1>
<p>这是后端 API 服务，前端页面请访问 <a href="https://the-star-way.pages.dev/">the-star-way.pages.dev</a>。</p>
<h2>主要端点</h2>
<ul>
  <li><a href="${apiBase}/status">GET /api/status</a> - 服务状态</li>
  <li><a href="${apiBase}/users">GET /api/users</a> - 用户列表</li>
  <li><a href="${apiBase}/overview">GET /api/overview</a> - 全局概览</li>
</ul>
</body>
</html>`, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
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
          valid: aiEnabled, // 配置齐全即视为可用（实际调用时再验证）
          message: aiEnabled ? null : 'AI 未配置（需要 STARWAY_AI_BASE_URL、STARWAY_AI_API_KEY、STARWAY_AI_MODEL 三项齐全）',
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

    // ===== AI 接口（第二阶段，已启用）=====

    // GET /api/repos/*fullName/readme-summary
    // 生成仓库深度分析（摘要 + 星标原因 + 复用建议），支持中英文双语缓存
    const readmeMatch = matchRoute('/api/repos/*/readme-summary', pathname)
    if (method === 'GET' && readmeMatch) {
      const fullName = decodePathParam(readmeMatch['*'] || '')
      const query = parseQuery(url)
      const force = query.force === '1'
      const lang = query.lang === 'en' ? 'en' : 'zh'
      const cacheKey = lang // 'zh' 或 'en'

      // 1. 查缓存（非强制刷新时）
      if (!force) {
        const cached = await repo.getCachedTranslation(fullName, cacheKey)
        if (cached) {
          // 兼容新格式（JSON: {summary, starReason, reuseAdvice}）和旧格式（纯文本）
          try {
            const parsed = JSON.parse(cached) as RepoAnalysisResult
            if (parsed.summary) {
              return dataResponse({ ...parsed, cached: true })
            }
          } catch {
            // 旧格式纯文本，作为 summary 返回
          }
          return dataResponse({ summary: cached, starReason: '', reuseAdvice: '', cached: true })
        }
      }

      // 2. 检查 AI 是否启用
      if (!aiEnabled) {
        throw new WorkerApiError(
          'AI 摘要功能未启用，请配置 STARWAY_AI_BASE_URL、STARWAY_AI_API_KEY、STARWAY_AI_MODEL',
          'AI_NOT_CONFIGURED',
          503,
        )
      }

      // 3. 查仓库基础信息
      const repoRow = await repo.getRepoGlobal(fullName)
      if (!repoRow) {
        throw new WorkerApiError(`仓库 ${fullName} 不存在`, 'REPO_NOT_FOUND', 404)
      }

      // 4. 解析 topics
      let topics: string[] = []
      try {
        if (repoRow.topics_json) topics = JSON.parse(repoRow.topics_json) as string[]
      } catch {
        topics = []
      }

      // 5. 生成中文分析（AI 失败时降级返回缓存）
      let analysis: RepoAnalysisResult
      try {
        analysis = await generateRepoAnalysis(
          fullName,
          repoRow.description || '',
          repoRow.language || '',
          topics,
          env,
        )
      } catch (err) {
        // AI 失败时降级返回缓存（如果有）
        const cached = await repo.getCachedTranslation(fullName, cacheKey === 'en' ? 'zh' : 'en')
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as RepoAnalysisResult
            if (parsed.summary) {
              return dataResponse({ ...parsed, cached: true })
            }
          } catch {
            // 旧格式纯文本
            return dataResponse({ summary: cached, starReason: '', reuseAdvice: '', cached: true })
          }
        }
        throw new WorkerApiError(
          err instanceof Error ? err.message : 'AI 生成摘要失败',
          'AI_ERROR',
          500,
        )
      }

      const now = new Date().toISOString()

      // 6. 缓存中文版本（JSON 字符串）
      await repo.upsertTranslation(fullName, 'zh', JSON.stringify(analysis), now)

      // 7. 翻译英文（失败不阻塞主流程）
      try {
        const enAnalysis = await translateRepoAnalysisToEnglish(analysis, env)
        await repo.upsertTranslation(fullName, 'en', JSON.stringify(enAnalysis), now)
      } catch {
        // 翻译失败不阻塞，中文版本已缓存可用
      }

      // 8. 返回请求语言版本
      let result = analysis
      if (lang === 'en') {
        const enCached = await repo.getCachedTranslation(fullName, 'en')
        if (enCached) {
          try {
            const parsed = JSON.parse(enCached) as RepoAnalysisResult
            if (parsed.summary) result = parsed
          } catch {
            // 英文缓存解析失败，用中文版
          }
        }
      }
      return dataResponse({ ...result, cached: false })
    }

    // GET /api/users/:login/star-dna
    // 生成开发者技术画像，支持中英文双语缓存
    const starDnaMatch = matchRoute('/api/users/:login/star-dna', pathname)
    if (method === 'GET' && starDnaMatch) {
      const login = normalizeRouteLogin(starDnaMatch.login)
      const query = parseQuery(url)
      const force = query.force === '1'
      const lang = query.lang === 'en' ? 'en' : 'zh'
      const cacheKey = `dna-${lang}`

      // 1. 校验用户存在
      const userExists = await repo.ensureUserExists(login)
      if (!userExists) {
        throw new WorkerApiError(`用户 ${login} 不存在`, 'USER_NOT_FOUND', 404)
      }

      // 2. 查缓存（非强制刷新时）
      if (!force) {
        const cached = await repo.getCachedTranslation(`user:${login}`, cacheKey)
        if (cached) {
          return dataResponse({ dna: cached, cached: true })
        }
        if (lang === 'en') {
          const cachedZh = await repo.getCachedTranslation(`user:${login}`, 'dna-zh')
          if (cachedZh) {
            try {
              const translated = await translateToEnglish(cachedZh, env)
              await repo.cacheUserAiTextPair(login, 'dna-zh', cachedZh, 'dna-en', translated, new Date().toISOString())
              return dataResponse({ dna: translated || cachedZh, cached: false })
            } catch {
              return dataResponse({ dna: cachedZh, cached: true })
            }
          }
        }
      }

      // 3. 检查 AI 是否启用
      await assertUserAiDataReady(repo, login)

      // 4. 检查 AI 是否启用
      if (!aiEnabled) {
        throw new WorkerApiError(
          'Star DNA 功能未启用，请配置 AI 相关环境变量',
          'AI_NOT_CONFIGURED',
          503,
        )
      }

      // 5. 校验星标数 > 0
      const starCount = await repo.getUserStarCount(login)
      if (starCount === 0) {
        throw new WorkerApiError(
          `用户 ${login} 暂无星标数据，请先同步星标`,
          'EMPTY_STAR_DATA',
          400,
        )
      }

      // 6. 收集统计
      const languages = await repo.getUserTopLanguages(login, 5)
      const tags = await repo.getUserTopTags(login, 8)
      const activeRepoCount = await repo.queryActiveRepoCount(login)
      const topRepos = await repo.getUserTopRepos(login, 5)

      // 7. 生成中文画像
      let dnaZh: string
      try {
        dnaZh = await generateStarDna(
          login,
          {
            repoCount: starCount,
            activeRepoCount,
            languages,
            tags,
            topRepos,
          },
          env,
        )
      } catch (err) {
        // AI 失败时降级返回缓存（如果有）
        const cached = await repo.getCachedTranslation(`user:${login}`, cacheKey)
        if (cached) {
          return dataResponse({ dna: cached, cached: true })
        }
        throw new WorkerApiError(
          err instanceof Error ? err.message : 'AI 生成画像失败',
          'AI_ERROR',
          500,
        )
      }

      // 8. 英文请求才同步翻译，中文请求不等待英文翻译。
      const now = new Date().toISOString()
      let dnaEn = ''
      if (lang === 'en') {
        try {
          dnaEn = await translateToEnglish(dnaZh, env)
        } catch {
          // 翻译失败不阻塞
        }
      }

      // 9. 缓存中英文（事务写入）
      await repo.cacheUserAiTextPair(login, 'dna-zh', dnaZh, 'dna-en', dnaEn, now)

      // 10. 返回请求语言版本
      const result = lang === 'en' ? (dnaEn || dnaZh) : dnaZh
      return dataResponse({ dna: result, cached: false })
    }

    // GET /api/users/:login/learning-path
    // 生成个性化学习路径，支持中英文双语缓存
    const learningMatch = matchRoute('/api/users/:login/learning-path', pathname)
    if (method === 'GET' && learningMatch) {
      const login = normalizeRouteLogin(learningMatch.login)
      const query = parseQuery(url)
      const force = query.force === '1'
      const lang = query.lang === 'en' ? 'en' : 'zh'
      const cacheKey = `learning-${lang}`

      // 1. 校验用户存在
      const userExists = await repo.ensureUserExists(login)
      if (!userExists) {
        throw new WorkerApiError(`用户 ${login} 不存在`, 'USER_NOT_FOUND', 404)
      }

      // 2. 查缓存（非强制刷新时）
      if (!force) {
        const cached = await repo.getCachedTranslation(`user:${login}`, cacheKey)
        if (cached) {
          return dataResponse({ path: cached, cached: true })
        }
        if (lang === 'en') {
          const cachedZh = await repo.getCachedTranslation(`user:${login}`, 'learning-zh')
          if (cachedZh) {
            try {
              const translated = await translateToEnglish(cachedZh, env)
              await repo.cacheUserAiTextPair(login, 'learning-zh', cachedZh, 'learning-en', translated, new Date().toISOString())
              return dataResponse({ path: translated || cachedZh, cached: false })
            } catch {
              return dataResponse({ path: cachedZh, cached: true })
            }
          }
        }
      }

      // 3. 校验最新同步是否完整
      await assertUserAiDataReady(repo, login)

      // 4. 检查 AI 是否启用
      if (!aiEnabled) {
        throw new WorkerApiError(
          '学习路径功能未启用，请配置 AI 相关环境变量',
          'AI_NOT_CONFIGURED',
          503,
        )
      }

      // 5. 校验星标数 > 0
      const starCount = await repo.getUserStarCount(login)
      if (starCount === 0) {
        throw new WorkerApiError(
          `用户 ${login} 暂无星标数据，请先同步星标`,
          'EMPTY_STAR_DATA',
          400,
        )
      }

      // 6. 收集统计（学习路径用更多标签和仓库）
      const languages = await repo.getUserTopLanguages(login, 5)
      const tags = await repo.getUserTopTags(login, 10)
      const topRepos = await repo.getUserTopRepos(login, 8)

      // 7. 生成中文学习路径
      let pathZh: string
      try {
        pathZh = await generateLearningPath(
          login,
          {
            repoCount: starCount,
            languages,
            tags,
            topRepos,
          },
          env,
        )
      } catch (err) {
        // AI 失败时降级返回缓存
        const cached = await repo.getCachedTranslation(`user:${login}`, cacheKey)
        if (cached) {
          return dataResponse({ path: cached, cached: true })
        }
        throw new WorkerApiError(
          err instanceof Error ? err.message : 'AI 生成学习路径失败',
          'AI_ERROR',
          500,
        )
      }

      // 8. 英文请求才同步翻译，中文请求不等待英文翻译。
      const now = new Date().toISOString()
      let pathEn = ''
      if (lang === 'en') {
        try {
          pathEn = await translateToEnglish(pathZh, env)
        } catch {
          // 翻译失败不阻塞
        }
      }

      // 9. 缓存中英文（事务写入）
      await repo.cacheUserAiTextPair(login, 'learning-zh', pathZh, 'learning-en', pathEn, now)

      // 10. 返回请求语言版本
      const result = lang === 'en' ? (pathEn || pathZh) : pathZh
      return dataResponse({ path: result, cached: false })
    }

    // ===== 以下接口仍返回 501 NOT_IMPLEMENTED =====

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
