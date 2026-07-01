/**
 * 数据库初始化与事务封装测试
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { createConnection, initDatabase, withTransaction, getDefaultDbPath } from '../connection.js'
import type Database from 'better-sqlite3'
import { unlinkSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// 临时数据库路径，避免污染项目数据
const TEST_DB_DIR = join(tmpdir(), 'starway-test-' + process.pid)

function getTestDbPath(): string {
  return join(TEST_DB_DIR, 'test.db')
}

function cleanupTestDb(): void {
  if (existsSync(TEST_DB_DIR)) {
    rmSync(TEST_DB_DIR, { recursive: true, force: true })
  }
}

describe('数据库初始化', () => {
  let db: Database.Database

  beforeEach(() => {
    cleanupTestDb()
    db = createConnection(getTestDbPath())
  })

  afterEach(() => {
    db.close()
    cleanupTestDb()
  })

  it('应正确创建数据库文件', () => {
    expect(existsSync(getTestDbPath())).toBe(true)
  })

  it('应启用 WAL 模式', () => {
    const result = db.pragma('journal_mode') as { journal_mode: string }[]
    expect(result[0].journal_mode).toBe('wal')
  })

  it('应启用 synchronous=NORMAL', () => {
    const result = db.pragma('synchronous') as { synchronous: number }[]
    expect(result[0].synchronous).toBe(1) // NORMAL = 1
  })

  it('initDatabase 应创建所有核心表', () => {
    initDatabase(db)

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[]

    const tableNames = tables.map(t => t.name)
    expect(tableNames).toContain('users')
    expect(tableNames).toContain('repos')
    expect(tableNames).toContain('stars')
    expect(tableNames).toContain('repo_tags')
    expect(tableNames).toContain('translations')
    expect(tableNames).toContain('analysis_reports')
  })

  it('initDatabase 应创建索引', () => {
    initDatabase(db)

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name")
      .all() as { name: string }[]

    const indexNames = indexes.map(i => i.name)
    expect(indexNames).toContain('idx_repos_language')
    expect(indexNames).toContain('idx_repos_stars')
    expect(indexNames).toContain('idx_stars_user_login')
    expect(indexNames).toContain('idx_repo_tags_tag')
  })

  it('重复调用 initDatabase 不应报错', () => {
    initDatabase(db)
    initDatabase(db) // 再次调用
    // 不抛异常即通过
  })
})

describe('事务封装', () => {
  let db: Database.Database

  beforeEach(() => {
    cleanupTestDb()
    db = createConnection(getTestDbPath())
    initDatabase(db)
  })

  // 每个测试前清理所有表数据
  afterEach(() => {
    withTransaction(db, () => {
      db.exec('DELETE FROM stars')
      db.exec('DELETE FROM repo_tags')
      db.exec('DELETE FROM translations')
      db.exec('DELETE FROM analysis_reports')
      db.exec('DELETE FROM repos')
      db.exec('DELETE FROM users')
    })
    db.close()
    cleanupTestDb()
  })

  it('withTransaction 成功时提交数据', () => {
    withTransaction(db, () => {
      db.prepare('INSERT INTO users (login, avatar_url, synced_at) VALUES (?, ?, ?)').run(
        'testuser', 'https://example.com/avatar.png', '2026-01-01T00:00:00Z'
      )
    })

    const user = db.prepare('SELECT * FROM users WHERE login = ?').get('testuser')
    expect(user).toBeDefined()
    expect((user as any).login).toBe('testuser')
  })

  it('withTransaction 抛异常时回滚数据', () => {
    expect(() => {
      withTransaction(db, () => {
        db.prepare('INSERT INTO users (login, avatar_url, synced_at) VALUES (?, ?, ?)').run(
          'rollback-user', null, null
        )
        throw new Error('模拟异常')
      })
    }).toThrow('模拟异常')

    const user = db.prepare('SELECT * FROM users WHERE login = ?').get('rollback-user')
    expect(user).toBeUndefined()
  })

  it('withTransaction 应支持返回值', () => {
    const result = withTransaction(db, () => {
      db.prepare('INSERT INTO users (login, avatar_url, synced_at) VALUES (?, ?, ?)').run(
        'return-user', null, null
      )
      return db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }
    })

    expect(result.cnt).toBe(1)
  })

  it('批量写入应在事务中高效执行', () => {
    const insertMany = db.prepare('INSERT INTO users (login, avatar_url, synced_at) VALUES (?, ?, ?)')

    withTransaction(db, () => {
      for (let i = 0; i < 100; i++) {
        insertMany.run(`user-${i}`, null, null)
      }
    })

    const { total } = db.prepare('SELECT COUNT(*) as total FROM users').get() as { total: number }
    expect(total).toBe(100)
  })
})

describe('默认路径', () => {
  it('getDefaultDbPath 应返回 data/starway.db', () => {
    const path = getDefaultDbPath()
    expect(path).toContain('data')
    expect(path).toContain('starway.db')
  })
})
