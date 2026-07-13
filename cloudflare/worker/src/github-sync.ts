/**
 * Worker 版 GitHub Star 同步流程
 * 将 GitHub API 返回的 starred repos 同步到 Cloudflare D1
 *
 * 与 backend/src/sync/star-syncer.ts 的差异：
 * - 数据库操作使用 D1StarRepository（异步、batch 替代 transaction）
 * - 单次请求分页上限可配置，超过本批次返回 continuation 游标
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

export interface SyncContinuationOptions {
  syncId?: number
}

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
  options: SyncContinuationOptions = {},
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
  let syncRunId: number
  let startPage = 1
  let reposUpsertedBefore = 0
  let starsUpsertedBefore = 0
  let pagesFetchedBefore = 0

  if (options.syncId !== undefined) {
    const existingRun = await repo.getSyncRun(options.syncId, profile.login)
    if (!existingRun || existingRun.status === 'success') {
      throw new GitHubSyncError('同步续传任务不存在或已完成', 'SYNC_CONTINUATION_INVALID', undefined, false)
    }
    syncRunId = existingRun.id
    startPage = existingRun.next_page
    reposUpsertedBefore = existingRun.repos_upserted
    starsUpsertedBefore = existingRun.stars_upserted
    pagesFetchedBefore = existingRun.pages_fetched
    await repo.resumeSyncRun(syncRunId, startPage)
  } else {
    syncRunId = await repo.insertSyncRun(profile.login, now)
  }

  await repo.upsertUserForSync(profile.login, now)

  // 3. 分页拉取当前批次的 starred repos
  let totalPages = 0
  let rateLimit: RateLimitInfo | null = null
  let complete = true
  let nextPage: number | undefined
  let warning: string | undefined
  let repos: Awaited<ReturnType<typeof client.listStarredRepos>>['repos'] = []

  try {
    const syncResult = await client.listStarredRepos(username, (page) => {
      totalPages = page
    }, startPage)
    repos = syncResult.repos
    rateLimit = syncResult.rateLimit
    totalPages = syncResult.totalPages
    complete = syncResult.complete
    nextPage = syncResult.nextPage
    warning = syncResult.warning
  } catch (err) {
    // 分页拉取失败：更新 sync_runs 后重抛
    const errorMessage = err instanceof Error ? err.message : String(err)
    await repo.updateSyncRunFailure(syncRunId, new Date().toISOString(), errorMessage)
    throw err
  }

  // 4. 批量 upsert 仓库和星标
  let upsertResult: { reposUpserted: number; starsUpserted: number }
  try {
    upsertResult = await repo.batchUpsertReposAndStars(profile.login, repos, now, syncRunId)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    await repo.updateSyncRunFailure(syncRunId, new Date().toISOString(), `DB 写入失败: ${errorMessage}`)
    throw err
  }

  const reposUpserted = reposUpsertedBefore + upsertResult.reposUpserted
  const starsUpserted = starsUpsertedBefore + upsertResult.starsUpserted
  const pagesFetched = pagesFetchedBefore + totalPages

  // 5. 只有完整同步的最终批次才标记 removed_at
  let reposMarkedRemoved = 0
  if (complete) {
    try {
      reposMarkedRemoved = await repo.markRemovedStarsBySyncRun(profile.login, syncRunId, now)
    } catch (err) {
      // markRemoved 失败不影响整体同步，记录日志即可
      console.warn('markRemovedStars 失败，不影响同步结果:', err)
    }
  }

  // 6. 更新用户资料（含 avatar、bio 等扩展字段）
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

  // 7. 更新 sync_runs 状态：完整同步才是 success，未完成则返回下一页游标。
  if (complete) {
    try {
      await repo.clearUserAiCache(profile.login)
    } catch (err) {
      console.warn('clearUserAiCache 失败，不影响同步结果:', err)
    }
    await repo.updateSyncRunSuccess(
      syncRunId,
      new Date().toISOString(),
      reposUpserted,
      starsUpserted,
      reposMarkedRemoved,
      pagesFetched,
      rateLimit?.remaining ?? null,
      rateLimit?.reset ? new Date(rateLimit.reset * 1000).toISOString() : null,
    )
  } else {
    await repo.updateSyncRunPartial(
      syncRunId,
      new Date().toISOString(),
      reposUpserted,
      starsUpserted,
      pagesFetched,
      rateLimit?.remaining ?? null,
      rateLimit?.reset ? new Date(rateLimit.reset * 1000).toISOString() : null,
      warning ?? 'Worker 同步未完整完成',
      nextPage ?? startPage + totalPages,
    )
  }

  return {
    username: profile.login,
    syncedAt: now,
    reposUpserted: reposUpserted,
    starsUpserted: starsUpserted,
    reposMarkedRemoved,
    totalPages: pagesFetched,
    rateLimit,
    complete,
    syncId: syncRunId,
    ...(complete ? {} : { nextPage }),
    warning,
  }
}
