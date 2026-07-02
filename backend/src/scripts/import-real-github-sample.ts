/**
 * 程序说明：从 GitHub 公开 API 搜索真实用户，并导入每个用户的真实 starred repo 样本。
 * 仅执行 upsert，不删除旧数据；用于端到端页面和 API 测试真实数据。
 */
import { loadEnv } from '../config/env.js'
import { createConnection, initDatabase, withTransaction } from '../db/connection.js'
import { classifyReposForUser } from '../classification/classifier.js'

loadEnv()

type GitHubSearchUser = {
  login: string
  avatar_url: string | null
  html_url: string | null
}

type GitHubRepo = {
  id: number
  full_name: string
  owner: { login: string }
  name: string
  html_url: string
  description: string | null
  language: string | null
  license: { spdx_id: string | null } | null
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  topics?: string[]
  created_at: string
  updated_at: string
  pushed_at: string | null
  archived: boolean
  fork: boolean
  homepage: string | null
}

type StarredItem = {
  starred_at?: string
  repo?: GitHubRepo
} & GitHubRepo

type RateInfo = {
  limit: string | null
  remaining: string | null
  reset: string | null
}

const TARGET_USERS = Number(process.env.STARWAY_REAL_USER_COUNT || 30)
const REPOS_PER_USER = Number(process.env.STARWAY_REAL_REPOS_PER_USER || 20)
const API_BASE = 'https://api.github.com'
const token = process.env.STARWAY_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN

function headers(extra: Record<string, string> = {}) {
  return {
    'User-Agent': 'the-star-way-real-data-test/1.0.0',
    Accept: 'application/vnd.github.star+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

function rateInfo(response: Response): RateInfo {
  return {
    limit: response.headers.get('x-ratelimit-limit'),
    remaining: response.headers.get('x-ratelimit-remaining'),
    reset: response.headers.get('x-ratelimit-reset'),
  }
}

async function fetchJson<T>(url: string): Promise<{ data: T; rate: RateInfo }> {
  const response = await fetch(url, { headers: headers() })
  const rate = rateInfo(response)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GitHub API ${response.status}: ${body}`)
  }
  return { data: await response.json() as T, rate }
}

async function searchUsers(): Promise<GitHubSearchUser[]> {
  const users: GitHubSearchUser[] = []
  const seen = new Set<string>()
  const candidateTarget = TARGET_USERS * 3
  for (let page = 1; users.length < candidateTarget && page <= 6; page++) {
    const query = encodeURIComponent('followers:10..5000 repos:1..200 type:user')
    const url = `${API_BASE}/search/users?q=${query}&sort=followers&order=desc&per_page=30&page=${page}`
    const { data } = await fetchJson<{ items: GitHubSearchUser[] }>(url)
    for (const user of data.items) {
      if (!seen.has(user.login)) {
        seen.add(user.login)
        users.push(user)
      }
      if (users.length >= candidateTarget) break
    }
  }
  return users
}

async function fetchStarred(login: string): Promise<{ repos: { repo: GitHubRepo; starredAt: string }[]; rate: RateInfo | null }> {
  const url = `${API_BASE}/users/${encodeURIComponent(login)}/starred?per_page=${REPOS_PER_USER}&page=1`
  const { data, rate } = await fetchJson<StarredItem[]>(url)
  const repos = data
    .map((item) => {
      const repo = item.repo ?? item
      return { repo, starredAt: item.starred_at ?? new Date().toISOString() }
    })
    .filter((item) => Boolean(item.repo?.full_name))
  return { repos, rate }
}

function upsertUserAndRepos(user: GitHubSearchUser, repos: { repo: GitHubRepo; starredAt: string }[]) {
  const db = createConnection()
  initDatabase(db)
  const now = new Date().toISOString()

  try {
    withTransaction(db, () => {
      db.prepare(`
        INSERT INTO users (login, avatar_url, profile_url, synced_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(login) DO UPDATE SET
          avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
          profile_url = COALESCE(excluded.profile_url, users.profile_url),
          synced_at = excluded.synced_at
      `).run(user.login, user.avatar_url, user.html_url, now)

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

      const upsertStar = db.prepare(`
        INSERT INTO stars (user_login, repo_full_name, starred_at, first_seen_at, last_seen_at, removed_at)
        VALUES (?, ?, ?, ?, ?, NULL)
        ON CONFLICT(user_login, repo_full_name) DO UPDATE SET
          starred_at = excluded.starred_at,
          last_seen_at = excluded.last_seen_at,
          removed_at = NULL
      `)

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
          JSON.stringify(repo.topics ?? []),
          repo.created_at,
          repo.updated_at,
          repo.pushed_at,
          repo.archived ? 1 : 0,
          repo.fork ? 1 : 0,
          repo.homepage,
        )
        upsertStar.run(user.login, repo.full_name, item.starredAt, now, now)
      }

      db.prepare(`
        INSERT INTO sync_runs (user_login, started_at, ended_at, status, repos_upserted, stars_upserted, pages_fetched)
        VALUES (?, ?, ?, 'success', ?, ?, 1)
      `).run(user.login, now, now, repos.length, repos.length)
    })

    classifyReposForUser(db, user.login)
  } finally {
    db.close()
  }
}

function countRealUsersWithStars() {
  const db = createConnection()
  initDatabase(db)
  try {
    // 真实数据验收按库内可用用户计算，避免未认证 GitHub API 临近限流时误报失败。
    return db.prepare(`
      SELECT COUNT(*) AS count
      FROM (
        SELECT u.login
        FROM users u
        JOIN stars s ON u.login = s.user_login
        WHERE u.login != 'demo-user'
        GROUP BY u.login
        HAVING COUNT(s.repo_full_name) > 0
      )
    `).get() as { count: number }
  } finally {
    db.close()
  }
}

async function main() {
  const initialRealUsers = countRealUsersWithStars().count
  if (initialRealUsers >= TARGET_USERS && !token) {
    console.log(JSON.stringify({ imported: [], realUsers: initialRealUsers, rate: null, skippedNetwork: true }, null, 2))
    return
  }

  let users: GitHubSearchUser[] = []
  try {
    users = await searchUsers()
  } catch (err) {
    const realUsers = countRealUsersWithStars().count
    if (realUsers >= TARGET_USERS) {
      console.error(`GitHub 搜索失败，但库内已有 ${realUsers} 个真实用户可用于测试：${err instanceof Error ? err.message : String(err)}`)
      console.log(JSON.stringify({ imported: [], realUsers, rate: null }, null, 2))
      return
    }
    throw err
  }
  const imported: { login: string; repos: number }[] = []
  let lastRate: RateInfo | null = null

  for (const user of users) {
    if (imported.length >= TARGET_USERS) break
    try {
      const { repos, rate } = await fetchStarred(user.login)
      lastRate = rate
      if (repos.length === 0) continue
      upsertUserAndRepos(user, repos)
      imported.push({ login: user.login, repos: repos.length })
      console.log(`${imported.length}. ${user.login}: ${repos.length} repos`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`${user.login}: ${message}`)
      if (message.includes('API rate limit exceeded')) break
    }
  }

  const realUsers = countRealUsersWithStars().count
  if (realUsers < TARGET_USERS) {
    throw new Error(`本轮导入 ${imported.length} 个，库内真实用户 ${realUsers}/${TARGET_USERS} 个，请配置 GitHub token 或稍后重试。`)
  }

  console.log(JSON.stringify({ imported, realUsers, rate: lastRate }, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
