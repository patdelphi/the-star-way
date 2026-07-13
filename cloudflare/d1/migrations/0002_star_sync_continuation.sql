-- 星标同步续传：记录任务下一页，并用同步任务标识星标最后一次出现的批次。
ALTER TABLE stars ADD COLUMN sync_run_id INTEGER;
ALTER TABLE sync_runs ADD COLUMN next_page INTEGER NOT NULL DEFAULT 1;
