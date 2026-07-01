/**
 * 导出模块测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createConnection, initDatabase } from '../../db/connection.js'
import { parseCsv, importCsvRecords, DEMO_USER_LOGIN } from '../../import/csv-importer.js'
import { exportCsv, exportJson, exportMarkdown } from '../exporter.js'
import type Database from 'better-sqlite3'
import { rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const TEST_DB_DIR = join(tmpdir(), 'starway-test-export-' + process.pid)
function getTestDbPath() { return join(TEST_DB_DIR, 'test.db') }
function cleanup() { if (existsSync(TEST_DB_DIR)) rmSync(TEST_DB_DIR, { recursive: true, force: true }) }

const MOCK_CSV = `序号,项目名称,星星数量,简介,中文简介,URL,编程语言,License,Forks,Open Issues,Topics,标星时间,最近更新
1,octocat/Hello-World,100,A simple Hello World repo,简单的 Hello World 仓库,https://github.com/octocat/Hello-World,JavaScript,MIT,50,10,"hello, world, demo",2025-06-01,2026-01-15
2,torvalds/linux,200000,Linux kernel source tree,Linux 内核源码,https://github.com/torvalds/linux,C,GPL-2.0,50000,100,"kernel, linux, operating-system",2024-01-01,2026-06-30
3,microsoft/vscode,180000,Visual Studio Code,Visual Studio Code,https://github.com/microsoft/vscode,TypeScript,MIT,30000,200,"editor, vscode, typescript",2025-03-15,2026-06-28`

let db: Database.Database

describe('导出功能', () => {
  beforeEach(() => {
    cleanup()
    db = createConnection(getTestDbPath())
    initDatabase(db)
    const records = parseCsv(MOCK_CSV)
    importCsvRecords(db, records)
  })

  afterEach(() => {
    db.close()
    cleanup()
  })

  describe('exportCsv', () => {
    it('应导出 UTF-8 BOM 开头的 CSV', () => {
      const csv = exportCsv(db, DEMO_USER_LOGIN)
      expect(csv.charCodeAt(0)).toBe(0xFEFF) // BOM
    })

    it('应包含表头', () => {
      const csv = exportCsv(db, DEMO_USER_LOGIN)
      // 去掉 BOM 后检查
      const text = csv.replace(/^\uFEFF/, '')
      expect(text.startsWith('full_name,description')).toBe(true)
    })

    it('应包含所有仓库数据', () => {
      const csv = exportCsv(db, DEMO_USER_LOGIN)
      expect(csv).toContain('octocat/Hello-World')
      expect(csv).toContain('torvalds/linux')
      expect(csv).toContain('microsoft/vscode')
    })

    it('应使用 CRLF 换行', () => {
      const csv = exportCsv(db, DEMO_USER_LOGIN)
      expect(csv).toContain('\r\n')
    })

    it('筛选参数应生效', () => {
      const csv = exportCsv(db, DEMO_USER_LOGIN, { language: 'TypeScript' })
      expect(csv).toContain('microsoft/vscode')
      expect(csv).not.toContain('torvalds/linux')
    })
  })

  describe('exportJson', () => {
    it('应返回有效的 JSON', () => {
      const json = exportJson(db, DEMO_USER_LOGIN)
      const data = JSON.parse(json)
      expect(data.login).toBe(DEMO_USER_LOGIN)
      expect(data.total).toBe(3)
      expect(data.repos).toHaveLength(3)
      expect(data.exported_at).toBeTruthy()
    })

    it('应包含仓库详情', () => {
      const json = exportJson(db, DEMO_USER_LOGIN)
      const data = JSON.parse(json)
      const linux = data.repos.find((r: any) => r.full_name === 'torvalds/linux')
      expect(linux).toBeDefined()
      expect(linux.stars).toBe(200000)
      expect(linux.language).toBe('C')
    })

    it('筛选参数应生效', () => {
      const json = exportJson(db, DEMO_USER_LOGIN, { language: 'C' })
      const data = JSON.parse(json)
      expect(data.total).toBe(1)
      expect(data.repos[0].full_name).toBe('torvalds/linux')
    })

    it('应只导出指定用户的星标仓库', () => {
      const otherCsv = `序号,项目名称,星星数量,简介,中文简介,URL,编程语言,License,Forks,Open Issues,Topics,标星时间,最近更新
1,other/private-tool,42,Other user repo,其他用户仓库,https://github.com/other/private-tool,Go,MIT,2,0,"go, cli",2026-01-01,2026-06-01`
      importCsvRecords(db, parseCsv(otherCsv), 'other-user')

      const json = exportJson(db, DEMO_USER_LOGIN)
      const data = JSON.parse(json)
      expect(data.total).toBe(3)
      expect(data.repos.some((repo: any) => repo.full_name === 'other/private-tool')).toBe(false)
    })
  })

  describe('exportMarkdown', () => {
    it('应返回 Markdown 表格', () => {
      const md = exportMarkdown(db, DEMO_USER_LOGIN)
      expect(md).toContain('# ' + DEMO_USER_LOGIN)
      expect(md).toContain('| Repository | Language | Stars |')
      expect(md).toContain('torvalds/linux')
    })

    it('应使用 CRLF 换行', () => {
      const md = exportMarkdown(db, DEMO_USER_LOGIN)
      expect(md).toContain('\r\n')
    })

    it('应包含导出时间和总数', () => {
      const md = exportMarkdown(db, DEMO_USER_LOGIN)
      expect(md).toContain('Exported at')
      expect(md).toContain('Total: 3')
    })

    it('筛选参数应生效', () => {
      const md = exportMarkdown(db, DEMO_USER_LOGIN, { search: 'vscode' })
      expect(md).toContain('microsoft/vscode')
      expect(md).not.toContain('torvalds/linux')
    })
  })
})
