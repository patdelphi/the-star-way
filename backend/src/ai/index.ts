/**
 * the-star-way AI 模块统一导出
 * 仅框架定义，不实现具体 AI 调用
 */
export { loadAiConfig, DEFAULT_AI_CONFIG } from './config.js'
export type { AiProviderConfig } from './config.js'
export { cacheTranslation, getCachedTranslation, cacheAnalysisReport, getCachedAnalysisReport } from './cache.js'
