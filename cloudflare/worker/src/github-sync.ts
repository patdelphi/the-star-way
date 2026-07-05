/**
 * Worker 版 GitHub Star 同步流程
 * 将 GitHub API 返回的 starred repos 同步到 Cloudflare D1
 *
 * 与 backend/src/sync/star-syncer.ts 的差异：
 * - 数据库操作使用 D1StarRepository（异步、batch 替代 transaction）
 * - 分页上限 20 页（2000 条），超过上限标记为 partial
 * - 不支持请求 body 传 token，token 仅从 env.STARWAY_GITHUB_TOKEN 读取
 * - 同步流程整体保留：profile 验证 → upsert user → sync_runs → 分页拉取 → batch upsert → markRemoved → 更新 sync_runs
 *
 * 失败处理：
 * - profile 拉取失败：直接抛错，不创建 sync_runs
 * - 分页拉取失败：更新 sync_runs 为 failed 后抛错
 * - DB 写入失败：更新 sync_runs 为 failed 后抛错
 */
import type { Env } from './env.js'
import { GitHubClient, type RateLimitInfo } from './github-client.js'
import { GitHubSyncError } from './sync-errors.js'
import { D1StarRepository } from './d1-repository.js'
import type { SyncResult } from '@shared/api-contracts/index.js'

/**
 * 同步结果
 */
export type StarSyncResult = SyncResult

/**
 * 规范化 GitHub 用户名输入：支持 @login、GitHub 用户主页 URL 和首尾空白。
 * 与 backend 版本保持一致的规范化逻辑
 */
export function normalizeGitHubUsername(input: string): string {
  let value = input.trim()
  value = value.replace(/^https?:\/\/github\.com\//i, '')
  value = value.split(/[/?#]/)[0] || value
  return value.replace(/^@+/, '').trim()
}

/**
 * 解析 Worker 单次同步最大页数，非法配置回退到 GitHubClient 默认值。
 */
function parseMaxPages(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return undefined
  return parsed
}

/**
 * 执行 GitHub Star 同步（Worker 版本）
 * @param env Worker 环境变量（含 D1 绑定和 GitHub Token）
 * @param usernameInput GitHub 用户名（支持 @login、URL 等输入形式）
 * @param token GitHub Token（从 env.STARWAY_GITHUB_TOKEN 解析得到）
 */
export async function syncStars(
  env: Env,
  usernameInput: string,
  token?: string,
): Promise<StarSyncResult> {
  const username = normalizeGitHubUsername(usernameInput)
  if (!username) {
    throw new GitHubSyncError('缺少有效的 GitHub 用户名', 'GITHUB_INVALID_USERNAME', undefined, false)
  }

  if (!token) {
    throw new GitHubSyncError(
      'Worker 未配置 STARWAY_GITHUB_TOKEN，无法执行同步',
      'GITHUB_NO_TOKEN',
      undefined,
      false,
    )
  }

  const client = new GitHubClient({ token, maxPages: parseMaxPages(env.STARWAY_GITHUB_MAX_PAGES) })
  const repo = new D1StarRepository(env.DB)
  const now = new Date().toISOString()

  // 1. 拉取 GitHub 用户资料（验证用户存在）
  // 失败则直接抛错，避免污染用户列表
  const profile = await client.getUserProfile(username)

  // 2. 创建用户记录（标记未删除）
  await repo.upsertUserForSync(profile.login, now)

  // 3. 创建 sync_runs 记录
  const syncRunId = await repo.insertSyncRun(profile.login, now)

  // 4. 分页拉取 starred repos
  let totalPages = 0
  let rateLimit: RateLimitInfo | null = null
  let complete = true
  let warning: string | undefined
  let repos: Awaited<ReturnType<typeof client.listStarredRepos>>['repos'] = []

  try {
    const syncResult = await client.listStarredRepos(username, (page) => {
      totalPages = page
    })
    repos = syncResult.repos
    rateLimit = syncResult.rateLimit
    totalPages = syncResult.totalPages
    complete = syncResult.complete
    warning = syncResult.warning
  } catch (err) {
    // 分页拉取失败：更新 sync_runs 后重抛
    const errorMessage = err instanceof Error ? err.message : String(err)
    await repo.updateSyncRunFailure(syncRunId, new Date().toISOString(), errorMessage)
    throw err
  }

  // 5. 批量 upsert 仓库和星标
  let upsertResult: { reposUpserted: number; starsUpserted: number }
  try {
    upsertResult = await repo.batchUpsertReposAndStars(profile.login, repos, now)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    await repo.updateSyncRunFailure(syncRunId, new Date().toISOString(), `DB 写入失败: ${errorMessage}`)
    throw err
  }

  // 6. 标记 removed_at：本地有但本次 API 未返回的仓库
  let reposMarkedRemoved = 0
  if (complete && upsertResult.reposUpserted > 0) {
    const seenFullNames = repos.map(r => r.repo.full_name)
    try {
      reposMarkedRemoved = await repo.markRemovedStars(profile.login, seenFullNames, now)
    } catch (err) {
      // markRemoved 失败不影响整体同步，记录日志即可
      console.warn('markRemovedStars 失败，不影响同步结果:', err)
    }
  }

  // 7. 更新用户资料（含 avatar、bio 等扩展字段）
  try {
    await repo.upsertUserProfile(
      {
        login: profile.login,
        avatar_url: profile.avatar_url,
        html_url: profile.html_url,
        name: profile.name,
        bio: profile.bio,
        company: profile.company,
        location: profile.location,
        followers: profile.followers,
        public_repos: profile.public_repos,
      },
      now,
    )
  } catch (err) {
    // profile 更新失败不影响同步结果
    console.warn('upsertUserProfile 失败，不影响同步结果:', err)
  }

  // 8. 同步后清理用户级 AI 缓存，避免旧画像/学习路径继续展示。
  try {
    await repo.clearUserAiCache(profile.login)
  } catch (err) {
    console.warn('clearUserAiCache 失败，不影响同步结果:', err)
  }

  // 9. 更新 sync_runs 状态：完整同步才是 success，达到 Worker 上限则为 partial。
  if (complete) {
    await repo.updateSyncRunSuccess(
      syncRunId,
      new Date().toISOString(),
      upsertResult.reposUpserted,
      upsertResult.starsUpserted,
      reposMarkedRemoved,
      totalPages,
      rateLimit?.remaining ?? null,
      rateLimit?.reset ? new Date(rateLimit.reset * 1000).toISOString() : null,
    )
  } else {
    await repo.updateSyncRunPartial(
      syncRunId,
      new Date().toISOString(),
      upsertResult.reposUpserted,
      upsertResult.starsUpserted,
      totalPages,
      rateLimit?.remaining ?? null,
      rateLimit?.reset ? new Date(rateLimit.reset * 1000).toISOString() : null,
      warning ?? 'Worker 同步未完整完成',
    )
  }

  return {
    username: profile.login,
    syncedAt: now,
    reposUpserted: upsertResult.reposUpserted,
    starsUpserted: upsertResult.starsUpserted,
    reposMarkedRemoved,
    totalPages,
    rateLimit,
    complete,
    warning,
  }
}
