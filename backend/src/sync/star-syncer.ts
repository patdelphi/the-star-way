/**
 * GitHub Star 同步模块
 * 将 GitHub API 返回的 starred repos 同步到本地 SQLite
 * 支持增量同步、removed_at 标记、upsert 防重复
 */
import type Database from 'better-sqlite3'
import { createConnection, initDatabase, withTransaction } from '../db/connection.js'
import { GitHubClient, type GitHubStarredRepo, type RateLimitInfo } from './github-client.js'
import type { GitHubClientConfig } from './github-client.js'
import { GitHubSyncError } from './errors.js'
import { mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * 同步结果（不含 API 交互的版本）
 */
export interface StarSyncResult {
  username: string
  syncedAt: string
  reposUpserted: number
  starsUpserted: number
  reposMarkedRemoved: number
  totalPages: number
  rateLimit: RateLimitInfo | null
}

/**
 * 规范化 GitHub 用户名输入：支持 @login、GitHub 用户主页 URL 和首尾空白。
 */
export function normalizeGitHubUsername(input: string): string {
  let value = input.trim()
  value = value.replace(/^https?:\/\/github\.com\//i, '')
  value = value.split(/[/?#]/)[0] || value
  return value.replace(/^@+/, '').trim()
}

/**
 * 执行 GitHub Star 同步
 * @param db 数据库连接（如果未传则自动创建）
 * @param username GitHub 用户名
 * @param config GitHub client 配置（token 等）
 * @param dbPath 数据库路径（自动创建连接时使用）
 */
export async function syncStars(
  db: Database.Database,
  username: string,
  config: GitHubClientConfig = {},
): Promise<StarSyncResult> {
  username = normalizeGitHubUsername(username)
  if (!username) {
    throw new GitHubSyncError('缺少有效的 GitHub 用户名', 'GITHUB_INVALID_USERNAME', undefined, false)
  }

  const client = new GitHubClient(config)
  const now = new Date().toISOString()

  let profile
  profile = await client.getUserProfile(username)

  // GitHub 用户资料验证成功后再创建本地用户，避免搜索添加失败时污染用户列表。
  db.prepare(`
    INSERT INTO users (login, synced_at) VALUES (?, ?)
    ON CONFLICT(login) DO UPDATE SET synced_at = excluded.synced_at
  `).run(username, now)

  // 创建 sync_runs 记录
  const insertSyncRun = db.prepare(`
    INSERT INTO sync_runs (user_login, started_at, status)
    VALUES (?, ?, 'running')
  `)
  const syncRunResult = insertSyncRun.run(username, now)
  const syncRunId = syncRunResult.lastInsertRowid as number

  // 用于收集分页信息
  let totalPages = 0
  let rateLimit: RateLimitInfo | null = null

  // 分页获取 starred repos
  let syncResult: { repos: GitHubStarredRepo[]; rateLimit: RateLimitInfo | null }
  try {
    syncResult = await client.listStarredRepos(username, (page) => {
      totalPages = page
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    db.prepare(`UPDATE sync_runs SET status = 'failed', ended_at = ?, error_message = ? WHERE id = ?`)
      .run(new Date().toISOString(), errorMessage, syncRunId)
    throw err
  }
  const { repos, rateLimit: rl } = syncResult
  rateLimit = rl

  // 本次获取的仓库 full_name 集合
  const seenFullNames = new Set(repos.map(r => r.repo.full_name))

  // 在事务中执行 upsert 和 removed 标记
  const result = withTransaction(db, () => {
    // upsert 用户（保存 GitHub 公开资料扩展字段）
    const upsertUser = db.prepare(`
      INSERT INTO users (login, avatar_url, profile_url, synced_at, name, bio, company, location, followers, public_repos)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(login) DO UPDATE SET
        avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
        profile_url = COALESCE(excluded.profile_url, users.profile_url),
        synced_at = excluded.synced_at,
        name = COALESCE(excluded.name, users.name),
        bio = COALESCE(excluded.bio, users.bio),
        company = COALESCE(excluded.company, users.company),
        location = COALESCE(excluded.location, users.location),
        followers = COALESCE(excluded.followers, users.followers),
        public_repos = COALESCE(excluded.public_repos, users.public_repos)
    `)

    upsertUser.run(
      profile.login,
      profile.avatar_url,
      profile.html_url,
      now,
      profile.name,
      profile.bio,
      profile.company,
      profile.location,
      profile.followers,
      profile.public_repos,
    )

    // upsert 仓库
    const upsertRepo = db.prepare(`
      INSERT INTO repos (github_id, full_name, owner, name, html_url, description, language, license,
        stars, forks, open_issues, topics_json, created_at, updated_at, pushed_at, archived, fork, homepage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(full_name) DO UPDATE SET
        description = excluded.description,
        language = excluded.language,
        license = excluded.license,
        stars = excluded.stars,
        forks = excluded.forks,
        open_issues = excluded.open_issues,
        topics_json = excluded.topics_json,
        updated_at = excluded.updated_at,
        pushed_at = excluded.pushed_at,
        archived = excluded.archived,
        fork = excluded.fork,
        homepage = excluded.homepage
    `)

    // upsert 星标
    const upsertStar = db.prepare(`
      INSERT INTO stars (user_login, repo_full_name, starred_at, first_seen_at, last_seen_at, removed_at)
      VALUES (?, ?, ?, ?, ?, NULL)
      ON CONFLICT(user_login, repo_full_name) DO UPDATE SET
        starred_at = excluded.starred_at,
        last_seen_at = excluded.last_seen_at,
        removed_at = NULL
    `)

    let reposUpserted = 0
    let starsUpserted = 0

    for (const item of repos) {
      const repo = item.repo

      upsertRepo.run(
        repo.id,
        repo.full_name,
        repo.owner.login,
        repo.name,
        repo.html_url,
        repo.description,
        repo.language,
        repo.license?.spdx_id ?? null,
        repo.stargazers_count,
        repo.forks_count,
        repo.open_issues_count,
        JSON.stringify(repo.topics),
        repo.created_at,
        repo.updated_at,
        repo.pushed_at,
        repo.archived ? 1 : 0,
        repo.fork ? 1 : 0,
        repo.homepage,
      )
      reposUpserted++

      upsertStar.run(
        username,
        repo.full_name,
        item.starred_at,
        now, // first_seen_at：首次在本次同步中见到
        now,
      )
      starsUpserted++
    }

    // 标记 removed_at：本地有但本次 API 未返回的仓库
    let reposMarkedRemoved = 0
    if (reposUpserted > 0) {
      const markRemoved = db.prepare(`
        UPDATE stars SET removed_at = ?
        WHERE user_login = ? AND removed_at IS NULL AND repo_full_name NOT IN (${Array.from(seenFullNames).map(() => '?').join(',')})
      `)

      const removedResult = markRemoved.run(now, username, ...seenFullNames)
      reposMarkedRemoved = removedResult.changes
    }

    return { reposUpserted, starsUpserted, reposMarkedRemoved }
  })

  // 更新 sync_runs 为成功状态
  const endedAt = new Date().toISOString()
  db.prepare(`
    UPDATE sync_runs SET
      status = 'success',
      ended_at = ?,
      repos_upserted = ?,
      stars_upserted = ?,
      repos_removed = ?,
      pages_fetched = ?,
      rate_limit_remaining = ?,
      rate_limit_reset = ?
    WHERE id = ?
  `).run(
    endedAt,
    result.reposUpserted,
    result.starsUpserted,
    result.reposMarkedRemoved,
    totalPages,
    rateLimit?.remaining ?? null,
    rateLimit?.reset ? new Date(rateLimit.reset * 1000).toISOString() : null,
    syncRunId,
  )

  return {
    username,
    syncedAt: now,
    ...result,
    totalPages,
    rateLimit,
  }
}

/**
 * 便捷方法：使用默认数据库路径同步
 */
export async function syncStarsWithDefaultDb(
  username: string,
  config: GitHubClientConfig = {},
  dbPath?: string,
): Promise<StarSyncResult> {
  const resolvedPath = dbPath ?? join(process.cwd(), 'data', 'starway.db')
  const dir = dirname(resolvedPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const db = createConnection(resolvedPath)
  initDatabase(db)

  try {
    return await syncStars(db, username, config)
  } finally {
    db.close()
  }
}
