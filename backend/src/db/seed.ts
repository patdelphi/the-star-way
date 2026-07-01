/**
 * 种子数据导入脚本
 * 用法：pnpm db:seed
 * 将内置 CSV 导入到 SQLite 数据库，并自动执行规则分类
 */
import { createConnection, initDatabase } from '../db/connection.js'
import { importFromCsvFile } from '../import/csv-importer.js'
import { classifyAllRepos } from '../classification/classifier.js'
import { join } from 'node:path'

// 支持通过环境变量覆盖默认值
const CSV_PATH = process.env.SEED_CSV_PATH || join(import.meta.dirname, '..', '..', '..', 'Docs', 'github_starred_projects_691_COMPLETE.csv')
const DEMO_LOGIN = process.env.SEED_DEMO_LOGIN || 'patdelphi'

async function main() {
  console.log('初始化数据库...')
  const db = createConnection()
  initDatabase(db)

  console.log('导入种子数据：', CSV_PATH)
  const count = await importFromCsvFile(db, CSV_PATH, DEMO_LOGIN)
  console.log(`导入完成：${count} 条仓库数据`)

  console.log('执行规则分类...')
  const result = classifyAllRepos(db)
  console.log(`分类完成：${result.tagsCreated} 个标签（${result.repoCount} 个仓库）`)

  db.close()
}

main().catch(err => {
  console.error('种子数据导入失败：', err)
  process.exit(1)
})
