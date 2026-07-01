/**
 * the-star-way 数据库 Schema 定义
 * 所有 CREATE TABLE 语句集中管理
 */

// 5 张核心表的建表语句
export const SCHEMA_SQL = `
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  login         TEXT PRIMARY KEY,
  avatar_url    TEXT,
  profile_url   TEXT,
  synced_at     TEXT
);

-- 仓库表
CREATE TABLE IF NOT EXISTS repos (
  github_id    INTEGER PRIMARY KEY,
  full_name    TEXT NOT NULL UNIQUE,
  owner        TEXT NOT NULL,
  name         TEXT NOT NULL,
  html_url     TEXT NOT NULL,
  description  TEXT,
  language     TEXT,
  license      TEXT,
  stars        INTEGER NOT NULL DEFAULT 0,
  forks        INTEGER NOT NULL DEFAULT 0,
  open_issues  INTEGER NOT NULL DEFAULT 0,
  topics_json  TEXT,
  created_at   TEXT,
  updated_at   TEXT,
  pushed_at    TEXT,
  archived     INTEGER NOT NULL DEFAULT 0,
  fork         INTEGER NOT NULL DEFAULT 0,
  homepage     TEXT
);

-- 星标表
CREATE TABLE IF NOT EXISTS stars (
  user_login      TEXT NOT NULL,
  repo_full_name  TEXT NOT NULL,
  starred_at      TEXT,
  first_seen_at   TEXT NOT NULL,
  last_seen_at    TEXT NOT NULL,
  removed_at      TEXT,
  PRIMARY KEY (user_login, repo_full_name),
  FOREIGN KEY (user_login)    REFERENCES users(login),
  FOREIGN KEY (repo_full_name) REFERENCES repos(full_name)
);

-- 仓库标签表
CREATE TABLE IF NOT EXISTS repo_tags (
  repo_full_name  TEXT NOT NULL,
  tag             TEXT NOT NULL,
  tag_source      TEXT NOT NULL,
  confidence      REAL NOT NULL DEFAULT 0.0,
  PRIMARY KEY (repo_full_name, tag),
  FOREIGN KEY (repo_full_name) REFERENCES repos(full_name)
);

-- 翻译缓存表（Phase 7 使用，预先创建）
CREATE TABLE IF NOT EXISTS translations (
  repo_full_name           TEXT NOT NULL,
  target_lang             TEXT NOT NULL,
  translated_description  TEXT,
  translated_readme_summary TEXT,
  provider                TEXT,
  updated_at              TEXT NOT NULL,
  PRIMARY KEY (repo_full_name, target_lang),
  FOREIGN KEY (repo_full_name) REFERENCES repos(full_name)
);

-- 分析报告表
CREATE TABLE IF NOT EXISTS analysis_reports (
  user_login    TEXT NOT NULL,
  report_type   TEXT NOT NULL,
  lang          TEXT NOT NULL DEFAULT 'en',
  content_json  TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  PRIMARY KEY (user_login, report_type, lang),
  FOREIGN KEY (user_login) REFERENCES users(login)
);

-- 索引：加速常见查询
CREATE INDEX IF NOT EXISTS idx_repos_language   ON repos(language);
CREATE INDEX IF NOT EXISTS idx_repos_stars       ON repos(stars DESC);
CREATE INDEX IF NOT EXISTS idx_repos_pushed_at   ON repos(pushed_at DESC);
CREATE INDEX IF NOT EXISTS idx_stars_user_login  ON stars(user_login);
CREATE INDEX IF NOT EXISTS idx_stars_starred_at   ON stars(starred_at DESC);
CREATE INDEX IF NOT EXISTS idx_repo_tags_tag      ON repo_tags(tag);
`
