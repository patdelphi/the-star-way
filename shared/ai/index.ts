/**
 * 用户级 AI 共享逻辑
 * 存放运行时无关的 prompt 构造、缓存 key 和常量，避免本地后端与 Worker 漂移。
 */

export const USER_AI_CACHE_KEYS = ['dna-zh', 'dna-en', 'learning-zh', 'learning-en'] as const

export type UserAiCacheKey = typeof USER_AI_CACHE_KEYS[number]

export interface UserAiRepoStats {
  repoCount: number
  activeRepoCount?: number
  languages: { language: string; count: number }[]
  tags: { tag: string; count: number }[]
  topRepos?: { full_name: string; description: string; stars: number }[]
}

export function getUserAiCacheKey(login: string): string {
  return `user:${login}`
}

export function isUserAiCacheKey(value: string): value is UserAiCacheKey {
  return (USER_AI_CACHE_KEYS as readonly string[]).includes(value)
}

export function buildStarDnaPrompt(login: string, stats: UserAiRepoStats): string {
  const topLangs = stats.languages.slice(0, 5).map((l) => `${l.language}(${l.count})`).join(', ')
  const topTags = stats.tags.slice(0, 8).map((t) => `${t.tag}(${t.count})`).join(', ')
  const topRepoNames = (stats.topRepos || [])
    .slice(0, 5)
    .map((r) => `- ${r.full_name}: ${r.description || ''}`)
    .join('\n')

  return `基于以下 GitHub 用户已同步的 starred repositories 数据，生成一段中文开发者技术画像（100-150 字）。
要有洞察力，分析用户的技术偏好、关注方向和可能的职业背景，不要只罗列数据。
注意：这里的数量是该用户 star 过并已同步的仓库数，不是该用户自己创建的 public repositories 数。

用户：${login}
已同步 starred repositories 数：${stats.repoCount}
活跃仓库数：${stats.activeRepoCount ?? 0}
主要关注语言：${topLangs || '无'}
主要关注标签：${topTags || '无'}
代表性星标项目：
${topRepoNames || '无'}

请直接输出画像描述，不要加任何前缀或格式标记。`
}

export function buildLearningPathPrompt(login: string, stats: UserAiRepoStats): string {
  const topLangs = stats.languages.slice(0, 5).map((l) => `${l.language}`).join(', ')
  const topTags = stats.tags.slice(0, 10).map((t) => `${t.tag}`).join(', ')
  const topRepoNames = (stats.topRepos || [])
    .slice(0, 8)
    .map((r) => `- ${r.full_name}: ${r.description || ''}`)
    .join('\n')

  return `基于以下 GitHub 用户已同步的 starred repositories 数据，为其生成一份个性化的技术学习路径推荐。
请结合用户已星标的具体项目给出针对性建议，引用实际仓库名。
注意：这里的数量是该用户 star 过并已同步的仓库数，不是该用户自己创建的 public repositories 数。

用户：${login}
已同步 starred repositories 数：${stats.repoCount}
主要关注语言：${topLangs || '无'}
主要关注标签：${topTags || '无'}
代表性星标项目：
${topRepoNames || '无'}

请按以下 Markdown 格式输出（不要加任何额外说明）：

## 阶段一：巩固基础
- 建议学习的核心概念
- 推荐从已星标的项目中选择入门项目

## 阶段二：深入实践
- 建议深入的技术方向
- 推荐从已星标的项目中选择进阶项目

## 阶段三：拓展前沿
- 建议关注的新兴领域
- 与已星标项目相关的延伸方向

## 学习建议
- 2-3 条具体可行的学习建议
`
}
