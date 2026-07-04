/**
 * Worker 统一错误类型与响应格式
 * 与 Node 后端保持一致的错误结构：{ error: { code, message } }
 */

/**
 * Worker API 错误
 * 携带 code、statusCode，用于生成统一 JSON 错误响应
 */
export class WorkerApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message)
    this.name = 'WorkerApiError'
  }
}

/**
 * 构造 JSON 错误响应
 * 与 Node 后端 routes.ts 中的 error() 函数保持一致
 */
export function errorResponse(err: unknown): Response {
  // 已知业务错误
  if (err instanceof WorkerApiError) {
    return jsonResponse(
      { error: { code: err.code, message: err.message } },
      err.statusCode,
    )
  }

  // 未知错误统一返回 500
  const message = err instanceof Error ? err.message : String(err)
  console.error('Worker 未捕获异常:', err)
  return jsonResponse(
    { error: { code: 'INTERNAL_ERROR', message: `服务器内部错误: ${message}` } },
    500,
  )
}

/**
 * 构造 JSON 成功响应
 * 统一包装为 { data: ... } 结构，与 Node 后端一致
 */
export function dataResponse<T>(data: T, status = 200): Response {
  return jsonResponse({ data }, status)
}

/**
 * 构造带 CORS 头的 JSON 响应
 */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

/**
 * 构造 CORS 预检响应
 */
export function corsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
