# -*- coding: utf-8 -*-
"""
程序说明：将本地 SQLite 数据库导出为 Cloudflare D1 可执行的 SQL 文件
用途：SQLite -> D1 全量数据同步
生成多个 SQL 文件，按表拆分，便于 wrangler d1 execute --file 分批执行

关键处理：
1. 字符串值正确转义（单引号 ' -> ''）
2. NULL 值输出为 NULL（而非字符串 'NULL'）
3. INTEGER/REAL 直接输出
4. 使用 INSERT OR IGNORE 避免主键冲突
5. 大表（stars/repos）按批次拆分，每批 500 行，避免单文件过大
"""
import sqlite3
import os
import sys

# SQLite 数据库路径
DB_PATH = os.path.join("backend", "data", "starway.db")
# 输出目录
OUT_DIR = os.path.join("aipython", "d1_sync")

# 表定义：表名 + 列名列表（与 D1 schema 完全一致）
TABLES = [
    {
        "name": "users",
        "columns": ["login", "avatar_url", "profile_url", "synced_at", "name", "bio",
                    "company", "location", "followers", "public_repos", "deleted_at"],
    },
    {
        "name": "repos",
        "columns": ["github_id", "full_name", "owner", "name", "html_url", "description",
                    "language", "license", "stars", "forks", "open_issues", "topics_json",
                    "created_at", "updated_at", "pushed_at", "archived", "fork", "homepage"],
    },
    {
        "name": "stars",
        "columns": ["user_login", "repo_full_name", "starred_at", "first_seen_at",
                    "last_seen_at", "removed_at"],
    },
    {
        "name": "repo_tags",
        "columns": ["repo_full_name", "tag", "tag_source", "confidence"],
    },
    {
        "name": "translations",
        "columns": ["repo_full_name", "target_lang", "translated_description",
                    "translated_readme_summary", "provider", "updated_at"],
    },
    {
        "name": "sync_runs",
        "columns": ["id", "user_login", "started_at", "ended_at", "status",
                    "repos_upserted", "stars_upserted", "repos_removed", "pages_fetched",
                    "rate_limit_remaining", "rate_limit_reset", "error_message"],
    },
    {
        "name": "analysis_reports",
        "columns": ["user_login", "report_type", "lang", "content_json", "created_at"],
    },
]

# 每批 INSERT 行数（避免单个 SQL 文件过大）
BATCH_SIZE = 500


def escape_value(val, col_type=None):
    """
    将 Python 值转义为 SQL 字面量
    - None -> NULL
    - str -> '转义后的字符串'
    - int/float -> 直接输出
    - bytes -> 转为字符串后转义
    """
    if val is None:
        return "NULL"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, bytes):
        # bytes 转 str（如 SQLite 的 BLOB）
        try:
            val = val.decode("utf-8")
        except UnicodeDecodeError:
            val = val.decode("latin-1")
    # 字符串：转义单引号
    escaped = str(val).replace("'", "''")
    return f"'{escaped}'"


def export_table(conn, table_info):
    """
    导出单个表为 SQL 文件
    返回生成的文件列表
    """
    table_name = table_info["name"]
    columns = table_info["columns"]
    cols_str = ", ".join(columns)

    cur = conn.cursor()
    # 读取所有行
    cur.execute(f"SELECT {cols_str} FROM \"{table_name}\"")
    rows = cur.fetchall()

    if not rows:
        print(f"[SKIP] {table_name}: 0 行，跳过")
        return []

    # 按批次拆分文件
    files = []
    total_batches = (len(rows) + BATCH_SIZE - 1) // BATCH_SIZE

    for batch_idx in range(total_batches):
        start = batch_idx * BATCH_SIZE
        end = min(start + BATCH_SIZE, len(rows))
        batch_rows = rows[start:end]

        # 文件名：表名_批次序号.sql（从 01 开始）
        file_name = f"{table_name}_{batch_idx + 1:02d}.sql"
        if total_batches == 1:
            file_name = f"{table_name}.sql"
        file_path = os.path.join(OUT_DIR, file_name)

        with open(file_path, "w", encoding="utf-8", newline="\n") as f:
            # 写入文件头注释
            f.write(f"-- {table_name} 表数据（批次 {batch_idx + 1}/{total_batches}，{len(batch_rows)} 行）\n")
            f.write(f"-- 源: SQLite -> D1 同步\n\n")

            # 逐行生成 INSERT
            for row in batch_rows:
                values = [escape_value(v) for v in row]
                values_str = ", ".join(values)
                f.write(f"INSERT OR IGNORE INTO {table_name} ({cols_str}) VALUES ({values_str});\n")

        files.append(file_path)
        print(f"[OK] {table_name} 批次 {batch_idx + 1}/{total_batches}: {len(batch_rows)} 行 -> {file_name}")

    return files


def main():
    if not os.path.exists(DB_PATH):
        print(f"[ERR] 数据库文件不存在: {DB_PATH}")
        sys.exit(1)

    # 创建输出目录
    os.makedirs(OUT_DIR, exist_ok=True)

    # 使用只读模式打开 SQLite
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row

    print(f"[INFO] 开始导出 SQLite -> D1 SQL 文件")
    print(f"[INFO] 数据库: {DB_PATH}")
    print(f"[INFO] 输出目录: {OUT_DIR}")
    print()

    # 逐表导出
    all_files = []
    for table_info in TABLES:
        files = export_table(conn, table_info)
        all_files.extend(files)
        print()

    conn.close()

    # 生成汇总文件
    summary_path = os.path.join(OUT_DIR, "_summary.txt")
    with open(summary_path, "w", encoding="utf-8", newline="\n") as f:
        f.write("SQLite -> D1 同步 SQL 文件汇总\n")
        f.write(f"生成时间: {os.path.getmtime(DB_PATH)}\n")
        f.write(f"文件总数: {len(all_files)}\n\n")
        f.write("SQL 文件列表（按导入顺序）：\n")
        for fp in all_files:
            size = os.path.getsize(fp)
            f.write(f"  {os.path.basename(fp)} ({size} bytes)\n")

    print(f"[DONE] 共生成 {len(all_files)} 个 SQL 文件")
    print(f"[INFO] 汇总: {summary_path}")
    print(f"[INFO] 下一步: 依次执行 wrangler d1 execute starway-db --remote --file=<file>")


if __name__ == "__main__":
    main()
