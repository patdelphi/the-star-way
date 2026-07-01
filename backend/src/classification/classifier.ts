/**
 * 规则分类模块
 * 基于 topic / name / description 对仓库进行标签分类
 * 保存 tag_source 和 confidence 到 repo_tags 表
 */
import type Database from 'better-sqlite3'
import { withTransaction } from '../db/connection.js'
import {
  TOPIC_TAG_RULES,
  NAME_TAG_RULES,
  DESC_TAG_RULES,
  type TagRule,
} from './tag-dictionary.js'

// 分类结果
export interface ClassificationResult {
  repoCount: number
  tagsCreated: number
}

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

/**
 * 对单个仓库进行分类
 */
export function classifyRepo(
  name: string,
  description: string | null,
  topicsJson: string | null,
): { tag: string; source: string; confidence: number }[] {
  const results: { tag: string; source: string; confidence: number }[] = []
  const seenTags = new Set<string>()

  // 解析 topics
  const topics: string[] = topicsJson ? safeJsonParse(topicsJson) : []
  const descLower = (description ?? '').toLowerCase()
  const nameLower = name.toLowerCase()

  // 1. Topic 精确匹配（置信度 0.95）
  for (const rule of TOPIC_TAG_RULES) {
    const matchMode = rule.matchMode ?? 'exact'
    if (matchMode === 'exact') {
      const matched = topics.some(t => rule.keywords.includes(t.toLowerCase()))
      if (matched && !seenTags.has(rule.label)) {
        results.push({ tag: rule.label, source: 'topic', confidence: 0.95 })
        seenTags.add(rule.label)
      }
    } else {
      const matched = topics.some(t =>
        rule.keywords.some(kw => t.toLowerCase().includes(kw))
      )
      if (matched && !seenTags.has(rule.label)) {
        results.push({ tag: rule.label, source: 'topic', confidence: 0.95 })
        seenTags.add(rule.label)
      }
    }
  }

  // 2. 仓库名称匹配（置信度 0.85）
  for (const rule of NAME_TAG_RULES) {
    const matched = rule.keywords.some(kw => nameLower.includes(kw.toLowerCase()))
    if (matched && !seenTags.has(rule.label)) {
      results.push({ tag: rule.label, source: 'name', confidence: 0.85 })
      seenTags.add(rule.label)
    }
  }

  // 3. 描述匹配（置信度 0.80）
  for (const rule of DESC_TAG_RULES) {
    const matched = rule.keywords.some(kw => descLower.includes(kw.toLowerCase()))
    if (matched && !seenTags.has(rule.label)) {
      results.push({ tag: rule.label, source: 'description', confidence: 0.80 })
      seenTags.add(rule.label)
    }
  }

  return results
}

/**
 * 安全解析 JSON，失败返回 null
 */
function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
