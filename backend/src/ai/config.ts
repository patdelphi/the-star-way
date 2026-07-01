/**
 * AI Provider 配置类型
 * 定义 OpenAI 兼容的 API 配置结构
 * 仅框架定义，不实现具体调用
 */

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
 * 从环境变量加载 AI 配置
 * 环境变量：STARWAY_AI_BASE_URL, STARWAY_AI_API_KEY, STARWAY_AI_MODEL
 */
export function loadAiConfig(): AiProviderConfig {
  const base_url = process.env.STARWAY_AI_BASE_URL || ''
  const api_key = process.env.STARWAY_AI_API_KEY || ''
  const model = process.env.STARWAY_AI_MODEL || ''

  // 三项配置齐全才启用，避免半配置状态被误判为可用
  const enabled = !!(base_url && api_key && model)

  return {
    enabled,
    provider: 'openai-compatible',
    base_url,
    api_key,
    model,
  }
}
