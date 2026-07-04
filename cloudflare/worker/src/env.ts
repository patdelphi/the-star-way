/**
 * Worker 环境变量与配置类型
 * Worker 运行时通过 env 注入 D1 数据库绑定和 secrets
 */

/**
 * Worker 环境变量
 * - DB: D1 数据库绑定（在 wrangler.toml 中声明）
 * - STARWAY_GITHUB_TOKEN: GitHub Token（通过 wrangler secret put 写入）
 * - STARWAY_AI_BASE_URL / API_KEY / MODEL: AI 配置（三项齐全才启用）
 */
export interface Env {
  // D1 数据库绑定
  DB: D1Database

  // GitHub Token（secret）
  STARWAY_GITHUB_TOKEN?: string

  // 前端 URL（非敏感，配置在 wrangler.toml [vars]）
  // 用于根路径 / 重定向到前端 Pages
  STARWAY_FRONTEND_URL?: string

  // AI 配置（通过 wrangler secret put 写入，三项齐全才启用）
  STARWAY_AI_BASE_URL?: string
  STARWAY_AI_API_KEY?: string
  STARWAY_AI_MODEL?: string
}

/**
 * 从 Worker env 读取 GitHub Token
 * Worker 版本简化为只读 env，不支持请求 body 传 token（MVP 安全考虑）
 */
export function resolveGitHubToken(env: Env): string | undefined {
  return env.STARWAY_GITHUB_TOKEN || undefined
}

/**
 * 获取 GitHub Token 来源标识（用于 /api/token-source 接口）
 */
export function getGitHubTokenSource(env: Env): string | null {
  if (env.STARWAY_GITHUB_TOKEN) return 'STARWAY_GITHUB_TOKEN'
  return null
}

/**
 * 判断 AI 功能是否已配置
 * 三项配置（BASE_URL/API_KEY/MODEL）齐全才返回 true
 * 实际配置加载逻辑见 ai/config.ts
 */
export function isAiConfigured(env: Env): boolean {
  return !!(env.STARWAY_AI_BASE_URL && env.STARWAY_AI_API_KEY && env.STARWAY_AI_MODEL)
}
