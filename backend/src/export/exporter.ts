/**
 * 导出模块
 * 将仓库查询结果导出为 CSV / JSON / Markdown 格式
 * 导出内容与当前筛选条件一致，不修改业务数据
 */
import type Database from 'better-sqlite3'
import { queryRepos } from '../repository/repo-queries.js'
import type { RepoQueryParams } from '../db/types.js'

// 导出查询参数（继承 RepoQueryParams，加上 login）
export interface ExportParams extends RepoQueryParams {
  login: string
}

// ===== CSV 导出 =====

/**
 * 将仓库数据导出为 CSV（UTF-8 BOM）
 * @param db 数据库连接
 * @param login 用户名
 * @param params 查询参数
 * @returns CSV 文本（UTF-8 BOM + CRLF 换行）
 */
export function exportCsv(db: Database.Database, login: string, params: Omit<RepoQueryParams, 'limit' | 'offset'> = {}): string {
  // 导出时取消分页限制，导出全部筛选结果
  const result = queryRepos(db, { ...params, userLogin: login, limit: 999999, offset: 0 })

  const BOM = '\uFEFF'
  const header = [
    'full_name', 'description', 'language', 'license',
    'stars', 'forks', 'open_issues', 'pushed_at', 'starred_at', 'tags',
  ].join(',')

  const rows = result.items.map(item => {
    const repo = item.repo
    // CSV 字段中若包含逗号或引号，需用双引号包裹并转义内部引号
    const esc = (v: string | null | undefined) => {
      if (v == null) return ''
      const s = String(v)
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"'
      }
      return s
    }
    return [
      esc(repo.full_name),
      esc(repo.description),
      esc(repo.language),
      esc(repo.license),
      repo.stars,
      repo.forks,
      repo.open_issues,
      esc(repo.pushed_at),
      esc(item.starred_at),
      esc(item.tags.join(';')),
    ].join(',')
  })

  // 使用 CRLF 换行
  return BOM + [header, ...rows].join('\r\n') + '\r\n'
}

// ===== JSON 导出 =====

/**
 * 将仓库数据导出为 JSON
 * @param db 数据库连接
 * @param login 用户名
 * @param params 查询参数
 * @returns JSON 字符串
 */
export function exportJson(db: Database.Database, login: string, params: Omit<RepoQueryParams, 'limit' | 'offset'> = {}): string {
  const result = queryRepos(db, { ...params, userLogin: login, limit: 999999, offset: 0 })

  const data = {
    login,
    exported_at: new Date().toISOString(),
    total: result.total,
    repos: result.items.map(item => ({
      full_name: item.repo.full_name,
      description: item.repo.description,
      language: item.repo.language,
      license: item.repo.license,
      stars: item.repo.stars,
      forks: item.repo.forks,
      open_issues: item.repo.open_issues,
      html_url: item.repo.html_url,
      pushed_at: item.repo.pushed_at,
      starred_at: item.starred_at,
      tags: item.tags,
    })),
  }

  return JSON.stringify(data, null, 2)
}

// ===== Markdown 导出 =====

/**
 * 将仓库数据导出为 Markdown 表格
 * @param db 数据库连接
 * @param login 用户名
 * @param params 查询参数
 * @returns Markdown 文本（CRLF 换行）
 */
export function exportMarkdown(db: Database.Database, login: string, params: Omit<RepoQueryParams, 'limit' | 'offset'> = {}): string {
  const result = queryRepos(db, { ...params, userLogin: login, limit: 999999, offset: 0 })

  const lines: string[] = []

  // 标题
  lines.push(`# ${login} - Starred Repositories`)
  lines.push('')
  lines.push(`> Exported at ${new Date().toISOString()}`)
  lines.push(`> Total: ${result.total} repos`)
  lines.push('')

  // 表格头
  lines.push('| Repository | Language | Stars | Forks | License | Tags |')
  lines.push('| --- | --- | --- | --- | --- | --- |')

  // 表格行
  for (const item of result.items) {
    const repo = item.repo
    // Markdown 表格中 | 需转义
    const esc = (v: string | null | undefined) => {
      if (v == null) return ''
      return String(v).replace(/\|/g, '\\|')
    }
    lines.push(
      `| ${esc(repo.full_name)} | ${esc(repo.language)} | ${repo.stars} | ${repo.forks} | ${esc(repo.license)} | ${esc(item.tags.join(', '))} |`
    )
  }

  return lines.join('\r\n') + '\r\n'
}

// ===== 分析报告导出 =====

import {
  queryActiveRepoCount,
  queryLanguageStats,
  queryTopicStats,
  queryLicenseStats,
} from '../repository/repo-queries.js'

/**
 * 生成面向阅读的分析报告（Markdown）
 * @param db 数据库连接
 * @param login 用户名
 * @returns Markdown 文本
 */
export function exportReportMarkdown(db: Database.Database, login: string): string {
  const now = new Date().toISOString()
  const total = queryRepoCount(db, login)
  const active = queryActiveRepoCount(db, login)
  const languages = queryLanguageStats(db, login)
  const topics = queryTopicStats(db, login)
  const licenses = queryLicenseStats(db, login)

  // 沉睡星标（90天未更新）
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const sleepStars = db.prepare(`
    SELECT r.full_name, r.description, r.language, r.stars, r.pushed_at
    FROM repos r
    JOIN stars s ON r.full_name = s.repo_full_name
    WHERE s.user_login = ? AND r.pushed_at < ?
    ORDER BY r.pushed_at ASC
    LIMIT 20
  `).all(login, ninetyDaysAgo) as Array<{ full_name: string; description: string; language: string; stars: number; pushed_at: string }>

  // License 风险
  const licenseRisk = db.prepare(`
    SELECT r.full_name, r.description, r.language, r.stars, r.license
    FROM repos r
    JOIN stars s ON r.full_name = s.repo_full_name
    WHERE s.user_login = ? AND (
      LOWER(r.license) LIKE '%gpl%' OR r.license = '' OR r.license = 'other' OR r.license = 'NOASSERTION'
    )
    ORDER BY r.stars DESC
    LIMIT 20
  `).all(login) as Array<{ full_name: string; description: string; language: string; stars: number; license: string }>

  // Hidden Gems（星标 <= 1000 且 90天内有更新）
  const hiddenGems = db.prepare(`
    SELECT r.full_name, r.description, r.language, r.stars, r.pushed_at
    FROM repos r
    JOIN stars s ON r.full_name = s.repo_full_name
    WHERE s.user_login = ? AND r.stars <= 1000 AND r.pushed_at > ?
    ORDER BY r.stars DESC
    LIMIT 20
  `).all(login, ninetyDaysAgo) as Array<{ full_name: string; description: string; language: string; stars: number; pushed_at: string }>

  const lines: string[] = []

  lines.push(`# the-star-way 星标分析报告`)
  lines.push('')
  lines.push(`**用户**: \`${login}\``)
  lines.push(`**生成时间**: ${now}`)
  lines.push('')

  // 概览
  lines.push(`## 概览`)
  lines.push('')
  lines.push(`- 星标仓库总数: **${total}**`)
  lines.push(`- 活跃仓库数（90天内更新）: **${active}**`)
  lines.push(`- 沉睡仓库数: **${sleepStars.length}**`)
  lines.push(`- License 风险仓库数: **${licenseRisk.length}**`)
  lines.push(`- Hidden Gems: **${hiddenGems.length}**`)
  lines.push('')

  // 技术栈
  lines.push(`## 技术栈概览`)
  lines.push('')
  lines.push(`### 主要语言`)
  lines.push('')
  lines.push('| 语言 | 数量 | 占比 |')
  lines.push('| --- | --- | --- |')
  for (const l of languages.slice(0, 10)) {
    const pct = total > 0 ? ((l.count / total) * 100).toFixed(1) : '0.0'
    lines.push(`| ${l.language || 'Unknown'} | ${l.count} | ${pct}% |`)
  }
  lines.push('')

  lines.push(`### 主要标签`)
  lines.push('')
  lines.push('| 标签 | 数量 |')
  lines.push('| --- | --- |')
  for (const t of topics.slice(0, 10)) {
    lines.push(`| ${t.topic} | ${t.count} |`)
  }
  lines.push('')

  lines.push(`### License 分布`)
  lines.push('')
  lines.push('| License | 数量 |')
  lines.push('| --- | --- |')
  for (const l of licenses.slice(0, 10)) {
    lines.push(`| ${l.license || 'Unknown'} | ${l.count} |`)
  }
  lines.push('')

  // 风险分析
  if (licenseRisk.length > 0) {
    lines.push(`## 风险分析`)
    lines.push('')
    lines.push(`### License 风险`)
    lines.push('')
    lines.push('以下仓库使用 GPL 或未知协议，可能限制商业使用：')
    lines.push('')
    lines.push('| 仓库 | 语言 | Stars | License |')
    lines.push('| --- | --- | --- | --- |')
    for (const r of licenseRisk) {
      lines.push(`| ${r.full_name} | ${r.language || ''} | ${r.stars} | ${r.license || ''} |`)
    }
    lines.push('')
  }

  if (sleepStars.length > 0) {
    lines.push(`### 沉睡星标`)
    lines.push('')
    lines.push('以下仓库超过 90 天未更新：')
    lines.push('')
    lines.push('| 仓库 | 语言 | Stars | 最后更新 |')
    lines.push('| --- | --- | --- | --- |')
    for (const r of sleepStars) {
      lines.push(`| ${r.full_name} | ${r.language || ''} | ${r.stars} | ${r.pushed_at?.slice(0, 10) || ''} |`)
    }
    lines.push('')
  }

  // Hidden Gems
  if (hiddenGems.length > 0) {
    lines.push(`## 隐藏宝石`)
    lines.push('')
    lines.push('星标数 <= 1000 且近期活跃的值得关注项目：')
    lines.push('')
    lines.push('| 仓库 | 语言 | Stars | 最后更新 |')
    lines.push('| --- | --- | --- | --- |')
    for (const r of hiddenGems) {
      lines.push(`| ${r.full_name} | ${r.language || ''} | ${r.stars} | ${r.pushed_at?.slice(0, 10) || ''} |`)
    }
    lines.push('')
  }

  // 完整列表
  const result = queryRepos(db, { userLogin: login, limit: 999999, offset: 0 })
  lines.push(`## 完整仓库列表`)
  lines.push('')
  lines.push(`共 ${result.total} 个仓库`)
  lines.push('')
  lines.push('| Repository | Language | Stars | Forks | License | Tags |')
  lines.push('| --- | --- | --- | --- | --- | --- |')
  for (const item of result.items) {
    const repo = item.repo
    const esc = (v: string | null | undefined) => {
      if (v == null) return ''
      return String(v).replace(/\|/g, '\\|')
    }
    lines.push(
      `| ${esc(repo.full_name)} | ${esc(repo.language)} | ${repo.stars} | ${repo.forks} | ${esc(repo.license)} | ${esc(item.tags.join(', '))} |`
    )
  }

  return lines.join('\r\n') + '\r\n'
}

function queryRepoCount(db: Database.Database, userLogin?: string): number {
  const where = userLogin ? 'WHERE s.user_login = ?' : ''
  const sql = `SELECT COUNT(*) as cnt FROM repos r JOIN stars s ON r.full_name = s.repo_full_name ${where}`
  const row = userLogin
    ? db.prepare(sql).get(userLogin) as { cnt: number }
    : db.prepare(sql).get() as { cnt: number }
  return row?.cnt || 0
}
