/**
 * the-star-way 数据库模块统一导出
 */
export { createConnection, initDatabase, withTransaction, getDefaultDbPath } from './connection.js'
export { SCHEMA_SQL } from './schema.js'
export type { Database } from './connection.js'
export type * from './types.js'
