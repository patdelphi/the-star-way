/**
 * API 错误响应契约类型
 * 跨 Node 后端和 Cloudflare Worker 共用
 */

// 错误码枚举
export type ApiErrorCode =
  | 'USER_NOT_FOUND'
  | 'REPO_NOT_FOUND'
  | 'NOT_FOUND'
  | 'EMPTY_STAR_DATA'
  | 'SYNC_FAILED'
  | 'AI_UNAVAILABLE'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'API_ERROR'

// API 错误响应体
export interface ApiError {
  error: {
    code: ApiErrorCode | string
    message: string
  }
}

// 统一 JSON 响应包装
export interface ApiResponse<T = unknown> {
  data: T
}

// 错误响应构造辅助
export function createApiError(code: string, message: string): ApiError {
  return { error: { code, message } }
}
