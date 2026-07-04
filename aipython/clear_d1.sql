-- 清空 D1 所有表数据（用户已确认）
-- 按依赖顺序删除，避免外键约束问题（虽然 D1 默认不强制外键）
DELETE FROM repo_tags;
DELETE FROM stars;
DELETE FROM translations;
DELETE FROM analysis_reports;
DELETE FROM sync_runs;
DELETE FROM repos;
DELETE FROM users;
