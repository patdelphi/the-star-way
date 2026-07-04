/**
 * 缓存相关 API 契约类型
 * 跨 Node 后端和 Cloudflare Worker 共用
 */

// 翻译/摘要缓存行（数据库 translations 表）
export interface TranslationRow {
  repo_full_name: string
  target_lang: string
  translated_description: string | null
  translated_readme_summary: string | null
  provider: string | null
  updated_at: string
}

// 分析报告行（数据库 analysis_reports 表）
export interface AnalysisReportRow {
  user_login: string
  report_type: string
  lang: string
  content_json: string
  created_at: string
}
