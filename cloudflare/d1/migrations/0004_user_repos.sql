-- 自有仓库表：记录用户自己发布的公开项目（owner 为本人，排除 fork）
-- 与 stars（标星）关系对称，用于抓取、列出、分析开发者自己的产出
CREATE TABLE IF NOT EXISTS user_repos (
  user_login      TEXT NOT NULL,
  repo_full_name  TEXT NOT NULL,
  first_seen_at   TEXT NOT NULL,
  last_seen_at    TEXT NOT NULL,
  removed_at      TEXT,
  PRIMARY KEY (user_login, repo_full_name)
);

CREATE INDEX IF NOT EXISTS idx_user_repos_user ON user_repos(user_login);