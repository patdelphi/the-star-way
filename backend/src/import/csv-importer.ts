/**
 * Demo CSV 导入模块
 * 将 Docs/github_starred_projects_691_COMPLETE.csv 导入 SQLite
 *
 * CSV 字段映射：
 * 序号 → 跳过
 * 项目名称 → full_name (owner/name 格式)
 * 星星数量 → stars (需清理数字格式)
 * 简介 → description
 * 中文简介 → 跳过（Phase 7 翻译使用）
 * URL → html_url
 * 编程语言 → language
 * License → license
 * Forks → forks
 * Open Issues → open_issues
 * Topics → topics_json (JSON 数组)
 * 标星时间 → starred_at
 * 最近更新 → pushed_at
 */
import { readFile } from 'node:fs/promises'
import { withTransaction } from '../db/connection.js'
import type Database from 'better-sqlite3'
import type { RepoRow, StarRow } from '../db/types.js'

// CSV 行解析后的结构化数据
export interface CsvRepoRecord {
  full_name: string
  stars: number
  description: string | null
  html_url: string
  language: string | null
  license: string | null
  forks: number
  open_issues: number
  topics: string[]
  starred_at: string | null
  pushed_at: string | null
}

/** Demo 默认用户 */
export const DEMO_USER_LOGIN = 'demo-user'

/**
 * 解析 CSV 文本为结构化记录数组
 * @param csvText CSV 文件内容（UTF-8 BOM 兼容）
 */
export function parseCsv(csvText: string): CsvRepoRecord[] {
  // 去除 BOM 头
  const text = csvText.replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) return []

  // 跳过表头
  const dataLines = lines.slice(1)
  const records: CsvRepoRecord[] = []

  for (const line of dataLines) {
    const record = parseCsvLine(line)
    if (record) records.push(record)
  }

  return records
}

/**
 * 解析单行 CSV（处理引号内的逗号）
 */
function parseCsvLine(line: string): CsvRepoRecord | null {
  // 使用正则分割 CSV 字段（处理引号内容）
  const fields = splitCsvFields(line)
  if (fields.length < 13) return null

  const [
    _序号,
    项目名称,
    星星数量,
    简介,
    _中文简介,
    url,
    language,
    license,
    forks,
    openIssues,
    topics,
    starredAt,
    pushedAt,
  ] = fields.map(f => f.trim())

  if (!项目名称 || !url) return null

  // 清理星星数量（可能包含逗号和空格）
  const stars = parseInt(星星数量.replace(/[, ]/g, ''), 10)
  if (isNaN(stars)) return null

  // 解析 topics 字符串为数组
  const topicsArr = topics
    ? topics.split(',').map(t => t.trim()).filter(Boolean)
    : []

  return {
    full_name: 项目名称,
    stars,
    description: 简介 || null,
    html_url: url,
    language: (language && language !== '未知') ? language : null,
    license: (license && license !== '未知') ? license : null,
    forks: parseInt(forks, 10) || 0,
    open_issues: parseInt(openIssues, 10) || 0,
    topics: topicsArr,
    starred_at: starredAt || null,
    pushed_at: pushedAt || null,
  }
}

/**
 * CSV 字段分割（处理引号包裹的字段）
 */
function splitCsvFields(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'
        i++ // 跳过转义引号
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

/**
 * 将 CSV 记录导入数据库
 * @param db 数据库连接
 * @param records 解析后的 CSV 记录
 * @param userLogin 用户名，默认 demo-user
 * @returns 导入的仓库数量
 */
export function importCsvRecords(
  db: Database.Database,
  records: CsvRepoRecord[],
  userLogin: string = DEMO_USER_LOGIN,
): number {
  const now = new Date().toISOString()

  // 准备 upsert 语句
  const upsertUser = db.prepare(`
    INSERT INTO users (login, avatar_url, profile_url, synced_at)
    VALUES (?, NULL, NULL, ?)
    ON CONFLICT(login) DO UPDATE SET synced_at = excluded.synced_at
  `)

  const upsertRepo = db.prepare(`
    INSERT INTO repos (github_id, full_name, owner, name, html_url, description, language, license,
      stars, forks, open_issues, topics_json, created_at, updated_at, pushed_at, archived, fork, homepage)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 0, 0, NULL)
    ON CONFLICT(full_name) DO UPDATE SET
      description = excluded.description,
      language = excluded.language,
      license = excluded.license,
      stars = excluded.stars,
      forks = excluded.forks,
      open_issues = excluded.open_issues,
      topics_json = excluded.topics_json,
      pushed_at = excluded.pushed_at
  `)

  const upsertStar = db.prepare(`
    INSERT INTO stars (user_login, repo_full_name, starred_at, first_seen_at, last_seen_at, removed_at)
    VALUES (?, ?, ?, ?, ?, NULL)
    ON CONFLICT(user_login, repo_full_name) DO UPDATE SET
      starred_at = excluded.starred_at,
      last_seen_at = excluded.last_seen_at,
      removed_at = NULL
  `)

  // 批量导入（在事务中执行）
  return withTransaction(db, () => {
    // 插入/更新用户
    upsertUser.run(userLogin, now)

    let count = 0
    for (const record of records) {
      const [owner, name] = record.full_name.split('/')
      if (!owner || !name) continue

      // 用 full_name 的哈希生成一个伪 github_id（Demo 数据没有真实 ID）
      const githubId = hashFullName(record.full_name)

      upsertRepo.run(
        githubId, record.full_name, owner, name, record.html_url,
        record.description, record.language, record.license,
        record.stars, record.forks, record.open_issues,
        JSON.stringify(record.topics), record.pushed_at,
      )

      upsertStar.run(userLogin, record.full_name, record.starred_at, now, now)

      count++
    }
    return count
  })
}

/**
 * 将 full_name 哈希为正整数，用作伪 github_id
 */
function hashFullName(fullName: string): number {
  let hash = 0
  for (let i = 0; i < fullName.length; i++) {
    const ch = fullName.charCodeAt(i)
    hash = ((hash << 5) - hash + ch) | 0
  }
  return Math.abs(hash) || 1
}

/**
 * 从 CSV 文件路径导入
 * @param db 数据库连接
 * @param csvFilePath CSV 文件绝对路径
 * @param userLogin 用户名
 * @returns 导入数量
 */
export async function importFromCsvFile(
  db: Database.Database,
  csvFilePath: string,
  userLogin: string = DEMO_USER_LOGIN,
): Promise<number> {
  const csvText = await readFile(csvFilePath, 'utf-8')
  const records = parseCsv(csvText)
  if (records.length === 0) return 0
  return importCsvRecords(db, records, userLogin)
}
