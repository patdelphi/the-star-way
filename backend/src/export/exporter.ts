/**
 * 导出模块
 * 将仓库查询结果导出为 CSV / JSON / Markdown / HTML 格式
 * 四种格式字段完全一致，导出内容与当前筛选条件一致
 */
import type Database from 'better-sqlite3'
import { queryRepos } from '../repository/repo-queries.js'
import { ACTIVE_DAYS_MS, GEM_STARS_MAX } from '../repository/repo-queries.js'
import type { RepoQueryParams } from '../db/types.js'

// 导出查询参数（继承 RepoQueryParams，加上 login）
export interface ExportParams extends RepoQueryParams {
  login: string
}

// ===== 统一字段定义 =====
// 所有格式导出完全相同的字段集
const EXPORT_FIELDS = [
  'full_name',
  'description',
  'language',
  'license',
  'stars',
  'forks',
  'open_issues',
  'html_url',
  'pushed_at',
  'starred_at',
  'tags',
] as const

// CSV 导出 =====

/**
 * 将仓库数据导出为 CSV（UTF-8 BOM）
 */
export function exportCsv(db: Database.Database, login: string, params: Omit<RepoQueryParams, 'limit' | 'offset'> = {}): string {
  const result = queryRepos(db, { ...params, userLogin: login, limit: Number.MAX_SAFE_INTEGER, offset: 0 })

  const BOM = '\uFEFF'
  const header = EXPORT_FIELDS.join(',')

  const rows = result.items.map(item => {
    const repo = item.repo
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
      esc(repo.html_url),
      esc(repo.pushed_at),
      esc(item.starred_at),
      esc(item.tags.join(';')),
    ].join(',')
  })

  return BOM + [header, ...rows].join('\r\n') + '\r\n'
}

// JSON 导出 =====

/**
 * 将仓库数据导出为 JSON
 */
export function exportJson(db: Database.Database, login: string, params: Omit<RepoQueryParams, 'limit' | 'offset'> = {}): string {
  const result = queryRepos(db, { ...params, userLogin: login, limit: Number.MAX_SAFE_INTEGER, offset: 0 })

  const data = {
    login,
    exported_at: new Date().toISOString(),
    total: result.total,
    fields: EXPORT_FIELDS,
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

// Markdown 导出 =====

/**
 * 将仓库数据导出为 Markdown 表格
 */
export function exportMarkdown(db: Database.Database, login: string, params: Omit<RepoQueryParams, 'limit' | 'offset'> = {}): string {
  const result = queryRepos(db, { ...params, userLogin: login, limit: Number.MAX_SAFE_INTEGER, offset: 0 })

  const lines: string[] = []

  lines.push(`# ${login} - Starred Repositories`)
  lines.push('')
  lines.push(`> Exported at ${new Date().toISOString()}`)
  lines.push(`> Total: ${result.total} repos`)
  lines.push('')

  // 表格头（统一字段）
  lines.push('| Repository | Description | Language | License | Stars | Forks | Issues | URL | Pushed At | Starred At | Tags |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')

  for (const item of result.items) {
    const repo = item.repo
    const esc = (v: string | null | undefined) => {
      if (v == null) return ''
      return String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ')
    }
    lines.push(
      `| ${esc(repo.full_name)} | ${esc(repo.description)} | ${esc(repo.language)} | ${esc(repo.license)} | ${repo.stars} | ${repo.forks} | ${repo.open_issues} | ${esc(repo.html_url)} | ${esc(repo.pushed_at?.slice(0, 10))} | ${esc(item.starred_at?.slice(0, 10))} | ${esc(item.tags.join(', '))} |`
    )
  }

  return lines.join('\r\n') + '\r\n'
}

// HTML 导出 =====

/**
 * 将仓库数据导出为 HTML 表格
 */
export function exportHtml(db: Database.Database, login: string, params: Omit<RepoQueryParams, 'limit' | 'offset'> = {}): string {
  const result = queryRepos(db, { ...params, userLogin: login, limit: Number.MAX_SAFE_INTEGER, offset: 0 })
  const now = new Date().toISOString()

  const escHtml = (v: string | null | undefined) => {
    if (v == null) return ''
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  const rows = result.items.map(item => {
    const repo = item.repo
    return `      <tr>
        <td><a href="${escHtml(repo.html_url)}" target="_blank">${escHtml(repo.full_name)}</a></td>
        <td>${escHtml(repo.description)}</td>
        <td>${escHtml(repo.language)}</td>
        <td>${escHtml(repo.license)}</td>
        <td style="text-align:right">${repo.stars}</td>
        <td style="text-align:right">${repo.forks}</td>
        <td style="text-align:right">${repo.open_issues}</td>
        <td><a href="${escHtml(repo.html_url)}" target="_blank">${escHtml(repo.html_url)}</a></td>
        <td>${escHtml(repo.pushed_at?.slice(0, 10))}</td>
        <td>${escHtml(item.starred_at?.slice(0, 10))}</td>
        <td>${escHtml(item.tags.join(', '))}</td>
      </tr>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(login)} - Starred Repositories</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; background: #f8fafc; color: #1e293b; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .meta { color: #64748b; font-size: 14px; margin-bottom: 24px; }
    .meta span { margin-right: 16px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    thead { background: #f1f5f9; }
    th { padding: 12px 16px; text-align: left; font-size: 13px; font-weight: 600; color: #475569; white-space: nowrap; }
    td { padding: 10px 16px; font-size: 13px; border-top: 1px solid #e2e8f0; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    td:nth-child(2) { white-space: normal; }
    tr:hover { background: #f8fafc; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .tag { display: inline-block; background: #e0e7ff; color: #3730a3; border-radius: 4px; padding: 2px 8px; font-size: 12px; margin: 1px; }
    @media (max-width: 768px) { table { font-size: 12px } td, th { padding: 8px } }
  </style>
</head>
<body>
  <h1>${escHtml(login)} - Starred Repositories</h1>
  <div class="meta">
    <span>Exported at ${now}</span>
    <span>Total: ${result.total} repos</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Repository</th>
        <th>Description</th>
        <th>Language</th>
        <th>License</th>
        <th>Stars</th>
        <th>Forks</th>
        <th>Issues</th>
        <th>URL</th>
        <th>Pushed At</th>
        <th>Starred At</th>
        <th>Tags</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</body>
</html>`
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
 */
export function exportReportMarkdown(db: Database.Database, login: string): string {
  const now = new Date().toISOString()
  const total = queryRepoCount(db, login)
  const active = queryActiveRepoCount(db, login)
  const languages = queryLanguageStats(db, login)
  const topics = queryTopicStats(db, login)
  const licenses = queryLicenseStats(db, login)

  // 沉睡星标（90天未更新）
  const ninetyDaysAgo = new Date(Date.now() - ACTIVE_DAYS_MS).toISOString()
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
    WHERE s.user_login = ? AND r.stars <= ? AND r.pushed_at > ?
    ORDER BY r.stars DESC
    LIMIT 20
  `).all(login, 1000, ninetyDaysAgo) as Array<{ full_name: string; description: string; language: string; stars: number; pushed_at: string }>

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

  // 完整列表（统一字段）
  const result = queryRepos(db, { userLogin: login, limit: Number.MAX_SAFE_INTEGER, offset: 0 })
  lines.push(`## 完整仓库列表`)
  lines.push('')
  lines.push(`共 ${result.total} 个仓库`)
  lines.push('')
  lines.push('| Repository | Description | Language | License | Stars | Forks | Issues | URL | Pushed At | Starred At | Tags |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const item of result.items) {
    const repo = item.repo
    const esc = (v: string | null | undefined) => {
      if (v == null) return ''
      return String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ')
    }
    lines.push(
      `| ${esc(repo.full_name)} | ${esc(repo.description)} | ${esc(repo.language)} | ${esc(repo.license)} | ${repo.stars} | ${repo.forks} | ${repo.open_issues} | ${esc(repo.html_url)} | ${esc(repo.pushed_at?.slice(0, 10))} | ${esc(item.starred_at?.slice(0, 10))} | ${esc(item.tags.join(', '))} |`
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
