/**
 * Worker 安全策略单元测试。
 *
 * 不启动 Miniflare，独立验证 CORS、安全响应头和 Rate Limiting 路由选择。
 */
import { describe, expect, it, vi } from 'vitest'
import type { Env } from '../env.js'
import {
  applySecurityHeaders,
  enforceRateLimit,
  isAllowedOrigin,
  rejectDisallowedPreflight,
} from '../security.js'

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    STARWAY_ALLOWED_ORIGINS: 'https://starway.patdelphi.xyz',
    ...overrides,
  }
}

describe('CORS 来源校验', () => {
  it('允许正式域名、Pages 部署域名和本地开发地址', () => {
    const env = makeEnv()
    expect(isAllowedOrigin('https://starway.patdelphi.xyz', env)).toBe(true)
    expect(isAllowedOrigin('https://a1b2c3d4.the-star-way.pages.dev', env)).toBe(true)
    expect(isAllowedOrigin('http://localhost:5173', env)).toBe(true)
  })

  it('拒绝无效或未配置来源', () => {
    const env = makeEnv()
    expect(isAllowedOrigin('https://attacker.example', env)).toBe(false)
    expect(isAllowedOrigin('not-a-url', env)).toBe(false)
  })

  it('拒绝未授权来源的预检请求', () => {
    const request = new Request('https://api.test/api/sync', {
      method: 'OPTIONS',
      headers: { Origin: 'https://attacker.example' },
    })
    expect(rejectDisallowedPreflight(request, makeEnv())?.status).toBe(403)
  })
})

describe('统一安全响应头', () => {
  it('允许来源获得精确 CORS 和完整安全头', () => {
    const request = new Request('https://api.test/api/users', {
      headers: { Origin: 'https://starway.patdelphi.xyz' },
    })
    const response = applySecurityHeaders(
      request,
      new Response('{}', {
        headers: { 'Access-Control-Allow-Origin': '*' },
      }),
      makeEnv(),
    )

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://starway.patdelphi.xyz')
    expect(response.headers.get('Vary')).toBe('Origin')
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'")
    expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=31536000')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    expect(response.headers.get('Permissions-Policy')).toContain('camera=()')
  })

  it('未授权来源不会继承旧的通配 CORS 头', () => {
    const request = new Request('https://api.test/api/users', {
      headers: { Origin: 'https://attacker.example' },
    })
    const response = applySecurityHeaders(
      request,
      new Response('{}', {
        headers: { 'Access-Control-Allow-Origin': '*' },
      }),
      makeEnv(),
    )

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})

describe('高成本接口限流', () => {
  it('写操作超过限制时返回 429', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false })
    const env = makeEnv({
      WRITE_RATE_LIMITER: { limit } as RateLimit,
    })
    const request = new Request('https://api.test/api/sync', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '203.0.113.20' },
    })

    const response = await enforceRateLimit(request, env)
    expect(response?.status).toBe(429)
    expect(response?.headers.get('Retry-After')).toBe('60')
    expect(limit).toHaveBeenCalledWith({ key: '203.0.113.20:sync' })
  })

  it('AI 限流按具体路由分组', async () => {
    const limit = vi.fn().mockResolvedValue({ success: true })
    const env = makeEnv({
      AI_RATE_LIMITER: { limit } as RateLimit,
    })
    const request = new Request('https://api.test/api/users/testuser/learning-path', {
      headers: { 'CF-Connecting-IP': '203.0.113.21' },
    })

    expect(await enforceRateLimit(request, env)).toBeNull()
    expect(limit).toHaveBeenCalledWith({ key: '203.0.113.21:learning-path' })
  })

  it('binding 异常时保持原接口可用', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const limit = vi.fn().mockRejectedValue(new Error('unavailable'))
    const env = makeEnv({
      AI_RATE_LIMITER: { limit } as RateLimit,
    })
    const request = new Request('https://api.test/api/users/testuser/star-dna')

    expect(await enforceRateLimit(request, env)).toBeNull()
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('普通只读接口不调用限流 binding', async () => {
    const limit = vi.fn()
    const env = makeEnv({
      AI_RATE_LIMITER: { limit } as RateLimit,
    })
    const request = new Request('https://api.test/api/users')

    expect(await enforceRateLimit(request, env)).toBeNull()
    expect(limit).not.toHaveBeenCalled()
  })
})
