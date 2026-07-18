-- 优化 stars 表查询：为 repo_full_name 单列添加索引。
-- 背景：batchUpsertReposAndStars 中的 UPDATE stars WHERE repo_full_name = (SELECT ...)
-- 在仓库未改名时也会触发全表扫描，导致 D1 rows read 居高不下。
-- 复合主键 (user_login, repo_full_name) 无法从此前缀命中仅按 repo_full_name 过滤的查询。
-- 此索引使命名变更/兜底场景的 UPDATE 走 index seek，同时为代码层跳过未改名仓库的优化兜底。
CREATE INDEX IF NOT EXISTS idx_stars_repo_full_name ON stars(repo_full_name);
