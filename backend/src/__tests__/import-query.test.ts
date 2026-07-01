/**
 * CSV 导入与查询集成测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createConnection, initDatabase, withTransaction } from '../db/connection.js'
import { parseCsv, importCsvRecords, DEMO_USER_LOGIN } from '../import/csv-importer.js'
import {
  queryRepos,
  queryRepoByName,
  queryLanguageStats,
  queryTopicStats,
  queryLicenseStats,
  queryRepoCount,
  queryActiveRepoCount,
} from '../repository/repo-queries.js'
import type Database from 'better-sqlite3'
import { rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const TEST_DB_DIR = join(tmpdir(), 'starway-test-csv-' + process.pid)
function getTestDbPath() { return join(TEST_DB_DIR, 'test.db') }
function cleanup() { if (existsSync(TEST_DB_DIR)) rmSync(TEST_DB_DIR, { recursive: true, force: true }) }

// 模拟 CSV 数据
const MOCK_CSV = `序号,项目名称,星星数量,简介,中文简介,URL,编程语言,License,Forks,Open Issues,Topics,标星时间,最近更新
1,octocat/Hello-World,100,A simple Hello World repo,简单的 Hello World 仓库,https://github.com/octocat/Hello-World,JavaScript,MIT,50,10,"hello, world, demo",2025-06-01,2026-01-15
2,torvalds/linux,200000,Linux kernel source tree,Linux 内核源码,https://github.com/torvalds/linux,C,GPL-2.0,50000,100,"kernel, linux, operating-system",2024-01-01,2026-06-30
3,microsoft/vscode,180000,Visual Studio Code,Visual Studio Code,https://github.com/microsoft/vscode,TypeScript,MIT,30000,200,"editor, vscode, typescript",2025-03-15,2026-06-28
4,denoland/deno,100000,A modern runtime for JS and TS,现代的 JS/TS 运行时,https://github.com/denoland/deno,Rust,MIT,8000,300,"deno, runtime, typescript",2025-09-01,2026-06-25
5,facebook/react,230000,A JavaScript library for building UIs,构建 UI 的 JS 库,https://github.com/facebook/react,JavaScript,MIT,47000,150,"react, javascript, frontend",2025-01-20,2026-06-20`

let db: Database.Database

describe('CSV 导入与查询', () => {
  beforeEach(() => {
    cleanup()
    db = createConnection(getTestDbPath())
    initDatabase(db)
  })

  afterEach(() => {
    db.close()
    cleanup()
  })

  // ===== CSV 解析测试 =====

  describe('parseCsv', () => {
    it('应正确解析 CSV 文本', () => {
      const records = parseCsv(MOCK_CSV)
      expect(records).toHaveLength(5)
    })

    it('第一条记录应为 octocat/Hello-World', () => {
      const records = parseCsv(MOCK_CSV)
      expect(records[0].full_name).toBe('octocat/Hello-World')
      expect(records[0].stars).toBe(100)
      expect(records[0].language).toBe('JavaScript')
      expect(records[0].license).toBe('MIT')
      expect(records[0].topics).toEqual(['hello', 'world', 'demo'])
    })

    it('应正确解析含逗号的星星数量', () => {
      const records = parseCsv(MOCK_CSV)
      expect(records[1].stars).toBe(200000)
    })

    it('未知语言和 License 应为 null', () => {
      const csv = `序号,项目名称,星星数量,简介,中文简介,URL,编程语言,License,Forks,Open Issues,Topics,标星时间,最近更新
1,test/repo,10,test,test,https://github.com/test/repo,未知,未知,1,1,,2025-01-01,2026-01-01`
      const records = parseCsv(csv)
      expect(records[0].language).toBeNull()
      expect(records[0].license).toBeNull()
    })
  })

  // ===== CSV 导入测试 =====

  describe('importCsvRecords', () => {
    it('应正确导入所有记录', () => {
      const records = parseCsv(MOCK_CSV)
      const count = importCsvRecords(db, records)
      expect(count).toBe(5)
    })

    it('导入后仓库总数应正确', () => {
      const records = parseCsv(MOCK_CSV)
      importCsvRecords(db, records)
      expect(queryRepoCount(db)).toBe(5)
    })

    it('导入后应创建 demo-user', () => {
      const records = parseCsv(MOCK_CSV)
      importCsvRecords(db, records)
      const user = db.prepare('SELECT * FROM users WHERE login = ?').get(DEMO_USER_LOGIN)
      expect(user).toBeDefined()
    })

    it('重复导入不应产生重复数据', () => {
      const records = parseCsv(MOCK_CSV)
      importCsvRecords(db, records)
      const firstCount = queryRepoCount(db)

      importCsvRecords(db, records)
      const secondCount = queryRepoCount(db)

      expect(secondCount).toBe(firstCount)
    })

    it('星标记录的 user_login 应正确', () => {
      const records = parseCsv(MOCK_CSV)
      importCsvRecords(db, records)
      const stars = db.prepare('SELECT COUNT(*) as cnt FROM stars WHERE user_login = ?').get(DEMO_USER_LOGIN) as { cnt: number }
      expect(stars.cnt).toBe(5)
    })

    it('topics_json 应为有效 JSON 数组', () => {
      const records = parseCsv(MOCK_CSV)
      importCsvRecords(db, records)
      const repo = db.prepare("SELECT topics_json FROM repos WHERE full_name = ?").get('octocat/Hello-World') as { topics_json: string }
      const topics = JSON.parse(repo.topics_json)
      expect(topics).toEqual(['hello', 'world', 'demo'])
    })
  })

  // ===== 查询测试 =====

  describe('queryRepos', () => {
    beforeEach(() => {
      const records = parseCsv(MOCK_CSV)
      importCsvRecords(db, records)
    })

    it('默认查询应返回所有仓库', () => {
      const result = queryRepos(db, {})
      expect(result.total).toBe(5)
      expect(result.items).toHaveLength(5)
    })

    it('默认按 stars DESC 排序', () => {
      const result = queryRepos(db, { limit: 3 })
      expect(result.items[0].repo.stars).toBeGreaterThanOrEqual(result.items[1].repo.stars)
    })

    it('按语言筛选', () => {
      const result = queryRepos(db, { language: 'TypeScript' })
      expect(result.total).toBe(1) // vscode
      expect(result.items.every(r => r.repo.language === 'TypeScript')).toBe(true)
    })

    it('按关键词搜索', () => {
      const result = queryRepos(db, { search: 'linux' })
      expect(result.total).toBe(1)
      expect(result.items[0].repo.full_name).toBe('torvalds/linux')
    })

    it('分页应正确', () => {
      const page1 = queryRepos(db, { limit: 2, offset: 0 })
      const page2 = queryRepos(db, { limit: 2, offset: 2 })
      expect(page1.items).toHaveLength(2)
      expect(page2.items).toHaveLength(2)
      // 确保不重叠
      const names1 = page1.items.map(r => r.repo.full_name)
      const names2 = page2.items.map(r => r.repo.full_name)
      expect(names1.some(n => names2.includes(n))).toBe(false)
    })

    it('按用户查询时不应返回其他用户的星标仓库', () => {
      const otherCsv = `序号,项目名称,星星数量,简介,中文简介,URL,编程语言,License,Forks,Open Issues,Topics,标星时间,最近更新
1,other/private-tool,42,Other user repo,其他用户仓库,https://github.com/other/private-tool,Go,MIT,2,0,"go, cli",2026-01-01,2026-06-01`
      importCsvRecords(db, parseCsv(otherCsv), 'other-user')

      const demoResult = queryRepos(db, { userLogin: DEMO_USER_LOGIN, limit: 20 })
      const otherResult = queryRepos(db, { userLogin: 'other-user', limit: 20 })

      expect(demoResult.total).toBe(5)
      expect(demoResult.items.some(r => r.repo.full_name === 'other/private-tool')).toBe(false)
      expect(otherResult.total).toBe(1)
      expect(otherResult.items[0].repo.full_name).toBe('other/private-tool')
    })

    it('按 pushed_at 排序', () => {
      const result = queryRepos(db, { sortBy: 'pushed_at', sortOrder: 'DESC' })
      for (let i = 1; i < result.items.length; i++) {
        expect(result.items[i - 1].repo.pushed_at! >= result.items[i].repo.pushed_at!).toBe(true)
      }
    })
  })

  describe('queryRepoByName', () => {
    beforeEach(() => {
      const records = parseCsv(MOCK_CSV)
      importCsvRecords(db, records)
    })

    it('应返回指定仓库详情', () => {
      const repo = queryRepoByName(db, 'torvalds/linux')
      expect(repo).not.toBeNull()
      expect(repo!.repo.stars).toBe(200000)
      expect(repo!.repo.language).toBe('C')
    })

    it('不存在的仓库应返回 null', () => {
      const repo = queryRepoByName(db, 'nonexistent/repo')
      expect(repo).toBeNull()
    })
  })

  // ===== 统计测试 =====

  describe('统计查询', () => {
    beforeEach(() => {
      const records = parseCsv(MOCK_CSV)
      importCsvRecords(db, records)
    })

    it('语言分布统计应正确', () => {
      const stats = queryLanguageStats(db)
      expect(stats.length).toBeGreaterThan(0)
      // JavaScript 出现 2 次 (Hello-World, react)
      const js = stats.find(s => s.language === 'JavaScript')
      expect(js?.count).toBe(2)
    })

    it('Topics 分布统计应正确', () => {
      const stats = queryTopicStats(db)
      expect(stats.length).toBeGreaterThan(0)
      // typescript 出现在 vscode 和 deno
      const ts = stats.find(s => s.topic === 'typescript')
      expect(ts?.count).toBe(2)
    })

    it('License 分布统计应正确', () => {
      const stats = queryLicenseStats(db)
      expect(stats.length).toBeGreaterThan(0)
      // 4 个 MIT (Hello-World, vscode, deno, react) + 1 个 GPL-2.0 (linux)
      const mit = stats.find(s => s.license === 'MIT')
      expect(mit?.count).toBe(4)
      const gpl = stats.find(s => s.license === 'GPL-2.0')
      expect(gpl?.count).toBe(1)
    })

    it('仓库总数应正确', () => {
      expect(queryRepoCount(db)).toBe(5)
    })
  })
})
