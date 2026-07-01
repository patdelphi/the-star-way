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
  // 获取所有仓库的 full_name、topics_json、name、description
  const repos = db.prepare(`
    SELECT full_name, name, topics_json, description
    FROM repos
  `).all() as { full_name: string; name: string; topics_json: string | null; description: string | null }[]

  let tagsCreated = 0

  withTransaction(db, () => {
    // 清除旧的规则标签（保留手动标签 tag_source='manual'）
    const deleteOld = db.prepare(`DELETE FROM repo_tags WHERE tag_source != 'manual'`)
    deleteOld.run()

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
