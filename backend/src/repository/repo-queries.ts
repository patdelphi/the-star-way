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
 * 活跃仓库统计（最近 90 天有 pushed_at 更新的仓库）
 */
export function queryActiveRepoCount(db: Database.Database, userLogin?: string): number {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
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
    .get(...(userLogin ? [ninetyDaysAgo, userLogin] : [ninetyDaysAgo])) as { cnt: number }
  return row.cnt
}

/**
 * 用户级统一摘要统计
 * 返回：仓库总数、活跃数、标签数、隐藏宝石数、沉睡星标数、协议风险数、最后同步时间
 */
export function queryUserSummary(db: Database.Database, userLogin: string): {
  repoCount: number
  activeRepoCount: number
  tagCount: number
  hiddenGemsCount: number
  sleepStarsCount: number
  licenseRiskCount: number
  lastSyncedAt: string | null
} {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // 仓库总数
  const repoCount = queryRepoCount(db, userLogin)

  // 活跃仓库数
  const activeRepoCount = queryActiveRepoCount(db, userLogin)

  // 唯一标签数（该用户星标仓库上的标签）
  const tagRow = db.prepare(`
    SELECT COUNT(DISTINCT tag) as cnt
    FROM repo_tags
    WHERE repo_full_name IN (SELECT repo_full_name FROM stars WHERE user_login = ?)
  `).get(userLogin) as { cnt: number }
  const tagCount = tagRow.cnt

  // 隐藏宝石：stars <= 1000 且最近 90 天有更新
  const gemRow = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM repos r
    JOIN stars s ON r.full_name = s.repo_full_name
    WHERE s.user_login = ? AND r.stars <= 1000 AND r.pushed_at >= ?
  `).get(userLogin, ninetyDaysAgo) as { cnt: number }
  const hiddenGemsCount = gemRow.cnt

  // 沉睡星标：超过 90 天未更新
  const sleepRow = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM repos r
    JOIN stars s ON r.full_name = s.repo_full_name
    WHERE s.user_login = ? AND r.pushed_at < ?
  `).get(userLogin, ninetyDaysAgo) as { cnt: number }
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
