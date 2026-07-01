/**
 * 种子数据导入脚本
 * 用法：pnpm db:seed
 * 将内置 CSV 导入到 SQLite 数据库
 */
import { createConnection, initDatabase } from '../db/connection.js'
import { importFromCsvFile } from '../import/csv-importer.js'
import { join } from 'node:path'

const CSV_PATH = join(import.meta.dirname, '..', '..', '..', 'Docs', 'github_starred_projects_691_COMPLETE.csv')

async function main() {
  console.log('初始化数据库...')
  const db = createConnection()
  initDatabase(db)

  console.log('导入种子数据：', CSV_PATH)
  const count = await importFromCsvFile(db, CSV_PATH)
  console.log(`导入完成：${count} 条仓库数据`)

  db.close()
}

main().catch(err => {
  console.error('种子数据导入失败：', err)
  process.exit(1)
})
