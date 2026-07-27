/**
 * Cloudflare Worker 统一安全防护。
 *
 * 职责：
 * - 为所有响应补充安全响应头和精确 CORS 来源。
 * - 拒绝未授权来源的浏览器预检请求。
 * - 使用 Cloudflare Rate Limiting binding 限制写操作和 AI 高成本接口。
 */
import type { Env } from './env.js'
import { WorkerApiError, errorResponse } from './errors.js'

const CORS_METHODS = 'GET, POST, DELETE, OPTIONS'
const CORS_HEADERS = 'Content-Type'
const RATE_LIMIT_RETRY_SECONDS = 60

const DEFAULT_ALLOWED_ORIGINS = new Set([
  'https://starway.patdelphi.xyz',
  'https://the-star-way.pages.dev',
])

/**
 * 判断请求来源是否属于正式前端、Pages 项目部署或本地开发地址。
 */
export function isAllowedOrigin(origin: string, env: Env): boolean {
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }

  const normalizedOrigin = parsed.origin
  const configuredOrigins = (env.STARWAY_ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)

  if (DEFAULT_ALLOWED_ORIGINS.has(normalizedOrigin) || configuredOrigins.includes(normalizedOrigin)) {
    return true
  }

  if (
    parsed.protocol === 'https:' &&
    parsed.hostname.endsWith('.the-star-way.pages.dev')
  ) {
    return true
  }

  return (
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
    (parsed.port === '5173' || parsed.port === '5174')
  )
}

/**
 * 未授权来源的预检请求直接返回 403，避免浏览器继续发送高成本请求。
 */
export function rejectDisallowedPreflight(request: Request, env: Env): Response | null {
  const origin = request.headers.get('Origin')
  if (
    request.method === 'OPTIONS' &&
    origin &&
    !isAllowedOrigin(origin, env)
  ) {
    return new Response(null, { status: 403 })
  }
  return null
}

/**
 * 给响应补充统一安全头，并仅为允许来源返回 CORS 授权。
 */
export function applySecurityHeaders(request: Request, response: Response, env: Env): Response {
  const headers = new Headers(response.headers)
  const origin = request.headers.get('Origin')

  headers.delete('Access-Control-Allow-Origin')
  headers.delete('Access-Control-Allow-Methods')
  headers.delete('Access-Control-Allow-Headers')

  const vary = headers.get('Vary')
  if (!vary || !vary.split(',').some(value => value.trim().toLowerCase() === 'origin')) {
    headers.set('Vary', vary ? `${vary}, Origin` : 'Origin')
  }

  if (origin && isAllowedOrigin(origin, env)) {
    headers.set('Access-Control-Allow-Origin', new URL(origin).origin)
    headers.set('Access-Control-Allow-Methods', CORS_METHODS)
    headers.set('Access-Control-Allow-Headers', CORS_HEADERS)
  }

  headers.set(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
  )
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Referrer-Policy', 'no-referrer')
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  )

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

interface RateLimitTarget {
  limiter: RateLimit | undefined
  keySuffix: string
}

/**
 * 只限制会写入 D1、消耗 GitHub 配额或调用 AI 的接口。
 */
function getRateLimitTarget(request: Request, env: Env): RateLimitTarget | null {
  const url = new URL(request.url)
  const pathname = url.pathname

  if (request.method === 'POST' && pathname === '/api/sync') {
    return { limiter: env.WRITE_RATE_LIMITER, keySuffix: 'sync' }
  }

  if (
    request.method === 'POST' &&
    /^\/api\/users\/[^/]+\/classify$/.test(pathname)
  ) {
    return { limiter: env.WRITE_RATE_LIMITER, keySuffix: 'classify' }
  }

  if (request.method !== 'GET') return null

  if (/^\/api\/repos\/.+\/readme-summary$/.test(pathname)) {
    return { limiter: env.AI_RATE_LIMITER, keySuffix: 'readme-summary' }
  }
  if (/^\/api\/users\/[^/]+\/star-dna$/.test(pathname)) {
    return { limiter: env.AI_RATE_LIMITER, keySuffix: 'star-dna' }
  }
  if (/^\/api\/users\/[^/]+\/learning-path$/.test(pathname)) {
    return { limiter: env.AI_RATE_LIMITER, keySuffix: 'learning-path' }
  }

  return null
}

/**
 * 执行 Cloudflare 原生限流。binding 缺失或临时异常时保持向后兼容。
 */
export async function enforceRateLimit(request: Request, env: Env): Promise<Response | null> {
  const target = getRateLimitTarget(request, env)
  if (!target?.limiter) return null

  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown'
  try {
    const outcome = await target.limiter.limit({
      key: `${clientIp}:${target.keySuffix}`,
    })
    if (outcome.success) return null

    const response = errorResponse(new WorkerApiError(
      '请求过于频繁，请稍后重试',
      'RATE_LIMITED',
      429,
    ))
    response.headers.set('Retry-After', String(RATE_LIMIT_RETRY_SECONDS))
    return response
  } catch (err) {
    console.error(`Rate Limiting binding 调用失败 (${target.keySuffix}):`, err)
    return null
  }
}
