/**
 * D1 数据访问层
 * 封装 Cloudflare D1 的异步查询逻辑，与 backend Node 版本保持业务等价
 *
 * 与 better-sqlite3 同步 API 的主要差异：
 * - 所有方法都是异步（async/await）
 * - 用 db.batch() 替代 db.transaction() 实现原子写入
 * - prepare().bind().all() 返回 { results, success, meta }
 *
 * 共享逻辑：
 * - 阈值口径从 @shared/scoring 引用，与 Node 后端共用同一份常量
 * - 分类规则从 @shared/classification 引用
 */
import type {
  RepoRow,
  RepoQueryParams,
  RepoWithStar,
  LanguageStat,
  TopicStat,
  LicenseStat,
} from '@shared/api-contracts/index.js'
import {
  resolveThresholds,
  GEM_STARS_UPPER,
  type ThresholdOptions,
} from '@shared/scoring/thresholds.js'
import { classifyRepo } from '@shared/classification/classifier.js'
import { USER_AI_CACHE_KEYS, getUserAiCacheKey } from '@shared/ai/index.js'

/**
 * 系统演示用户 login，与 backend 一致
 */
export const SYSTEM_DEMO_LOGIN = 'demo-user'

/**
 * D1 查询结果类型
 */
interface D1Result<T = unknown> {
  results: T[]
  success: boolean
  meta: {
    changes?: number
    last_row_id?: number
    [key: string]: unknown
  }
}

/**
 * D1StarRepository
 * 封装 MVP 所需的全部数据访问方法
 */
export class D1StarRepository {
  constructor(private db: D1Database) {}

  // ===== 用户相关 =====

  /**
   * 查询用户列表摘要（排除系统演示用户和已删除用户）
   */
  async listUsers(): Promise<Array<{
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
  }>> {
    const result = await this.db
      .prepare(`
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
      `)
      .bind(SYSTEM_DEMO_LOGIN)
      .all()

    return (result.results || []) as Array<{
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
   * 校验用户存在且未删除
   */
  async ensureUserExists(login: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT login FROM users WHERE login = ? AND deleted_at IS NULL')
      .bind(login)
      .first<{ login: string }>()
    return !!row
  }

  /**
   * 获取用户星标数量
   */
  async getUserStarCount(login: string): Promise<number> {
    const row = await this.db
      .prepare('SELECT COUNT(*) as cnt FROM stars WHERE user_login = ?')
      .bind(login)
      .first<{ cnt: number }>()
    return row?.cnt ?? 0
  }

  // ===== 仓库列表查询 =====

  /**
   * 查询仓库列表（带星标时间和标签，支持分页、筛选、排序）
   */
  async listRepos(params: RepoQueryParams = {}): Promise<{ items: RepoWithStar[]; total: number }> {
    const {
      userLogin,
      language,
      tag,
      search,
      sortBy = 'stars',
      sortOrder = 'DESC',
      limit = 20,
      offset = 0,
    } = params

    // 构建 WHERE 子句
    const conditions: string[] = []
    const values: unknown[] = []

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
    const countRow = await this.db
      .prepare(`SELECT COUNT(*) as total FROM repos r JOIN stars s ON r.full_name = s.repo_full_name ${where}`)
      .bind(...values)
      .first<{ total: number }>()
    const total = countRow?.total ?? 0

    // 查询列表
    const rows = await this.db
      .prepare(`
        SELECT r.*, s.starred_at,
          (SELECT GROUP_CONCAT(tag) FROM repo_tags WHERE repo_full_name = r.full_name) as tag_list
        FROM repos r
        JOIN stars s ON r.full_name = s.repo_full_name
        ${where}
        ORDER BY ${sortCol} ${order}
        LIMIT ? OFFSET ?
      `)
      .bind(...values, limit, offset)
      .all()

    const items: RepoWithStar[] = (rows.results || []).map((row: any) => ({
      repo: this.mapRepoRow(row),
      starred_at: row.starred_at,
      tags: row.tag_list ? row.tag_list.split(',') : [],
    }))

    return { items, total }
  }

  /**
   * 查询指定用户的单个仓库详情
   */
  async getRepoForUser(userLogin: string, fullName: string): Promise<RepoWithStar | null> {
    const row = await this.db
      .prepare(`
        SELECT r.*, s.starred_at,
          (SELECT GROUP_CONCAT(tag) FROM repo_tags WHERE repo_full_name = r.full_name) as tag_list
        FROM repos r
        JOIN stars s ON r.full_name = s.repo_full_name
        WHERE s.user_login = ? AND r.full_name = ?
      `)
      .bind(userLogin, fullName)
      .first<any>()

    if (!row) return null

    return {
      repo: this.mapRepoRow(row),
      starred_at: row.starred_at,
      tags: row.tag_list ? row.tag_list.split(',') : [],
    }
  }

  /**
   * 全局仓库查询（不带 user_login）
   */
  async getRepoGlobal(fullName: string): Promise<RepoRow | null> {
    const row = await this.db
      .prepare('SELECT * FROM repos WHERE full_name = ?')
      .bind(fullName)
      .first<any>()

    if (!row) return null
    return this.mapRepoRow(row)
  }

  /**
   * 获取仓库标签列表
   */
  async getRepoTags(fullName: string): Promise<string[]> {
    const rows = await this.db
      .prepare('SELECT tag FROM repo_tags WHERE repo_full_name = ?')
      .bind(fullName)
      .all<{ tag: string }>()
    return (rows.results || []).map(r => r.tag)
  }

  // ===== 统计查询 =====

  /**
   * 编程语言分布统计
   */
  async queryLanguageStats(userLogin?: string): Promise<LanguageStat[]> {
    const sql = userLogin
      ? `SELECT r.language, COUNT(*) as count FROM repos r
         JOIN stars s ON r.full_name = s.repo_full_name
         WHERE r.language IS NOT NULL AND s.user_login = ?
         GROUP BY r.language ORDER BY count DESC`
      : `SELECT r.language, COUNT(*) as count FROM repos r
         WHERE r.language IS NOT NULL
         GROUP BY r.language ORDER BY count DESC`
    const stmt = this.db.prepare(sql)
    const result = userLogin
      ? await stmt.bind(userLogin).all<LanguageStat>()
      : await stmt.all<LanguageStat>()
    return result.results || []
  }

  /**
   * Topics 分布统计（从 topics_json 字段提取）
   */
  async queryTopicStats(userLogin?: string): Promise<TopicStat[]> {
    const sql = userLogin
      ? `SELECT r.topics_json FROM repos r
         JOIN stars s ON r.full_name = s.repo_full_name
         WHERE r.topics_json IS NOT NULL AND s.user_login = ?`
      : `SELECT r.topics_json FROM repos r
         WHERE r.topics_json IS NOT NULL`
    const stmt = this.db.prepare(sql)
    const result = userLogin
      ? await stmt.bind(userLogin).all<{ topics_json: string }>()
      : await stmt.all<{ topics_json: string }>()

    const topicCount = new Map<string, number>()
    for (const row of result.results || []) {
      try {
        const topics: string[] = JSON.parse(row.topics_json)
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
  async queryLicenseStats(userLogin?: string): Promise<LicenseStat[]> {
    const sql = userLogin
      ? `SELECT COALESCE(r.license, 'Unknown') as license, COUNT(*) as count
         FROM repos r JOIN stars s ON r.full_name = s.repo_full_name
         WHERE s.user_login = ?
         GROUP BY COALESCE(r.license, 'Unknown')
         ORDER BY count DESC`
      : `SELECT COALESCE(r.license, 'Unknown') as license, COUNT(*) as count
         FROM repos r
         GROUP BY COALESCE(r.license, 'Unknown')
         ORDER BY count DESC`
    const stmt = this.db.prepare(sql)
    const result = userLogin
      ? await stmt.bind(userLogin).all<LicenseStat>()
      : await stmt.all<LicenseStat>()
    return result.results || []
  }

  /**
   * 仓库总数统计
   */
  async queryRepoCount(userLogin?: string): Promise<number> {
    const row = userLogin
      ? await this.db.prepare('SELECT COUNT(*) as cnt FROM stars WHERE user_login = ?')
          .bind(userLogin).first<{ cnt: number }>()
      : await this.db.prepare('SELECT COUNT(*) as cnt FROM repos')
          .first<{ cnt: number }>()
    return row?.cnt ?? 0
  }

  /**
   * 活跃仓库统计（最近 sleepDays 天有 pushed_at 更新的仓库）
   */
  async queryActiveRepoCount(userLogin?: string, options?: ThresholdOptions): Promise<number> {
    const { sleepMs } = resolveThresholds(options)
    const cutoffDate = new Date(Date.now() - sleepMs).toISOString()

    if (userLogin) {
      const row = await this.db
        .prepare(`
          SELECT COUNT(*) as cnt FROM repos r
          JOIN stars s ON r.full_name = s.repo_full_name
          WHERE r.pushed_at >= ? AND s.user_login = ?
        `)
        .bind(cutoffDate, userLogin)
        .first<{ cnt: number }>()
      return row?.cnt ?? 0
    }

    const row = await this.db
      .prepare(`SELECT COUNT(*) as cnt FROM repos r WHERE r.pushed_at >= ?`)
      .bind(cutoffDate)
      .first<{ cnt: number }>()
    return row?.cnt ?? 0
  }

  // ===== 用户摘要 =====

  /**
   * 用户级统一摘要统计
   */
  async getUserSummary(userLogin: string, options?: ThresholdOptions): Promise<{
    repoCount: number
    activeRepoCount: number
    tagCount: number
    hiddenGemsCount: number
    sleepStarsCount: number
    licenseRiskCount: number
    lastSyncedAt: string | null
  }> {
    const { sleepMs, gemStarsMax } = resolveThresholds(options)
    const cutoffDate = new Date(Date.now() - sleepMs).toISOString()

    const repoCount = await this.queryRepoCount(userLogin)
    const activeRepoCount = await this.queryActiveRepoCount(userLogin, options)

    // 唯一标签数
    const tagRow = await this.db
      .prepare(`
        SELECT COUNT(DISTINCT tag) as cnt FROM repo_tags
        WHERE repo_full_name IN (SELECT repo_full_name FROM stars WHERE user_login = ?)
      `)
      .bind(userLogin)
      .first<{ cnt: number }>()
    const tagCount = tagRow?.cnt ?? 0

    // 隐藏宝石：stars <= gemStarsMax 且最近 sleepDays 天有更新
    const gemRow = await this.db
      .prepare(`
        SELECT COUNT(*) as cnt FROM repos r
        JOIN stars s ON r.full_name = s.repo_full_name
        WHERE s.user_login = ? AND r.stars <= ? AND r.pushed_at >= ?
      `)
      .bind(userLogin, gemStarsMax, cutoffDate)
      .first<{ cnt: number }>()
    const hiddenGemsCount = gemRow?.cnt ?? 0

    // 沉睡星标：超过 sleepDays 天未更新
    const sleepRow = await this.db
      .prepare(`
        SELECT COUNT(*) as cnt FROM repos r
        JOIN stars s ON r.full_name = s.repo_full_name
        WHERE s.user_login = ? AND r.pushed_at < ?
      `)
      .bind(userLogin, cutoffDate)
      .first<{ cnt: number }>()
    const sleepStarsCount = sleepRow?.cnt ?? 0

    // 协议风险：GPL 或未知协议
    const riskRow = await this.db
      .prepare(`
        SELECT COUNT(*) as cnt FROM repos r
        JOIN stars s ON r.full_name = s.repo_full_name
        WHERE s.user_login = ?
          AND (LOWER(COALESCE(r.license, '')) LIKE '%gpl%'
               OR COALESCE(r.license, '') = ''
               OR LOWER(COALESCE(r.license, '')) = 'other')
      `)
      .bind(userLogin)
      .first<{ cnt: number }>()
    const licenseRiskCount = riskRow?.cnt ?? 0

    // 最后同步时间
    const userRow = await this.db
      .prepare('SELECT synced_at FROM users WHERE login = ?')
      .bind(userLogin)
      .first<{ synced_at: string | null }>()

    return {
      repoCount,
      activeRepoCount,
      tagCount,
      hiddenGemsCount,
      sleepStarsCount,
      licenseRiskCount,
      lastSyncedAt: userRow?.synced_at ?? null,
    }
  }

  // ===== 全局概览 =====

  /**
   * 查询全库概览统计
   * 只统计真实用户的有效星标，避免 demo-user 和 removed_at 记录污染总览
   */
  async getOverview(options?: ThresholdOptions): Promise<{
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
  }> {
    const { sleepMs, gemStarsMin, gemStarsMax } = resolveThresholds(options)
    const cutoffDate = new Date(Date.now() - sleepMs).toISOString()
    const baseWhere = `s.removed_at IS NULL AND s.user_login != ?`

    // 用户数和最后同步时间
    const userRow = await this.db
      .prepare(`
        SELECT COUNT(*) as cnt, MAX(synced_at) as lastSyncedAt
        FROM users WHERE login != ?
      `)
      .bind(SYSTEM_DEMO_LOGIN)
      .first<{ cnt: number; lastSyncedAt: string | null }>()

    // 仓库数
    const repoRow = await this.db
      .prepare(`SELECT COUNT(DISTINCT s.repo_full_name) as cnt FROM stars s WHERE ${baseWhere}`)
      .bind(SYSTEM_DEMO_LOGIN)
      .first<{ cnt: number }>()

    // 活跃仓库数
    const activeRow = await this.db
      .prepare(`
        SELECT COUNT(DISTINCT r.full_name) as cnt FROM repos r
        JOIN stars s ON r.full_name = s.repo_full_name
        WHERE ${baseWhere} AND r.pushed_at >= ?
      `)
      .bind(SYSTEM_DEMO_LOGIN, cutoffDate)
      .first<{ cnt: number }>()

    // 标签数
    const tagRow = await this.db
      .prepare(`
        SELECT COUNT(DISTINCT rt.tag) as cnt FROM repo_tags rt
        JOIN stars s ON rt.repo_full_name = s.repo_full_name
        WHERE ${baseWhere}
      `)
      .bind(SYSTEM_DEMO_LOGIN)
      .first<{ cnt: number }>()

    // 隐藏宝石
    const hiddenGemsRow = await this.db
      .prepare(`
        SELECT COUNT(DISTINCT r.full_name) as cnt FROM repos r
        JOIN stars s ON r.full_name = s.repo_full_name
        WHERE ${baseWhere} AND r.stars <= ? AND r.pushed_at >= ?
      `)
      .bind(SYSTEM_DEMO_LOGIN, gemStarsMax, cutoffDate)
      .first<{ cnt: number }>()

    // 沉睡星标
    const sleepRow = await this.db
      .prepare(`
        SELECT COUNT(DISTINCT r.full_name) as cnt FROM repos r
        JOIN stars s ON r.full_name = s.repo_full_name
        WHERE ${baseWhere} AND (r.pushed_at IS NULL OR r.pushed_at < ?)
      `)
      .bind(SYSTEM_DEMO_LOGIN, cutoffDate)
      .first<{ cnt: number }>()

    // 协议风险
    const riskRow = await this.db
      .prepare(`
        SELECT COUNT(DISTINCT r.full_name) as cnt FROM repos r
        JOIN stars s ON r.full_name = s.repo_full_name
        WHERE ${baseWhere}
          AND (LOWER(COALESCE(r.license, '')) LIKE '%gpl%'
               OR COALESCE(r.license, '') = ''
               OR LOWER(COALESCE(r.license, '')) = 'other')
      `)
      .bind(SYSTEM_DEMO_LOGIN)
      .first<{ cnt: number }>()

    // 语言分布
    const languagesResult = await this.db
      .prepare(`
        SELECT COALESCE(r.language, 'Unknown') as language, COUNT(DISTINCT r.full_name) as count
        FROM repos r JOIN stars s ON r.full_name = s.repo_full_name
        WHERE ${baseWhere}
        GROUP BY COALESCE(r.language, 'Unknown')
        ORDER BY count DESC
      `)
      .bind(SYSTEM_DEMO_LOGIN)
      .all<LanguageStat>()

    // 协议分布
    const licensesResult = await this.db
      .prepare(`
        SELECT COALESCE(r.license, 'Unknown') as license, COUNT(DISTINCT r.full_name) as count
        FROM repos r JOIN stars s ON r.full_name = s.repo_full_name
        WHERE ${baseWhere}
        GROUP BY COALESCE(r.license, 'Unknown')
        ORDER BY count DESC
      `)
      .bind(SYSTEM_DEMO_LOGIN)
      .all<LicenseStat>()

    // Topics 分布
    const topicRowsResult = await this.db
      .prepare(`
        SELECT DISTINCT r.full_name, r.topics_json
        FROM repos r JOIN stars s ON r.full_name = s.repo_full_name
        WHERE ${baseWhere} AND r.topics_json IS NOT NULL
      `)
      .bind(SYSTEM_DEMO_LOGIN)
      .all<{ topics_json: string }>()

    const topicCount = new Map<string, number>()
    for (const row of topicRowsResult.results || []) {
      try {
        const topics: string[] = JSON.parse(row.topics_json)
        for (const topic of topics) {
          topicCount.set(topic, (topicCount.get(topic) || 0) + 1)
        }
      } catch {
        // 忽略坏数据
      }
    }
    const topics = Array.from(topicCount.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)

    // 最近星标
    const recentStarsResult = await this.db
      .prepare(`
        SELECT r.full_name, r.description, r.language, MAX(s.starred_at) as starred_at
        FROM repos r JOIN stars s ON r.full_name = s.repo_full_name
        WHERE ${baseWhere} AND s.starred_at IS NOT NULL
        GROUP BY r.full_name, r.description, r.language
        ORDER BY starred_at DESC
        LIMIT 10
      `)
      .bind(SYSTEM_DEMO_LOGIN)
      .all<{
        full_name: string
        description: string | null
        language: string | null
        starred_at: string
      }>()

    // 宝石仓库
    const gemReposResult = await this.db
      .prepare(`
        SELECT DISTINCT r.full_name, r.description, r.html_url, r.language, r.stars, r.forks
        FROM repos r JOIN stars s ON r.full_name = s.repo_full_name
        WHERE ${baseWhere}
          AND r.stars BETWEEN ? AND ?
          AND r.pushed_at >= ?
        ORDER BY r.stars DESC
        LIMIT 3
      `)
      .bind(SYSTEM_DEMO_LOGIN, gemStarsMin, GEM_STARS_UPPER, cutoffDate)
      .all<{
        full_name: string
        description: string | null
        html_url: string
        language: string | null
        stars: number
        forks: number
      }>()

    // 星标趋势（按月聚合，全量返回）
    const trendResult = await this.db
      .prepare(`
        SELECT substr(s.starred_at, 1, 7) as label, COUNT(*) as value
        FROM stars s
        WHERE ${baseWhere} AND s.starred_at IS NOT NULL
        GROUP BY substr(s.starred_at, 1, 7)
        ORDER BY label ASC
      `)
      .bind(SYSTEM_DEMO_LOGIN)
      .all<{ label: string; value: number }>()

    return {
      userCount: userRow?.cnt ?? 0,
      repoCount: repoRow?.cnt ?? 0,
      activeRepoCount: activeRow?.cnt ?? 0,
      tagCount: tagRow?.cnt ?? 0,
      hiddenGemsCount: hiddenGemsRow?.cnt ?? 0,
      sleepStarsCount: sleepRow?.cnt ?? 0,
      licenseRiskCount: riskRow?.cnt ?? 0,
      lastSyncedAt: userRow?.lastSyncedAt ?? null,
      languages: languagesResult.results || [],
      topics,
      licenses: licensesResult.results || [],
      recentStars: recentStarsResult.results || [],
      gemRepos: gemReposResult.results || [],
      starTrend: (trendResult.results || []).map(r => ({ label: r.label, value: r.value })),
    }
  }

  /**
   * 查询指定用户按月的 star 仓库数量时间轴
   */
  async getUserStarTimeline(login: string): Promise<Array<{ month: string; count: number }>> {
    const result = await this.db
      .prepare(`
        SELECT strftime('%Y-%m', starred_at) as month, COUNT(*) as count
        FROM stars
        WHERE user_login = ? AND starred_at IS NOT NULL AND removed_at IS NULL
        GROUP BY month
        ORDER BY month ASC
      `)
      .bind(login)
      .all<{ month: string; count: number }>()
    return result.results || []
  }

  /**
   * 查询用户标签列表（带 count）
   */
  async listTags(login: string): Promise<Array<{ tag: string; count: number }>> {
    const result = await this.db
      .prepare(`
        SELECT tag, COUNT(*) as count
        FROM repo_tags
        WHERE repo_full_name IN (SELECT repo_full_name FROM stars WHERE user_login = ?)
        GROUP BY tag
        ORDER BY count DESC
      `)
      .bind(login)
      .all<{ tag: string; count: number }>()
    return result.results || []
  }

  /**
   * 查询同步历史记录
   */
  async listSyncRuns(login: string, limit = 20): Promise<Array<{
    id: number
    user_login: string
    started_at: string
    ended_at: string | null
    status: string
    repos_upserted: number
    stars_upserted: number
    repos_removed: number
    pages_fetched: number
    rate_limit_remaining: number | null
    rate_limit_reset: string | null
    error_message: string | null
  }>> {
    const result = await this.db
      .prepare(`
        SELECT id, user_login, started_at, ended_at, status,
               repos_upserted, stars_upserted, repos_removed, pages_fetched,
               rate_limit_remaining, rate_limit_reset, error_message
        FROM sync_runs
        WHERE user_login = ?
        ORDER BY started_at DESC
        LIMIT ?
      `)
      .bind(login, limit)
      .all()
    return (result.results || []) as Array<{
      id: number
      user_login: string
      started_at: string
      ended_at: string | null
      status: string
      repos_upserted: number
      stars_upserted: number
      repos_removed: number
      pages_fetched: number
      rate_limit_remaining: number | null
      rate_limit_reset: string | null
      error_message: string | null
    }>
  }

  // ===== 写入操作（用于同步） =====

  /**
   * 创建或更新用户（标记未删除）
   * 在同步开始前调用，确保用户记录存在
   */
  async upsertUserForSync(login: string, now: string): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO users (login, synced_at, deleted_at) VALUES (?, ?, NULL)
        ON CONFLICT(login) DO UPDATE SET synced_at = excluded.synced_at, deleted_at = NULL
      `)
      .bind(login, now)
      .run()
  }

  /**
   * 更新用户 GitHub 公开资料
   */
  async upsertUserProfile(profile: {
    login: string
    avatar_url: string | null
    html_url: string
    name: string | null
    bio: string | null
    company: string | null
    location: string | null
    followers: number
    public_repos: number
  }, now: string): Promise<void> {
    await this.db
      .prepare(`
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
      .bind(
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
      .run()
  }

  /**
   * 创建 sync_runs 记录，返回 id
   */
  async insertSyncRun(userLogin: string, now: string): Promise<number> {
    const result = await this.db
      .prepare(`
        INSERT INTO sync_runs (user_login, started_at, status, next_page)
        VALUES (?, ?, 'running', 1)
      `)
      .bind(userLogin, now)
      .run()
    // D1 返回 meta.last_row_id
    return (result.meta as any)?.last_row_id ?? 0
  }

  /** 读取指定用户的续传任务，防止串用其他用户的 syncId。 */
  async getSyncRun(id: number, userLogin: string): Promise<{
    id: number
    user_login: string
    started_at: string
    status: string
    repos_upserted: number
    stars_upserted: number
    pages_fetched: number
    next_page: number
  } | null> {
    return await this.db
      .prepare(`
        SELECT id, user_login, started_at, status, repos_upserted, stars_upserted,
               pages_fetched, next_page
        FROM sync_runs
        WHERE id = ? AND user_login = ?
      `)
      .bind(id, userLogin)
      .first()
  }

  /** 将部分同步重新置为运行中，允许前端继续下一批。 */
  async resumeSyncRun(id: number, nextPage: number): Promise<void> {
    await this.db
      .prepare(`UPDATE sync_runs SET status = 'running', ended_at = NULL, error_message = NULL, next_page = ? WHERE id = ?`)
      .bind(nextPage, id)
      .run()
  }

  /**
   * 更新 sync_runs 为成功状态
   */
  async updateSyncRunSuccess(
    id: number,
    endedAt: string,
    reposUpserted: number,
    starsUpserted: number,
    reposRemoved: number,
    pagesFetched: number,
    rateLimitRemaining: number | null,
    rateLimitReset: string | null,
  ): Promise<void> {
    await this.db
      .prepare(`
        UPDATE sync_runs SET
          status = 'success',
          ended_at = ?,
          repos_upserted = ?,
          stars_upserted = ?,
          repos_removed = ?,
          pages_fetched = ?,
          rate_limit_remaining = ?,
          rate_limit_reset = ?,
          next_page = 0
        WHERE id = ?
      `)
      .bind(endedAt, reposUpserted, starsUpserted, reposRemoved, pagesFetched, rateLimitRemaining, rateLimitReset, id)
      .run()
  }

  /**
   * 更新 sync_runs 为部分完成状态。
   * 用于 Worker 达到分页上限时，明确告诉前端和 AI 层数据不完整。
   */
  async updateSyncRunPartial(
    id: number,
    endedAt: string,
    reposUpserted: number,
    starsUpserted: number,
    pagesFetched: number,
    rateLimitRemaining: number | null,
    rateLimitReset: string | null,
    warning: string,
    nextPage: number,
  ): Promise<void> {
    await this.db
      .prepare(`
        UPDATE sync_runs SET
          status = 'partial',
          ended_at = ?,
          repos_upserted = ?,
          stars_upserted = ?,
          repos_removed = 0,
          pages_fetched = ?,
          rate_limit_remaining = ?,
          rate_limit_reset = ?,
          next_page = ?,
          error_message = ?
        WHERE id = ?
      `)
      .bind(endedAt, reposUpserted, starsUpserted, pagesFetched, rateLimitRemaining, rateLimitReset, nextPage, warning, id)
      .run()
  }

  /**
   * 更新 sync_runs 为失败状态
   */
  async updateSyncRunFailure(id: number, endedAt: string, errorMessage: string): Promise<void> {
    await this.db
      .prepare(`UPDATE sync_runs SET status = 'failed', ended_at = ?, error_message = ? WHERE id = ?`)
      .bind(endedAt, errorMessage, id)
      .run()
  }

  /**
   * 批量 upsert 仓库和星标（使用 D1 batch 替代事务）
   * @returns upserted 数量
   */
  async batchUpsertReposAndStars(
    userLogin: string,
    repos: Array<{
      repo: {
        id: number
        full_name: string
        owner: { login: string }
        name: string
        html_url: string
        description: string | null
        language: string | null
        license: { spdx_id: string } | null
        stargazers_count: number
        forks_count: number
        open_issues_count: number
        topics: string[]
        created_at: string
        updated_at: string
        pushed_at: string | null
        archived: boolean
        fork: boolean
        homepage: string | null
      }
      starred_at: string
    }>,
    now: string,
    syncRunId = 0,
  ): Promise<{ reposUpserted: number; starsUpserted: number }> {
    if (repos.length === 0) {
      return { reposUpserted: 0, starsUpserted: 0 }
    }

    const stmts: D1PreparedStatement[] = []

    for (const item of repos) {
      const repo = item.repo

      // upsert 仓库
      stmts.push(
        this.db.prepare(`
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
        `).bind(
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
        ),
      )

      // upsert 星标
      stmts.push(
        this.db.prepare(`
          INSERT INTO stars (user_login, repo_full_name, starred_at, first_seen_at, last_seen_at, sync_run_id, removed_at)
          VALUES (?, ?, ?, ?, ?, ?, NULL)
          ON CONFLICT(user_login, repo_full_name) DO UPDATE SET
            starred_at = excluded.starred_at,
            last_seen_at = excluded.last_seen_at,
            sync_run_id = excluded.sync_run_id,
            removed_at = NULL
        `).bind(userLogin, repo.full_name, item.starred_at, now, now, syncRunId),
      )
    }

    // D1 batch 原子执行；分块降低 Worker/D1 单次批量语句压力。
    const chunkSize = 100
    for (let i = 0; i < stmts.length; i += chunkSize) {
      await this.db.batch(stmts.slice(i, i + chunkSize))
    }

    return { reposUpserted: repos.length, starsUpserted: repos.length }
  }

  /**
   * 标记 removed_at：本地有但本次 API 未返回的仓库
   *
   * 实现说明：D1 对单条 SQL 的绑定变量数有上限，当仓库数量较多时
   * 使用 NOT IN (?, ?, ...) 会触发 "too many SQL variables" 错误。
   * 改用「查询当前活跃星标 → JS 集合差 → 批量 UPDATE」的方式，
   * 既绕过变量数限制，又能保证语义等价。
   */
  async markRemovedStars(userLogin: string, seenFullNames: string[], now: string): Promise<number> {
    if (seenFullNames.length === 0) return 0

    // 1. 查询该用户当前所有活跃星标的 repo_full_name
    const result = await this.db
      .prepare('SELECT repo_full_name FROM stars WHERE user_login = ? AND removed_at IS NULL')
      .bind(userLogin)
      .all<{ repo_full_name: string }>()

    const currentFullNames = result.results?.map(r => r.repo_full_name) ?? []
    if (currentFullNames.length === 0) return 0

    // 2. 计算需要标记移除的仓库（本地有但 seenFullNames 中没有）
    const seenSet = new Set(seenFullNames)
    const toRemove = currentFullNames.filter(name => !seenSet.has(name))

    if (toRemove.length === 0) return 0

    // 3. 用 D1 batch 批量 UPDATE，每条语句仅 3 个绑定变量，避免变量数限制
    const stmts: D1PreparedStatement[] = toRemove.map(fullName =>
      this.db
        .prepare('UPDATE stars SET removed_at = ? WHERE user_login = ? AND repo_full_name = ? AND removed_at IS NULL')
        .bind(now, userLogin, fullName),
    )

    await this.db.batch(stmts)
    return toRemove.length
  }

  /** 最终批次按 sync_run_id 标记 removed，避免跨请求保存完整仓库名列表。 */
  async markRemovedStarsBySyncRun(userLogin: string, syncRunId: number, now: string): Promise<number> {
    const result = await this.db
      .prepare(`
        UPDATE stars
        SET removed_at = ?
        WHERE user_login = ? AND removed_at IS NULL
          AND (sync_run_id IS NULL OR sync_run_id != ?)
      `)
      .bind(now, userLogin, syncRunId)
      .run()
    return Number(result.meta?.changes ?? 0)
  }

  /**
   * 读取用户最新一次同步状态，用于阻止基于不完整数据生成 AI 缓存。
   */
  async getLatestSyncRun(userLogin: string): Promise<{ status: string; error_message: string | null } | null> {
    const result = await this.db
      .prepare(`
        SELECT status, error_message
        FROM sync_runs
        WHERE user_login = ?
        ORDER BY started_at DESC, id DESC
        LIMIT 1
      `)
      .bind(userLogin)
      .first<{ status: string; error_message: string | null }>()
    return result ?? null
  }

  /**
   * 清理用户级 AI 缓存。
   * 同步数据变化后旧画像/学习路径可能不再准确，必须重新生成。
   */
  async clearUserAiCache(login: string): Promise<void> {
    await this.db
      .prepare(`
        DELETE FROM translations
        WHERE repo_full_name = ?
          AND target_lang IN (${USER_AI_CACHE_KEYS.map(() => '?').join(', ')})
      `)
      .bind(getUserAiCacheKey(login), ...USER_AI_CACHE_KEYS)
      .run()
  }

  // ===== AI 缓存读写（translations 表）=====

  /**
   * 读取单条翻译缓存
   * @param repoFullName 仓库全名，或 'user:login' 形式的用户级缓存键
   * @param targetLang 目标语言 key（如 'zh'、'en'、'dna-zh'、'learning-en'）
   * @returns 缓存内容（translated_readme_summary 字段），未命中返回 null
   */
  async getCachedTranslation(
    repoFullName: string,
    targetLang: string,
  ): Promise<string | null> {
    const result = await this.db
      .prepare(
        'SELECT translated_readme_summary FROM translations WHERE repo_full_name = ? AND target_lang = ?',
      )
      .bind(repoFullName, targetLang)
      .first<{ translated_readme_summary: string | null }>()
    return result?.translated_readme_summary || null
  }

  /**
   * 写入单条翻译缓存（upsert）
   * 用于仓库级 readme-summary 的中英文版本独立写入
   * @param repoFullName 仓库全名
   * @param targetLang 语言 key（'zh' 或 'en'）
   * @param content 缓存内容（JSON 字符串或纯文本）
   * @param now 时间戳
   */
  async upsertTranslation(
    repoFullName: string,
    targetLang: string,
    content: string,
    now: string,
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO translations (repo_full_name, target_lang, translated_readme_summary, provider, updated_at)
         VALUES (?, ?, ?, 'ai', ?)
         ON CONFLICT(repo_full_name, target_lang) DO UPDATE SET
           translated_readme_summary = excluded.translated_readme_summary,
           provider = excluded.provider,
           updated_at = excluded.updated_at`,
      )
      .bind(repoFullName, targetLang, content, now)
      .run()
  }

  /**
   * 批量写入用户级 AI 缓存（中英文对，原子写入）
   * 用 D1 batch 模拟事务，保证中英文同时写入或同时失败
   * @param login 用户登录名
   * @param zhKey 中文缓存 key（如 'dna-zh'、'learning-zh'）
   * @param zhText 中文内容
   * @param enKey 英文缓存 key（如 'dna-en'、'learning-en'）
   * @param enText 英文内容（可为空，翻译失败时不写入）
   * @param now 时间戳
   */
  async cacheUserAiTextPair(
    login: string,
    zhKey: string,
    zhText: string,
    enKey: string,
    enText: string,
    now: string,
  ): Promise<void> {
    const userKey = getUserAiCacheKey(login)
    const stmts: D1PreparedStatement[] = [
      this.db
        .prepare(
          `INSERT INTO translations (repo_full_name, target_lang, translated_readme_summary, provider, updated_at)
           VALUES (?, ?, ?, 'ai', ?)
           ON CONFLICT(repo_full_name, target_lang) DO UPDATE SET
             translated_readme_summary = excluded.translated_readme_summary,
             provider = excluded.provider,
             updated_at = excluded.updated_at`,
        )
        .bind(userKey, zhKey, zhText, now),
    ]

    // 英文内容存在才写入（翻译失败时 enText 为空字符串）
    if (enText) {
      stmts.push(
        this.db
          .prepare(
            `INSERT INTO translations (repo_full_name, target_lang, translated_readme_summary, provider, updated_at)
             VALUES (?, ?, ?, 'ai', ?)
             ON CONFLICT(repo_full_name, target_lang) DO UPDATE SET
               translated_readme_summary = excluded.translated_readme_summary,
               provider = excluded.provider,
               updated_at = excluded.updated_at`,
          )
          .bind(userKey, enKey, enText, now),
      )
    }

    // D1 batch 保证原子性
    await this.db.batch(stmts)
  }

  /**
   * 获取用户代表性星标仓库（按 stars 降序，用于 AI 生成画像和学习路径）
   * @param login 用户登录名
   * @param limit 返回数量
   * @returns 仓库列表（full_name, description, stars）
   */
  async getUserTopRepos(
    login: string,
    limit = 5,
  ): Promise<Array<{ full_name: string; description: string; stars: number }>> {
    const result = await this.db
      .prepare(
        `SELECT r.full_name, r.description, r.stars
         FROM repos r JOIN stars s ON r.full_name = s.repo_full_name
         WHERE s.user_login = ? AND s.removed_at IS NULL AND r.description IS NOT NULL
         ORDER BY r.stars DESC LIMIT ?`,
      )
      .bind(login, limit)
      .all<{ full_name: string; description: string | null; stars: number }>()
    // 将 description: string | null 转为 string（null 转空字符串）
    // 与 AI client prompt 模板期望一致（r.description || ''）
    return (result.results || []).map((r) => ({
      full_name: r.full_name,
      description: r.description || '',
      stars: r.stars,
    }))
  }

  /**
   * 获取用户星标语言分布（top N，用于 AI 生成）
   * @param login 用户登录名
   * @param limit 返回数量
   */
  async getUserTopLanguages(
    login: string,
    limit = 5,
  ): Promise<Array<{ language: string; count: number }>> {
    const result = await this.db
      .prepare(
        `SELECT language, COUNT(*) as count FROM repos
         WHERE full_name IN (
           SELECT repo_full_name FROM stars WHERE user_login = ? AND removed_at IS NULL
         )
         GROUP BY language ORDER BY count DESC LIMIT ?`,
      )
      .bind(login, limit)
      .all<{ language: string; count: number }>()
    return result.results || []
  }

  /**
   * 获取用户星标标签分布（top N，用于 AI 生成）
   * @param login 用户登录名
   * @param limit 返回数量
   */
  async getUserTopTags(
    login: string,
    limit = 8,
  ): Promise<Array<{ tag: string; count: number }>> {
    const result = await this.db
      .prepare(
        `SELECT tag, COUNT(*) as count FROM repo_tags
         WHERE repo_full_name IN (
           SELECT repo_full_name FROM stars WHERE user_login = ? AND removed_at IS NULL
         )
         GROUP BY tag ORDER BY count DESC LIMIT ?`,
      )
      .bind(login, limit)
      .all<{ tag: string; count: number }>()
    return result.results || []
  }

  // ===== 分类 =====

  /**
   * 为指定用户的所有星标仓库执行规则分类
   * 使用 shared 层的 classifyRepo 纯函数
   */
  async classifyReposForUser(userLogin: string): Promise<{ repoCount: number; tagsCreated: number }> {
    // 1. 查询用户所有仓库（含 topics_json、name、description）
    const result = await this.db
      .prepare(`
        SELECT r.full_name, r.name, r.description, r.topics_json
        FROM repos r
        JOIN stars s ON r.full_name = s.repo_full_name
        WHERE s.user_login = ? AND s.removed_at IS NULL
      `)
      .bind(userLogin)
      .all<{
        full_name: string
        name: string
        description: string | null
        topics_json: string | null
      }>()

    const repos = result.results || []
    if (repos.length === 0) {
      return { repoCount: 0, tagsCreated: 0 }
    }

    // 2. 删除旧的规则分类标签（保留 manual 标签）
    await this.db
      .prepare(`DELETE FROM repo_tags WHERE repo_full_name IN (SELECT repo_full_name FROM stars WHERE user_login = ?) AND tag_source != 'manual'`)
      .bind(userLogin)
      .run()

    // 3. 对每个仓库执行分类，生成 batch 写入
    const stmts: D1PreparedStatement[] = []
    let tagsCreated = 0

    for (const repo of repos) {
      const tags = classifyRepo(repo.name, repo.description, repo.topics_json)
      for (const tag of tags) {
        stmts.push(
          this.db.prepare(`
            INSERT INTO repo_tags (repo_full_name, tag, tag_source, confidence)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(repo_full_name, tag) DO UPDATE SET
              tag_source = excluded.tag_source,
              confidence = excluded.confidence
          `).bind(repo.full_name, tag.tag, tag.source, tag.confidence),
        )
        tagsCreated++
      }
    }

    // 4. 批量写入
    if (stmts.length > 0) {
      await this.db.batch(stmts)
    }

    return { repoCount: repos.length, tagsCreated }
  }

  // ===== 工具函数 =====

  /**
   * 将数据库行映射为 RepoRow 类型
   * 统一字段名和类型转换
   */
  private mapRepoRow(row: any): RepoRow {
    return {
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
    }
  }
}
