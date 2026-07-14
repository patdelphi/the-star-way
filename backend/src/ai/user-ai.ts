/**
 * 用户级 AI 内容服务
 * 统一处理 Star DNA 与学习路径的缓存读取、数据准备、生成、翻译和事务写入。
 */
import type Database from 'better-sqlite3'
import { getUserAiCacheKey } from '@shared/ai/index.js'
import {
  canGenerateUserAiFromSyncStatus,
  getIncompleteSyncMessage,
  type SyncStatus,
} from '@shared/sync/index.js'
import { queryActiveRepoCount } from '../repository/repo-queries.js'
import { generateLearningPath, generateStarDna, translateToEnglish } from './client.js'

export type UserAiContentKind = 'star-dna' | 'learning-path'
export type UserAiLang = 'zh' | 'en'

export interface UserAiContentResult {
  content: string
  cached: boolean
}

export class UserAiContentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'UserAiContentError'
  }
}

interface UserAiKindConfig {
  zhKey: string
  enKey: string
  tagLimit: number
  repoLimit: number
}

const KIND_CONFIG: Record<UserAiContentKind, UserAiKindConfig> = {
  'star-dna': {
    zhKey: 'dna-zh',
    enKey: 'dna-en',
    tagLimit: 8,
    repoLimit: 5,
  },
  'learning-path': {
    zhKey: 'learning-zh',
    enKey: 'learning-en',
    tagLimit: 10,
    repoLimit: 8,
  },
}

/** 校验用户存在，避免为不存在的 login 生成 AI 内容。 */
function ensureUserExists(db: Database.Database, login: string): boolean {
  return !!db.prepare('SELECT login FROM users WHERE login = ? AND deleted_at IS NULL').get(login)
}

/** 读取用户级 AI 文本缓存。 */
function getUserAiTextCache(db: Database.Database, login: string, key: string): string | null {
  const cached = db.prepare(`
    SELECT translated_readme_summary
    FROM translations
    WHERE repo_full_name = ? AND target_lang = ?
  `).get(getUserAiCacheKey(login), key) as { translated_readme_summary: string } | undefined
  return cached?.translated_readme_summary || null
}

/** 写入用户级 AI 文本缓存，保证同一次生成的中英文结果原子落库。 */
function cacheUserAiText(
  db: Database.Database,
  login: string,
  values: Array<{ key: string; text: string }>,
  provider = 'ai',
): void {
  const now = new Date().toISOString()
  const save = db.transaction(() => {
    const stmt = db.prepare(`
      INSERT INTO translations (repo_full_name, target_lang, translated_readme_summary, provider, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(repo_full_name, target_lang) DO UPDATE SET
        translated_readme_summary = excluded.translated_readme_summary,
        provider = excluded.provider,
        updated_at = excluded.updated_at
    `)

    for (const item of values) {
      if (item.text.trim()) {
        stmt.run(getUserAiCacheKey(login), item.key, item.text, provider, now)
      }
    }
  })

  save()
}

/** 将统计数组格式化成稳定可读的中文短语。 */
function formatCountList(items: Array<{ language?: string | null; tag?: string | null; count: number }>, emptyText: string): string {
  const text = items
    .map((item) => `${item.language || item.tag || '未知'} ${item.count}`)
    .join('、')
  return text || emptyText
}

/** AI 不可用时基于已同步统计生成本地兜底内容，避免页面空白或卡死。 */
function buildLocalFallbackContent(
  login: string,
  kind: UserAiContentKind,
  lang: UserAiLang,
  stats: ReturnType<typeof collectUserAiStats>,
): string {
  const languagesZh = formatCountList(stats.languages, '暂无语言分布')
  const tagsZh = formatCountList(stats.tags, '暂无标签分布')
  const reposZh = stats.topRepos.map((repo) => repo.full_name).join('、') || '暂无代表项目'

  if (kind === 'star-dna') {
    if (lang === 'en') {
      return `${login} has synced ${stats.repoCount} starred repositories. The current local profile is based on language distribution (${languagesZh}), topic signals (${tagsZh}), and representative projects (${reposZh}). AI generation is unavailable, so this profile uses deterministic local statistics.`
    }
    return `${login} 已同步 ${stats.repoCount} 个星标仓库。当前技术画像基于语言分布（${languagesZh}）、兴趣标签（${tagsZh}）和代表项目（${reposZh}）生成。AI 服务暂不可用时，本地会先给出这份稳定画像，后续可重新生成获取更深入分析。`
  }

  if (lang === 'en') {
    return `## Stage 1: Consolidate fundamentals
- Start from the dominant languages and topics: ${languagesZh}; ${tagsZh}.
- Review representative starred projects: ${reposZh}.

## Stage 2: Practice deeply
- Pick one active project and reproduce its core workflow.
- Turn recurring patterns from the starred list into a small local project.

## Stage 3: Expand frontier areas
- Track adjacent topics from the tag distribution and compare them with current project choices.

## Learning advice
- This path is generated from local synced statistics because AI generation is currently unavailable.`
  }

  return `## 阶段一：巩固基础
- 围绕主要语言和标签补齐基础：${languagesZh}；${tagsZh}。
- 优先阅读已星标的代表项目：${reposZh}。

## 阶段二：深入实践
- 选择一个代表项目复现核心流程，把兴趣标签转化成可运行的小项目。
- 对高频技术方向做源码阅读、笔记和最小可用实现。

## 阶段三：拓展前沿
- 从标签分布中挑选相邻方向，观察它们和当前星标项目的连接点。

## 学习建议
- 当前路径由本地已同步统计生成；AI 服务恢复后可重新生成更深入版本。`
}

/** 读取最新同步状态，用于阻止基于不完整数据生成 AI 缓存。 */
function getLatestSyncStatus(db: Database.Database, login: string): { status: SyncStatus; error_message: string | null } | null {
  const row = db.prepare(`
    SELECT status, error_message
    FROM sync_runs
    WHERE user_login = ?
    ORDER BY started_at DESC, id DESC
    LIMIT 1
  `).get(login) as { status: SyncStatus; error_message: string | null } | undefined
  return row ?? null
}

/** AI 画像/学习路径依赖完整星标数据。 */
function assertUserAiDataReady(db: Database.Database, login: string): void {
  const latestRun = getLatestSyncStatus(db, login)
  if (!latestRun || canGenerateUserAiFromSyncStatus(latestRun.status)) return
  throw new UserAiContentError(
    'SYNC_INCOMPLETE',
    getIncompleteSyncMessage(login, latestRun.status, latestRun.error_message),
    409,
  )
}

/** 获取用户星标数量，用于 AI 内容生成前的空数据保护。 */
function getUserStarCount(db: Database.Database, login: string): number {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM stars WHERE user_login = ? AND removed_at IS NULL').get(login) as { cnt: number }
  return row.cnt
}

/** 收集生成用户级 AI 内容所需的统计数据。 */
function collectUserAiStats(db: Database.Database, login: string, kind: UserAiContentKind) {
  const config = KIND_CONFIG[kind]
  const repoCount = getUserStarCount(db, login)
  const languages = db.prepare(`
    SELECT language, COUNT(*) as count FROM repos
    WHERE full_name IN (
      SELECT repo_full_name FROM stars WHERE user_login = ? AND removed_at IS NULL
    )
    GROUP BY language ORDER BY count DESC LIMIT 5
  `).all(login) as { language: string; count: number }[]

  const tags = db.prepare(`
    SELECT tag, COUNT(*) as count FROM repo_tags
    WHERE repo_full_name IN (
      SELECT repo_full_name FROM stars WHERE user_login = ? AND removed_at IS NULL
    )
    GROUP BY tag ORDER BY count DESC LIMIT ?
  `).all(login, config.tagLimit) as { tag: string; count: number }[]

  const topRepos = db.prepare(`
    SELECT r.full_name, r.description, r.stars
    FROM repos r JOIN stars s ON r.full_name = s.repo_full_name
    WHERE s.user_login = ? AND s.removed_at IS NULL AND r.description IS NOT NULL
    ORDER BY r.stars DESC LIMIT ?
  `).all(login, config.repoLimit) as { full_name: string; description: string; stars: number }[]

  return {
    repoCount,
    activeRepoCount: kind === 'star-dna' ? queryActiveRepoCount(db, login) : undefined,
    languages,
    tags,
    topRepos,
  }
}

/** 生成中文内容，两个入口共享同一套数据准备逻辑。 */
async function generateZhContent(
  login: string,
  kind: UserAiContentKind,
  stats: ReturnType<typeof collectUserAiStats>,
): Promise<string> {
  if (kind === 'star-dna') {
    return generateStarDna(login, {
      repoCount: stats.repoCount,
      activeRepoCount: stats.activeRepoCount ?? 0,
      languages: stats.languages,
      tags: stats.tags,
      topRepos: stats.topRepos,
    })
  }

  return generateLearningPath(login, {
    repoCount: stats.repoCount,
    languages: stats.languages,
    tags: stats.tags,
    topRepos: stats.topRepos,
  })
}

/**
 * 获取用户级 AI 内容。
 * 非强制请求优先读目标语言缓存；英文缺缓存时翻译中文缓存；强制请求重新生成中文并按需翻译英文。
 */
export async function getUserAiContent(
  db: Database.Database,
  login: string,
  kind: UserAiContentKind,
  lang: UserAiLang,
  force: boolean,
): Promise<UserAiContentResult> {
  const config = KIND_CONFIG[kind]
  const targetKey = lang === 'en' ? config.enKey : config.zhKey
  const cachedTarget = getUserAiTextCache(db, login, targetKey)

  if (!ensureUserExists(db, login)) {
    throw new UserAiContentError('USER_NOT_FOUND', `用户 ${login} 不存在`, 404)
  }

  if (!force && cachedTarget) {
    return { content: cachedTarget, cached: true }
  }

  if (!force && lang === 'en') {
    const cachedZh = getUserAiTextCache(db, login, config.zhKey)
    if (cachedZh) {
      try {
        const translated = await translateToEnglish(cachedZh)
        cacheUserAiText(db, login, [{ key: config.enKey, text: translated }])
        return { content: translated || cachedZh, cached: false }
      } catch {
        return { content: cachedZh, cached: true }
      }
    }
  }

  assertUserAiDataReady(db, login)

  const stats = collectUserAiStats(db, login, kind)
  if (stats.repoCount === 0) {
    throw new UserAiContentError('EMPTY_STAR_DATA', `用户 ${login} 暂无星标数据，请先同步星标`, 400)
  }

  try {
    const zhText = await generateZhContent(login, kind, stats)
    let enText = ''
    if (lang === 'en') {
      try {
        enText = await translateToEnglish(zhText)
      } catch { /* 翻译失败不阻塞中文生成 */ }
    }

    cacheUserAiText(db, login, [
      { key: config.zhKey, text: zhText },
      { key: config.enKey, text: enText },
    ])
    return { content: lang === 'en' ? (enText || zhText) : zhText, cached: false }
  } catch (err: any) {
    if (cachedTarget) {
      return { content: cachedTarget, cached: true }
    }
    const fallback = buildLocalFallbackContent(login, kind, lang, stats)
    cacheUserAiText(db, login, [{ key: targetKey, text: fallback }], 'local')
    return { content: fallback, cached: false }
  }
}
