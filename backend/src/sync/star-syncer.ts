/**
 * GitHub Star 同步模块
 * 将 GitHub API 返回的 starred repos 同步到本地 SQLite
 * 支持增量同步、removed_at 标记、upsert 防重复
 */
import type Database from 'better-sqlite3'
import { createConnection, initDatabase, withTransaction } from '../db/connection.js'
import { GitHubClient, type GitHubStarredRepo, type SyncResult, type RateLimitInfo } from './github-client.js'
import type { GitHubClientConfig } from './github-client.js'
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
  const client = new GitHubClient(config)
  const now = new Date().toISOString()

  // 用于收集分页信息
  let totalPages = 0
  let rateLimit: RateLimitInfo | null = null

  // 分页获取 starred repos
  const { repos, rateLimit: rl } = await client.listStarredRepos(username, (page) => {
    totalPages = page
  })
  rateLimit = rl

  // 本次获取的仓库 full_name 集合
  const seenFullNames = new Set(repos.map(r => r.repo.full_name))

  // 在事务中执行 upsert 和 removed 标记
  const result = withTransaction(db, () => {
    // upsert 用户
    const upsertUser = db.prepare(`
      INSERT INTO users (login, avatar_url, profile_url, synced_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(login) DO UPDATE SET
        avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
        synced_at = excluded.synced_at
    `)

    // 获取第一个 repo 的 avatar（如果有的话）
    const avatarUrl = repos.length > 0 ? repos[0].repo.owner.avatar_url : null
    upsertUser.run(username, avatarUrl, `https://github.com/${username}`, now)

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
