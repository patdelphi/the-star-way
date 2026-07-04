/**
 * the-star-way 数据库类型定义
 * 类型已迁移到 shared/api-contracts，这里 re-export 保持向后兼容
 * 现有 backend 代码 import 路径无需改动
 */
export type {
  UserRow,
  RepoRow,
  StarRow,
  RepoTagRow,
  TranslationRow,
  AnalysisReportRow,
  RepoQueryParams,
  StarStatsParams,
  RepoWithStar,
  LanguageStat,
  TopicStat,
  LicenseStat,
} from '@shared/api-contracts/index.js'
