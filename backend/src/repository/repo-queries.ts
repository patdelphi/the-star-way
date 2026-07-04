/**
 * 仓库查询 Repository 模块
 * 提供星标仓库的列表查询、筛选、排序、分页和统计功能
 */
import type Database from 'better-sqlite3'
import type {
  RepoRow,
  RepoQueryParams,
  RepoWithStar,
  LanguageStat,
  TopicStat,
  LicenseStat,
} from '../db/types.js'

export const SYSTEM_DEMO_LOGIN = 'demo-user'

// 活跃阈值：90 天（毫秒）
export const ACTIVE_DAYS_MS = 90 * 24 * 60 * 60 * 1000

// Hidden Gems 阈值
export const GEM_STARS_MAX = 1000

// Gem 筛选范围
export const GEM_STARS_MIN = 50
export const GEM_STARS_UPPER = 10000

/**
 * 业务阈值可选项
 * 由前端 settings 透传，无值时回退到默认常量，保证向后兼容
 */
export interface ThresholdOptions {
  sleepDays?: number    // 沉睡星标判定天数，默认 90
  gemStarsMin?: number  // gemRepos stars 下限，默认 GEM_STARS_MIN
  gemStarsMax?: number  // hiddenGemsCount stars 上限，默认 GEM_STARS_MAX
}

// 解析阈值 options，非法或缺失时回退到默认常量
function resolveThresholds(options?: ThresholdOptions) {
  const sleepDays = options?.sleepDays
  const sleepMs = typeof sleepDays === 'number' && Number.isFinite(sleepDays) && sleepDays > 0
    ? sleepDays * 24 * 60 * 60 * 1000
    : ACTIVE_DAYS_MS
  const gemStarsMax = typeof options?.gemStarsMax === 'number' && Number.isFinite(options.gemStarsMax) && options.gemStarsMax > 0
    ? options.gemStarsMax
    : GEM_STARS_MAX
  const gemStarsMin = typeof options?.gemStarsMin === 'number' && Number.isFinite(options.gemStarsMin) && options.gemStarsMin >= 0
    ? options.gemStarsMin
    : GEM_STARS_MIN
  return { sleepMs, gemStarsMin, gemStarsMax }
}

// ===== 列表查询 =====

/**
 * 查询仓库列表（带星标时间和标签）
 * @param db 数据库连接
 * @param params 查询参数
 */
export function queryRepos(db: Database.Database, params: RepoQueryParams = {}): {
  items: RepoWithStar[]
  total: number
} {
  const { userLogin, language, tag, search, sortBy = 'stars', sortOrder = 'DESC', limit = 20, offset = 0 } = params

  // 构建 WHERE 子句
  const conditions: string[] = []
  const values: any[] = []

  if (userLogin) {
    conditions.push('s.user_login = ?')
    values.push(userLogin)
  }

  if (language) {
    conditions.push('r.language = ?')
    values.push(language)
  }

  if (tag) {
    conditions.push('r.full_name IN (SELECT repo_full_name FROM repo_tags WHERE tag = ?)')
    values.push(tag)
  }

  if (search) {
    conditions.push('(r.full_name LIKE ? OR r.description LIKE ?)')
    values.push(`%${search}%`, `%${search}%`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // 排序字段白名单
  const allowedSortColumns: Record<string, string> = {
    stars: 'r.stars',
    forks: 'r.forks',
    open_issues: 'r.open_issues',
    starred_at: 's.starred_at',
    pushed_at: 'r.pushed_at',
  }
  const sortCol = allowedSortColumns[sortBy] || 'r.stars'
  const order = sortOrder === 'ASC' ? 'ASC' : 'DESC'

  // 查询总数
  const countRow = db
    .prepare(`SELECT COUNT(*) as total FROM repos r JOIN stars s ON r.full_name = s.repo_full_name ${where}`)
    .get(...values) as { total: number }

  // 查询列表
  const rows = db
    .prepare(`
      SELECT r.*, s.starred_at,
        (SELECT GROUP_CONCAT(tag) FROM repo_tags WHERE repo_full_name = r.full_name) as tag_list
      FROM repos r
      JOIN stars s ON r.full_name = s.repo_full_name
      ${where}
      ORDER BY ${sortCol} ${order}
      LIMIT ? OFFSET ?
    `)
    .all(...values, limit, offset) as any[]

  const items: RepoWithStar[] = rows.map(row => ({
    repo: {
      github_id: row.github_id,
      full_name: row.full_name,
      owner: row.owner,
      name: row.name,
      html_url: row.html_url,
      description: row.description,
      language: row.language,
      license: row.license,
      stars: row.stars,
      forks: row.forks,
      open_issues: row.open_issues,
      topics_json: row.topics_json,
      created_at: row.created_at,
      updated_at: row.updated_at,
      pushed_at: row.pushed_at,
      archived: row.archived,
      fork: row.fork,
      homepage: row.homepage,
    },
    starred_at: row.starred_at,
    tags: row.tag_list ? row.tag_list.split(',') : [],
  }))

  return { items, total: countRow.total }
}

/**
 * 查询单个仓库详情
 */
export function queryRepoByName(db: Database.Database, fullName: string): RepoWithStar | null {
  const row = db
    .prepare(`
      SELECT r.*, s.starred_at,
        (SELECT GROUP_CONCAT(tag) FROM repo_tags WHERE repo_full_name = r.full_name) as tag_list
      FROM repos r
      JOIN stars s ON r.full_name = s.repo_full_name
      WHERE r.full_name = ?
    `)
    .get(fullName) as any

  if (!row) return null

  return {
    repo: {
      github_id: row.github_id,
      full_name: row.full_name,
      owner: row.owner,
      name: row.name,
      html_url: row.html_url,
      description: row.description,
      language: row.language,
      license: row.license,
      stars: row.stars,
      forks: row.forks,
      open_issues: row.open_issues,
      topics_json: row.topics_json,
      created_at: row.created_at,
      updated_at: row.updated_at,
      pushed_at: row.pushed_at,
      archived: row.archived,
      fork: row.fork,
      homepage: row.homepage,
    },
    starred_at: row.starred_at,
    tags: row.tag_list ? row.tag_list.split(',') : [],
  }
}

/**
 * 查询指定用户的单个仓库详情
 */
export function queryRepoByNameForUser(db: Database.Database, userLogin: string, fullName: string): RepoWithStar | null {
  const row = db
    .prepare(`
      SELECT r.*, s.starred_at,
        (SELECT GROUP_CONCAT(tag) FROM repo_tags WHERE repo_full_name = r.full_name) as tag_list
      FROM repos r
      JOIN stars s ON r.full_name = s.repo_full_name
      WHERE s.user_login = ? AND r.full_name = ?
    `)
    .get(userLogin, fullName) as any

  if (!row) return null

  return {
    repo: {
      github_id: row.github_id,
      full_name: row.full_name,
      owner: row.owner,
      name: row.name,
      html_url: row.html_url,
      description: row.description,
      language: row.language,
      license: row.license,
      stars: row.stars,
      forks: row.forks,
      open_issues: row.open_issues,
      topics_json: row.topics_json,
      created_at: row.created_at,
      updated_at: row.updated_at,
      pushed_at: row.pushed_at,
      archived: row.archived,
      fork: row.fork,
      homepage: row.homepage,
    },
    starred_at: row.starred_at,
    tags: row.tag_list ? row.tag_list.split(',') : [],
  }
}

// ===== 统计查询 =====

/**
 * 编程语言分布统计
 */
export function queryLanguageStats(db: Database.Database, userLogin?: string): LanguageStat[] {
  const join = userLogin ? 'JOIN stars s ON r.full_name = s.repo_full_name' : ''
  const where = userLogin ? 'WHERE r.language IS NOT NULL AND s.user_login = ?' : 'WHERE r.language IS NOT NULL'
  return db
    .prepare(`
      SELECT r.language, COUNT(*) as count
      FROM repos r
      ${join}
      ${where}
      GROUP BY r.language
      ORDER BY count DESC
    `)
    .all(...(userLogin ? [userLogin] : [])) as LanguageStat[]
}

/**
 * Topics 分布统计（从 topics_json 字段提取）
 */
export function queryTopicStats(db: Database.Database, userLogin?: string): TopicStat[] {
  // 先从 topics_json 提取所有 topic
  const join = userLogin ? 'JOIN stars s ON r.full_name = s.repo_full_name' : ''
  const where = userLogin ? 'WHERE r.topics_json IS NOT NULL AND s.user_login = ?' : 'WHERE r.topics_json IS NOT NULL'
  const repos = db
    .prepare(`
      SELECT r.topics_json
      FROM repos r
      ${join}
      ${where}
    `)
    .all(...(userLogin ? [userLogin] : [])) as { topics_json: string }[]

  const topicCount = new Map<string, number>()
  for (const repo of repos) {
    try {
      const topics: string[] = JSON.parse(repo.topics_json)
      for (const topic of topics) {
        topicCount.set(topic, (topicCount.get(topic) || 0) + 1)
      }
    } catch {
      // 忽略解析失败的 JSON
    }
  }

  return Array.from(topicCount.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * License 分布统计
 */
export function queryLicenseStats(db: Database.Database, userLogin?: string): LicenseStat[] {
  const join = userLogin ? 'JOIN stars s ON r.full_name = s.repo_full_name' : ''
  const where = userLogin ? 'WHERE s.user_login = ?' : ''
  return db
    .prepare(`
      SELECT COALESCE(r.license, 'Unknown') as license, COUNT(*) as count
      FROM repos r
      ${join}
      ${where}
      GROUP BY COALESCE(r.license, 'Unknown')
      ORDER BY count DESC
    `)
    .all(...(userLogin ? [userLogin] : [])) as LicenseStat[]
}

/**
 * 仓库总数统计
 */
export function queryRepoCount(db: Database.Database, userLogin?: string): number {
  const row = userLogin
    ? db.prepare('SELECT COUNT(*) as cnt FROM stars WHERE user_login = ?').get(userLogin) as { cnt: number }
    : db.prepare('SELECT COUNT(*) as cnt FROM repos').get() as { cnt: number }
  return row.cnt
}

/**
 * 活跃仓库统计（最近 sleepDays 天有 pushed_at 更新的仓库）
 * options 透传时使用自定义阈值，否则回退默认 90 天
 */
export function queryActiveRepoCount(db: Database.Database, userLogin?: string, options?: ThresholdOptions): number {
  const { sleepMs } = resolveThresholds(options)
  const cutoffDate = new Date(Date.now() - sleepMs).toISOString()
  const join = userLogin ? 'JOIN stars s ON r.full_name = s.repo_full_name' : ''
  const userWhere = userLogin ? 'AND s.user_login = ?' : ''
  const row = db
    .prepare(`
      SELECT COUNT(*) as cnt
      FROM repos r
      ${join}
      WHERE r.pushed_at >= ?
      ${userWhere}
    `)
    .get(...(userLogin ? [cutoffDate, userLogin] : [cutoffDate])) as { cnt: number }
  return row.cnt
}

/**
 * 用户级统一摘要统计
 * 返回：仓库总数、活跃数、标签数、隐藏宝石数、沉睡星标数、协议风险数、最后同步时间
 */
export function queryUserSummary(db: Database.Database, userLogin: string, options?: ThresholdOptions): {
  repoCount: number
  activeRepoCount: number
  tagCount: number
  hiddenGemsCount: number
  sleepStarsCount: number
  licenseRiskCount: number
  lastSyncedAt: string | null
} {
  const { sleepMs, gemStarsMax } = resolveThresholds(options)
  const cutoffDate = new Date(Date.now() - sleepMs).toISOString()

  // 仓库总数
  const repoCount = queryRepoCount(db, userLogin)

  // 活跃仓库数（透传 options 保持阈值一致）
  const activeRepoCount = queryActiveRepoCount(db, userLogin, options)

  // 唯一标签数（该用户星标仓库上的标签）
  const tagRow = db.prepare(`
    SELECT COUNT(DISTINCT tag) as cnt
    FROM repo_tags
    WHERE repo_full_name IN (SELECT repo_full_name FROM stars WHERE user_login = ?)
  `).get(userLogin) as { cnt: number }
  const tagCount = tagRow.cnt

  // 隐藏宝石：stars <= gemStarsMax 且最近 sleepDays 天有更新
  const gemRow = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM repos r
    JOIN stars s ON r.full_name = s.repo_full_name
    WHERE s.user_login = ? AND r.stars <= ? AND r.pushed_at >= ?
  `).get(userLogin, gemStarsMax, cutoffDate) as { cnt: number }
  const hiddenGemsCount = gemRow.cnt

  // 沉睡星标：超过 sleepDays 天未更新
  const sleepRow = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM repos r
    JOIN stars s ON r.full_name = s.repo_full_name
    WHERE s.user_login = ? AND r.pushed_at < ?
  `).get(userLogin, cutoffDate) as { cnt: number }
  const sleepStarsCount = sleepRow.cnt

  // 协议风险：GPL 或未知协议
  const riskRow = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM repos r
    JOIN stars s ON r.full_name = s.repo_full_name
    WHERE s.user_login = ?
      AND (LOWER(COALESCE(r.license, '')) LIKE '%gpl%'
           OR COALESCE(r.license, '') = ''
           OR LOWER(COALESCE(r.license, '')) = 'other')
  `).get(userLogin) as { cnt: number }
  const licenseRiskCount = riskRow.cnt

  // 最后同步时间
  const userRow = db.prepare('SELECT synced_at FROM users WHERE login = ?').get(userLogin) as { synced_at: string | null } | undefined
  const lastSyncedAt = userRow?.synced_at ?? null

  return {
    repoCount,
    activeRepoCount,
    tagCount,
    hiddenGemsCount,
    sleepStarsCount,
    licenseRiskCount,
    lastSyncedAt,
  }
}

/**
 * 查询用户列表摘要
 * 排除系统演示用户，并按有效星标数量展示真实同步规模。
 */
export function queryUserListSummaries(db: Database.Database): Array<{
  login: string
  avatar_url: string | null
  profile_url: string | null
  synced_at: string | null
  name: string | null
  bio: string | null
  company: string | null
  location: string | null
  followers: number | null
  public_repos: number | null
  repoCount: number
  tagCount: number
}> {
  return db.prepare(`
    SELECT
      u.login,
      u.avatar_url,
      u.profile_url,
      u.synced_at,
      u.name,
      u.bio,
      u.company,
      u.location,
      u.followers,
      u.public_repos,
      COUNT(DISTINCT CASE WHEN s.removed_at IS NULL THEN s.repo_full_name END) as repoCount,
      COUNT(DISTINCT rt.tag) as tagCount
    FROM users u
    LEFT JOIN stars s ON s.user_login = u.login
    LEFT JOIN repo_tags rt ON rt.repo_full_name = s.repo_full_name AND s.removed_at IS NULL
    WHERE u.login != ? AND u.deleted_at IS NULL
    GROUP BY u.login, u.avatar_url, u.profile_url, u.synced_at, u.name, u.bio, u.company, u.location, u.followers, u.public_repos
    ORDER BY u.login
  `).all(SYSTEM_DEMO_LOGIN) as Array<{
    login: string
    avatar_url: string | null
    profile_url: string | null
    synced_at: string | null
    name: string | null
    bio: string | null
    company: string | null
    location: string | null
    followers: number | null
    public_repos: number | null
    repoCount: number
    tagCount: number
  }>
}

/**
 * 查询全库概览统计
 * 只统计真实用户的有效星标，避免 demo-user 和 removed_at 记录污染总览。
 * options 透传时使用自定义阈值，否则回退默认 90 天 / 默认 gem stars 区间
 */
export function queryGlobalOverview(db: Database.Database, options?: ThresholdOptions): {
  userCount: number
  repoCount: number
  activeRepoCount: number
  tagCount: number
  hiddenGemsCount: number
  sleepStarsCount: number
  licenseRiskCount: number
  lastSyncedAt: string | null
  languages: LanguageStat[]
  topics: TopicStat[]
  licenses: LicenseStat[]
  recentStars: Array<{
    full_name: string
    description: string | null
    language: string | null
    starred_at: string
  }>
  gemRepos: Array<{
    full_name: string
    description: string | null
    html_url: string
    language: string | null
    stars: number
    forks: number
  }>
  starTrend: Array<{ label: string; value: number }>
} {
  const { sleepMs, gemStarsMin, gemStarsMax } = resolveThresholds(options)
  const cutoffDate = new Date(Date.now() - sleepMs).toISOString()
  const baseWhere = `s.removed_at IS NULL AND s.user_login != ?`

  const userRow = db.prepare(`
    SELECT COUNT(*) as cnt, MAX(synced_at) as lastSyncedAt
    FROM users
    WHERE login != ?
  `).get(SYSTEM_DEMO_LOGIN) as { cnt: number; lastSyncedAt: string | null }

  const repoRow = db.prepare(`
    SELECT COUNT(DISTINCT s.repo_full_name) as cnt
    FROM stars s
    WHERE ${baseWhere}
  `).get(SYSTEM_DEMO_LOGIN) as { cnt: number }

  const activeRow = db.prepare(`
    SELECT COUNT(DISTINCT r.full_name) as cnt
    FROM repos r
    JOIN stars s ON r.full_name = s.repo_full_name
    WHERE ${baseWhere} AND r.pushed_at >= ?
  `).get(SYSTEM_DEMO_LOGIN, cutoffDate) as { cnt: number }

  const tagRow = db.prepare(`
    SELECT COUNT(DISTINCT rt.tag) as cnt
    FROM repo_tags rt
    JOIN stars s ON rt.repo_full_name = s.repo_full_name
    WHERE ${baseWhere}
  `).get(SYSTEM_DEMO_LOGIN) as { cnt: number }

  const hiddenGemsRow = db.prepare(`
    SELECT COUNT(DISTINCT r.full_name) as cnt
    FROM repos r
    JOIN stars s ON r.full_name = s.repo_full_name
    WHERE ${baseWhere} AND r.stars <= ? AND r.pushed_at >= ?
  `).get(SYSTEM_DEMO_LOGIN, gemStarsMax, cutoffDate) as { cnt: number }

  const sleepRow = db.prepare(`
    SELECT COUNT(DISTINCT r.full_name) as cnt
    FROM repos r
    JOIN stars s ON r.full_name = s.repo_full_name
    WHERE ${baseWhere} AND (r.pushed_at IS NULL OR r.pushed_at < ?)
  `).get(SYSTEM_DEMO_LOGIN, cutoffDate) as { cnt: number }

  const riskRow = db.prepare(`
    SELECT COUNT(DISTINCT r.full_name) as cnt
    FROM repos r
    JOIN stars s ON r.full_name = s.repo_full_name
    WHERE ${baseWhere}
      AND (LOWER(COALESCE(r.license, '')) LIKE '%gpl%'
           OR COALESCE(r.license, '') = ''
           OR LOWER(COALESCE(r.license, '')) = 'other')
  `).get(SYSTEM_DEMO_LOGIN) as { cnt: number }

  const languages = db.prepare(`
    SELECT COALESCE(r.language, 'Unknown') as language, COUNT(DISTINCT r.full_name) as count
    FROM repos r
    JOIN stars s ON r.full_name = s.repo_full_name
    WHERE ${baseWhere}
    GROUP BY COALESCE(r.language, 'Unknown')
    ORDER BY count DESC
  `).all(SYSTEM_DEMO_LOGIN) as LanguageStat[]

  const licenses = db.prepare(`
    SELECT COALESCE(r.license, 'Unknown') as license, COUNT(DISTINCT r.full_name) as count
    FROM repos r
    JOIN stars s ON r.full_name = s.repo_full_name
    WHERE ${baseWhere}
    GROUP BY COALESCE(r.license, 'Unknown')
    ORDER BY count DESC
  `).all(SYSTEM_DEMO_LOGIN) as LicenseStat[]

  const topicRows = db.prepare(`
    SELECT DISTINCT r.full_name, r.topics_json
    FROM repos r
    JOIN stars s ON r.full_name = s.repo_full_name
    WHERE ${baseWhere} AND r.topics_json IS NOT NULL
  `).all(SYSTEM_DEMO_LOGIN) as { topics_json: string }[]
  const topicCount = new Map<string, number>()
  for (const row of topicRows) {
    try {
      const topics: string[] = JSON.parse(row.topics_json)
      for (const topic of topics) topicCount.set(topic, (topicCount.get(topic) || 0) + 1)
    } catch {
      // 忽略坏数据，保证概览接口稳定返回。
    }
  }
  const topics = Array.from(topicCount.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)

  const recentStars = db.prepare(`
    SELECT r.full_name, r.description, r.language, MAX(s.starred_at) as starred_at
    FROM repos r
    JOIN stars s ON r.full_name = s.repo_full_name
    WHERE ${baseWhere} AND s.starred_at IS NOT NULL
    GROUP BY r.full_name, r.description, r.language
    ORDER BY starred_at DESC
    LIMIT 10
  `).all(SYSTEM_DEMO_LOGIN) as Array<{
    full_name: string
    description: string | null
    language: string | null
    starred_at: string
  }>

  const gemRepos = db.prepare(`
    SELECT DISTINCT r.full_name, r.description, r.html_url, r.language, r.stars, r.forks
    FROM repos r
    JOIN stars s ON r.full_name = s.repo_full_name
    WHERE ${baseWhere}
      AND r.stars BETWEEN ? AND ?
      AND r.pushed_at >= ?
    ORDER BY r.stars DESC
    LIMIT 3
  `).all(SYSTEM_DEMO_LOGIN, gemStarsMin, GEM_STARS_UPPER, cutoffDate) as Array<{
    full_name: string
    description: string | null
    html_url: string
    language: string | null
    stars: number
    forks: number
  }>

  const trendRows = db.prepare(`
    SELECT substr(s.starred_at, 1, 7) as label, COUNT(*) as value
    FROM stars s
    WHERE ${baseWhere} AND s.starred_at IS NOT NULL
    GROUP BY substr(s.starred_at, 1, 7)
    ORDER BY label ASC
  `).all(SYSTEM_DEMO_LOGIN) as Array<{ label: string; value: number }>

  return {
    userCount: userRow.cnt,
    repoCount: repoRow.cnt,
    activeRepoCount: activeRow.cnt,
    tagCount: tagRow.cnt,
    hiddenGemsCount: hiddenGemsRow.cnt,
    sleepStarsCount: sleepRow.cnt,
    licenseRiskCount: riskRow.cnt,
    lastSyncedAt: userRow.lastSyncedAt,
    languages,
    topics,
    licenses,
    recentStars,
    gemRepos,
    // 保留完整 YYYY-MM，前端按需截短显示（同年只显示 MM，跨年显示完整）
    starTrend: trendRows.slice(-12).map(row => ({ label: row.label, value: row.value })),
  }
}

/**
 * 查询指定用户按月的 star 仓库数量时间轴
 * @returns 按月聚合的 star 数量数组，格式 [{ month: '2024-01', count: 5 }, ...]
 */
export function queryUserStarTimeline(
  db: Database.Database,
  login: string,
): Array<{ month: string; count: number }> {
  return db.prepare(`
    SELECT
      strftime('%Y-%m', starred_at) as month,
      COUNT(*) as count
    FROM stars
    WHERE user_login = ? AND starred_at IS NOT NULL AND removed_at IS NULL
    GROUP BY month
    ORDER BY month ASC
  `).all(login) as Array<{ month: string; count: number }>
}
