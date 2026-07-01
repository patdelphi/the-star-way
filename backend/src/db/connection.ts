/**
 * the-star-way 数据库连接与初始化
 * 负责创建数据库连接、启用 WAL 模式、执行建表
 */
import Database from 'better-sqlite3'
import { SCHEMA_SQL } from './schema.js'
import { mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

// 默认数据库路径
const DEFAULT_DB_DIR = join(process.cwd(), 'data')
const DEFAULT_DB_NAME = 'starway.db'

/**
 * 获取默认数据库完整路径
 */
export function getDefaultDbPath(): string {
  return join(DEFAULT_DB_DIR, DEFAULT_DB_NAME)
}

/**
 * 创建数据库连接，启用 WAL 模式
 * @param dbPath 数据库文件路径，默认 data/starway.db
 */
export function createConnection(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? getDefaultDbPath()

  // 确保目录存在
  const dir = dirname(resolvedPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const db = new Database(resolvedPath)

  // 必须启用 WAL 模式，减少 IO 开销
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')

  return db
}

/**
 * 初始化数据库：执行建表语句
 * @param db 数据库连接实例
 */
export function initDatabase(db: Database.Database): void {
  db.exec(SCHEMA_SQL)
}

/**
 * 事务封装：在事务中执行回调函数
 * better-sqlite3 的 transaction() 不传 db 参数给回调，需要通过闭包访问
 * @param db 数据库连接实例
 * @param fn 事务内要执行的函数，通过闭包访问 db
 */
export function withTransaction<T>(db: Database.Database, fn: () => T): T {
  return db.transaction(fn)()
}

export type { Database }
