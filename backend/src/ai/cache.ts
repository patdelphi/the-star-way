/**
 * AI 结果缓存模块
 * 将 AI 翻译和分析结果缓存到 translations 和 analysis_reports 表
 * 仅框架定义，不实现具体 AI 调用
 */
import type Database from 'better-sqlite3'

/**
 * 写入翻译缓存
 * @param db 数据库连接
 * @param repoFullName 仓库全名
 * @param targetLang 目标语言
 * @param translatedDescription 翻译后的描述
 * @param translatedReadmeSummary 翻译后的 README 摘要
 * @param provider AI 提供商名称
 */
export function cacheTranslation(
  db: Database.Database,
  repoFullName: string,
  targetLang: string,
  translatedDescription: string | null,
  translatedReadmeSummary: string | null,
  provider: string,
): void {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO translations (repo_full_name, target_lang, translated_description, translated_readme_summary, provider, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(repo_full_name, target_lang) DO UPDATE SET
      translated_description = excluded.translated_description,
      translated_readme_summary = excluded.translated_readme_summary,
      provider = excluded.provider,
      updated_at = excluded.updated_at
  `).run(repoFullName, targetLang, translatedDescription, translatedReadmeSummary, provider, now)
}

/**
 * 读取翻译缓存
 * @returns 缓存的翻译记录，无缓存返回 null
 */
export function getCachedTranslation(
  db: Database.Database,
  repoFullName: string,
  targetLang: string,
): { translated_description: string | null; translated_readme_summary: string | null; provider: string | null; updated_at: string } | null {
  return db.prepare(`
    SELECT translated_description, translated_readme_summary, provider, updated_at
    FROM translations
    WHERE repo_full_name = ? AND target_lang = ?
  `).get(repoFullName, targetLang) as any || null
}

/**
 * 写入分析报告缓存
 * @param db 数据库连接
 * @param userLogin 用户名
 * @param reportType 报告类型
 * @param lang 语言
 * @param contentJson 报告内容（JSON 字符串）
 */
export function cacheAnalysisReport(
  db: Database.Database,
  userLogin: string,
  reportType: string,
  lang: string,
  contentJson: string,
): void {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO analysis_reports (user_login, report_type, lang, content_json, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_login, report_type, lang) DO UPDATE SET
      content_json = excluded.content_json,
      created_at = excluded.created_at
  `).run(userLogin, reportType, lang, contentJson, now)
}

/**
 * 读取分析报告缓存
 */
export function getCachedAnalysisReport(
  db: Database.Database,
  userLogin: string,
  reportType: string,
  lang: string = 'en',
): { content_json: string; created_at: string } | null {
  return db.prepare(`
    SELECT content_json, created_at
    FROM analysis_reports
    WHERE user_login = ? AND report_type = ? AND lang = ?
  `).get(userLogin, reportType, lang) as any || null
}
