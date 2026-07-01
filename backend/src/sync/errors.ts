/**
 * the-star-way GitHub 同步错误类型定义
 */
export class GitHubSyncError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
    public readonly retryAfter?: number,
  ) {
    super(message)
    this.name = 'GitHubSyncError'
  }
}

/**
 * 根据状态码创建对应的同步错误
 */
export function createSyncError(statusCode: number, message: string): GitHubSyncError {
  switch (statusCode) {
    case 401:
      return new GitHubSyncError(
        `Token 无效或权限不足：${message}`,
        'GITHUB_UNAUTHORIZED',
        statusCode,
        false,
      )
    case 403:
      // 403 可能是权限不足或 rate limit
      return new GitHubSyncError(
        `权限不足或 API 限制：${message}`,
        'GITHUB_FORBIDDEN',
        statusCode,
        false,
      )
    case 404:
      return new GitHubSyncError(
        `用户不存在或仓库不可见：${message}`,
        'GITHUB_NOT_FOUND',
        statusCode,
        false,
      )
    case 429:
      return new GitHubSyncError(
        `GitHub API 限流，请稍后重试：${message}`,
        'GITHUB_RATE_LIMITED',
        statusCode,
        false,
      )
    default:
      if (statusCode >= 500) {
        return new GitHubSyncError(
          `GitHub 服务错误（${statusCode}）：${message}`,
          'GITHUB_SERVER_ERROR',
          statusCode,
          true,
        )
      }
      return new GitHubSyncError(
        `GitHub API 错误（${statusCode}）：${message}`,
        'GITHUB_API_ERROR',
        statusCode,
        false,
      )
  }
}
