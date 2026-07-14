/**
 * GitHub 客户端网络边界测试。
 * 使用本地 mock 验证请求卡住时能够超时返回，不调用真实 GitHub API。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GitHubClient } from '../github-client.js'

describe('GitHubClient 网络超时', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('用户资料请求卡住时应超时结束', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_input: string, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('请求已取消', 'AbortError'))
        })
      })
    )))

    const request = new GitHubClient().getUserProfile('slow-user')
    const result = expect(request).rejects.toMatchObject({
      code: 'GITHUB_TIMEOUT',
      retryable: true,
    })
    await vi.advanceTimersByTimeAsync(30_000)
    await result
  })
})
