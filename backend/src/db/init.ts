/**
 * 数据库初始化入口脚本
 * 用法：pnpm db:init
 */
import { createConnection, initDatabase } from './connection.js'

const db = createConnection()
initDatabase(db)
console.log('数据库初始化完成：', process.cwd(), '\\data\\starway.db')
db.close()
