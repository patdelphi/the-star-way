/**
 * AI Provider 配置（Worker 版）
 * 从 Worker env 读取配置，三项齐全才启用
 *
 * 环境变量（通过 wrangler secret put 写入）：
 * - STARWAY_AI_BASE_URL: OpenAI 兼容 API 基础 URL
 * - STARWAY_AI_API_KEY: API Key
 * - STARWAY_AI_MODEL: 模型名
 */
import type { Env } from '../env.js'

// AI Provider 配置（OpenAI 兼容接口）
export interface AiProviderConfig {
  // 是否启用 AI 功能
  enabled: boolean
  // provider 类型（预留扩展）
  provider: 'openai-compatible'
  // API 基础 URL
  base_url: string
  // API Key
  api_key: string
  // 模型名称
  model: string
}

// 默认配置（AI 功能默认关闭）
export const DEFAULT_AI_CONFIG: AiProviderConfig = {
  enabled: false,
  provider: 'openai-compatible',
  base_url: '',
  api_key: '',
  model: '',
}

/**
 * 从 Worker env 加载 AI 配置
 * 三项配置齐全才启用，避免半配置状态被误判为可用
 */
export function loadAiConfig(env: Env): AiProviderConfig {
  const base_url = env.STARWAY_AI_BASE_URL || ''
  const api_key = env.STARWAY_AI_API_KEY || ''
  const model = env.STARWAY_AI_MODEL || ''

  // 三项配置齐全才启用
  const enabled = !!(base_url && api_key && model)

  return {
    enabled,
    provider: 'openai-compatible',
    base_url,
    api_key,
    model,
  }
}

/**
 * 判断 AI 功能是否已配置
 * 与 env.ts 中的 isAiConfigured 保持兼容
 */
export function isAiConfigured(env: Env): boolean {
  return loadAiConfig(env).enabled
}
