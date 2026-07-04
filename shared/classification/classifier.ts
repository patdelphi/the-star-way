/**
 * 规则分类纯函数模块（运行时无关）
 * 基于 topic / name / description 对仓库进行标签分类
 * 数据库相关的批量分类逻辑保留在 backend 本地
 */
import {
  TOPIC_TAG_RULES,
  NAME_TAG_RULES,
  DESC_TAG_RULES,
} from './tag-dictionary.js'

// 分类结果项
export interface ClassifyTagResult {
  tag: string
  source: string
  confidence: number
}

/**
 * 对单个仓库进行分类（纯函数，不依赖数据库）
 * @param name 仓库名称
 * @param description 仓库描述
 * @param topicsJson topics JSON 字符串
 * @returns 分类标签列表
 */
export function classifyRepo(
  name: string,
  description: string | null,
  topicsJson: string | null,
): ClassifyTagResult[] {
  const results: ClassifyTagResult[] = []
  const seenTags = new Set<string>()

  // 解析 topics（解析失败时返回空数组，避免后续 .some() 报错）
  const parsed = topicsJson ? safeJsonParse(topicsJson) : null
  const topics: string[] = Array.isArray(parsed) ? parsed : []
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
