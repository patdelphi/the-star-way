/**
 * 规则分类模块（backend 本地版）
 * - 纯函数 classifyRepo 从 shared/classification 引入
 * - 数据库批量分类 classifyAllRepos / classifyReposForUser 保留在 backend 本地
 */
import type Database from 'better-sqlite3'
import { withTransaction } from '../db/connection.js'
// 纯函数从 shared 引用，与 Cloudflare Worker 共用同一份逻辑
import { classifyRepo as classifyRepoImpl } from '@shared/classification/classifier.js'

// 分类结果
export interface ClassificationResult {
  repoCount: number
  tagsCreated: number
}

// re-export 纯函数和类型，保持向后兼容
export const classifyRepo = classifyRepoImpl
export type { ClassifyTagResult } from '@shared/classification/classifier.js'

/**
 * 对所有仓库执行规则分类
 * @param db 数据库连接
 * @returns 分类结果统计
 */
export function classifyAllRepos(db: Database.Database): ClassificationResult {
  return classifyReposForUser(db)
}

/**
 * 对指定用户的星标仓库执行规则分类
 * @param db 数据库连接
 * @param userLogin 用户登录名，不传则处理全部仓库
 * @returns 分类结果统计
 */
export function classifyReposForUser(db: Database.Database, userLogin?: string): ClassificationResult {
  // 构建查询：如果指定了用户，只查该用户星标的仓库
  let sql = `
    SELECT full_name, name, topics_json, description
    FROM repos
  `
  if (userLogin) {
    sql = `
      SELECT r.full_name, r.name, r.topics_json, r.description
      FROM repos r
      JOIN stars s ON r.full_name = s.repo_full_name
      WHERE s.user_login = ?
    `
  }

  const repos = db.prepare(sql).all(...(userLogin ? [userLogin] : [])) as {
    full_name: string
    name: string
    topics_json: string | null
    description: string | null
  }[]

  let tagsCreated = 0

  withTransaction(db, () => {
    if (userLogin) {
      // 只清除该用户星标仓库上的旧规则标签
      db.prepare(`
        DELETE FROM repo_tags
        WHERE tag_source != 'manual'
          AND repo_full_name IN (SELECT repo_full_name FROM stars WHERE user_login = ?)
      `).run(userLogin)
    } else {
      // 清除全部旧规则标签
      db.prepare(`DELETE FROM repo_tags WHERE tag_source != 'manual'`).run()
    }

    // 准备插入语句
    const insertTag = db.prepare(`
      INSERT OR IGNORE INTO repo_tags (repo_full_name, tag, tag_source, confidence)
      VALUES (?, ?, ?, ?)
    `)

    for (const repo of repos) {
      const tags = classifyRepo(
        repo.name,
        repo.description,
        repo.topics_json,
      )

      for (const { tag, source, confidence } of tags) {
        insertTag.run(repo.full_name, tag, source, confidence)
        tagsCreated++
      }
    }
  })

  return { repoCount: repos.length, tagsCreated }
}
