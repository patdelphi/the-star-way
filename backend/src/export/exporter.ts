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
