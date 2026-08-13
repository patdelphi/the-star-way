/**
 * GitHub Star 同步模块
 * 将 GitHub API 返回的 starred repos 同步到本地 SQLite
 * 支持增量同步、removed_at 标记、upsert 防重复
 */
import type Database from 'better-sqlite3'
import { createConnection, initDatabase, withTransaction } from '../db/connection.js'
import { GitHubClient, type GitHubStarredRepo, type GitHubOwnedRepo, type RateLimitInfo } from './github-client.js'
import type { GitHubClientConfig } from './github-client.js'
import { GitHubSyncError } from './errors.js'
import { mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { SyncResult } from '@shared/api-contracts/index.js'
import { USER_AI_CACHE_KEYS, getUserAiCacheKey } from '@shared/ai/index.js'

/**
 * 同步结果（不含 API 交互的版本）
 */
export type StarSyncResult = SyncResult

/**
 * 规范化 GitHub 用户名输入：支持 @login、GitHub 用户主页 URL 和首尾空白。
 */
export function normalizeGitHubUsername(input: string): string {
  let value = input.trim()
  value = value.replace(/^https?:\/\/github\.com\//i, '')
  value = value.split(/[/?#]/)[0] || value
  return value.replace(/^@+/, '').trim()
}

/** 依赖 repos.full_name 的引用表；仓库改名/转移时需同步迁移这些表的关联键 */
const REPO_REFERENCE_TABLES = ['stars', 'user_repos', 'repo_tags', 'translations'] as const

/** 将旧 full_name 的所有引用迁移到新 full_name，保证仓库改名后数据一致 */
function migrateRepoReferences(db: Database.Database, from: string, to: string): void {
  for (const table of REPO_REFERENCE_TABLES) {
    db.prepare(`UPDATE ${table} SET repo_full_name = ? WHERE repo_full_name = ?`).run(to, from)
  }
}

/**
 * 处理仓库改名/转移导致的 github_id 主键冲突。
 * repos 主键是 github_id、full_name 唯一。当同一仓库改名/转移后 full_name 变化时，
 * 库中旧行仍占用 github_id 主键，而新 full_name 与旧 full_name 不同，导致 upsert 的
 * ON CONFLICT(full_name) 不触发、反而触发 github_id 主键冲突导致同步失败。
 * 这里把旧行合并到新 full_name（并迁移引用），保证 upsert 成功且数据一致。
 * @returns 是否继续执行后续 upsert；返回 false 表示新 full_name 已被另一仓库占用（已合并删除旧行），应跳过。
 */
function alignRepoRename(db: Database.Database, repo: { id: number; full_name: string }): boolean {
  const existing = db.prepare('SELECT full_name FROM repos WHERE github_id = ?').get(repo.id) as { full_name: string } | undefined
  if (!existing || existing.full_name === repo.full_name) return true

  const old = existing.full_name
  const target = db.prepare('SELECT github_id FROM repos WHERE full_name = ? AND github_id != ?').get(repo.full_name, repo.id)
  if (target) {
    // 极罕见：新 full_name 已被另一仓库占用（GitHub 不允许同名，正常不会发生）。
    // 把旧行引用迁移到目标仓库，删除旧行，跳过本次 upsert，避免再次冲突。
    migrateRepoReferences(db, old, repo.full_name)
    db.prepare('DELETE FROM repos WHERE github_id = ?').run(repo.id)
    return false
  }
  // 仓库改名/转移：先把旧行引用迁移到新 full_name，再改 repos 主键 full_name
  migrateRepoReferences(db, old, repo.full_name)
  db.prepare('UPDATE repos SET full_name = ? WHERE github_id = ?').run(repo.full_name, repo.id)
  return true
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
    INSERT INTO users (login, synced_at, deleted_at) VALUES (?, ?, NULL)
    ON CONFLICT(login) DO UPDATE SET synced_at = excluded.synced_at, deleted_at = NULL
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
      INSERT INTO users (login, avatar_url, profile_url, synced_at, name, bio, company, location, followers, public_repos, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(login) DO UPDATE SET
        avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
        profile_url = COALESCE(excluded.profile_url, users.profile_url),
        synced_at = excluded.synced_at,
        name = COALESCE(excluded.name, users.name),
        bio = COALESCE(excluded.bio, users.bio),
        company = COALESCE(excluded.company, users.company),
        location = COALESCE(excluded.location, users.location),
        followers = COALESCE(excluded.followers, users.followers),
        public_repos = COALESCE(excluded.public_repos, users.public_repos),
        deleted_at = NULL
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

      // 仓库改名/转移时先合并 github_id 主键冲突；返回 false 表示该仓库已合并到其他行，跳过
      if (!alignRepoRename(db, repo)) continue

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

    // 星标数据变化后，用户级 AI 内容必须重新生成；只清理该用户画像/学习路径缓存，不影响仓库摘要缓存。
    db.prepare(`
      DELETE FROM translations
      WHERE repo_full_name = ?
        AND target_lang IN (${USER_AI_CACHE_KEYS.map(() => '?').join(',')})
    `).run(getUserAiCacheKey(username), ...USER_AI_CACHE_KEYS)

    return { reposUpserted, starsUpserted, reposMarkedRemoved }
  })

  // ===== 抓取用户自己发布的公开仓库（type=owner，排除 fork）=====
  // 自有仓库与标星仓库独立存储于 user_repos 表，失败或数据为空不影响标星同步结果。
  let ownedFetchError: string | null = null
  let ownedReposUpserted = 0
  let ownedReposMarkedRemoved = 0
  try {
    const ownedResult = await client.listUserOwnedRepos(username)
    const ownedRepos = ownedResult.repos
    const ownedSeen = new Set(ownedRepos.map(r => r.full_name))

    const ownedTx = withTransaction(db, () => {
      // 复用 repo 表 upsert 语句（自有仓库与标星仓库共用仓库元数据表）
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
      for (const repo of ownedRepos) {
        // 仓库改名/转移时先合并 github_id 主键冲突；返回 false 表示该仓库已合并到其他行，跳过
        if (!alignRepoRename(db, repo)) continue
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
      }

      // 写入 user_repos 关系表
      const upsertUserRepo = db.prepare(`
        INSERT INTO user_repos (user_login, repo_full_name, first_seen_at, last_seen_at, removed_at)
        VALUES (?, ?, ?, ?, NULL)
        ON CONFLICT(user_login, repo_full_name) DO UPDATE SET
          last_seen_at = excluded.last_seen_at,
          removed_at = NULL
      `)
      for (const repo of ownedRepos) {
        upsertUserRepo.run(username, repo.full_name, now, now)
      }

      // 标记 removed_at：本地有但本次 API 未返回的自有仓库
      let markedRemoved = 0
      if (ownedRepos.length > 0) {
        const markRemoved = db.prepare(`
          UPDATE user_repos SET removed_at = ?
          WHERE user_login = ? AND removed_at IS NULL AND repo_full_name NOT IN (${Array.from(ownedSeen).map(() => '?').join(',')})
        `)
        markedRemoved = markRemoved.run(now, username, ...ownedSeen).changes
      }

      return { upserted: ownedRepos.length, markedRemoved }
    })

    ownedReposUpserted = ownedTx.upserted
    ownedReposMarkedRemoved = ownedTx.markedRemoved
  } catch (err) {
    // 自有仓库抓取失败不阻塞标星同步主流程，记录错误信息
    ownedFetchError = err instanceof Error ? err.message : String(err)
    console.warn(`用户 ${username} 自有仓库抓取失败（不影响标星同步）:`, err)
  }

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
    complete: true,
    ownedReposUpserted,
    ownedReposRemoved: ownedReposMarkedRemoved,
    ownedFetchError,
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
