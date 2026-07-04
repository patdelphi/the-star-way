# -*- coding: utf-8 -*-
"""
程序说明：检查本地 SQLite 数据库的表结构和数据量
用途：为 SQLite -> Cloudflare D1 同步做前置调查
只读操作，不修改数据库
"""
import sqlite3
import os
import sys

# SQLite 数据库路径
DB_PATH = os.path.join("backend", "data", "starway.db")

def main():
    if not os.path.exists(DB_PATH):
        print(f"[ERR] 数据库文件不存在: {DB_PATH}")
        sys.exit(1)

    # 文件大小
    size = os.path.getsize(DB_PATH)
    print(f"[INFO] 数据库文件: {DB_PATH}")
    print(f"[INFO] 文件大小: {size} 字节 ({size/1024:.1f} KB)")

    # 使用 URI 模式打开，避免锁定问题（只读模式）
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # 1. 读取所有表
    print("\n[TABLES]")
    tables = cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name"
    ).fetchall()
    table_names = [t["name"] for t in tables]
    for t in table_names:
        print(f"  - {t}")

    # 2. 读取每个表的行数和 schema
    print("\n[COUNTS & SCHEMA]")
    for t in table_names:
        try:
            cnt = cur.execute(f"SELECT COUNT(*) FROM \"{t}\"").fetchone()[0]
            print(f"  {t}: {cnt} rows")
        except Exception as e:
            print(f"  {t}: ERR {e}")

    # 3. 读取每个表的 CREATE 语句，便于与 D1 schema 对比
    print("\n[CREATE STATEMENTS]")
    for t in table_names:
        row = cur.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (t,)
        ).fetchone()
        if row:
            print(f"\n-- table: {t}")
            print(row["sql"])

    # 4. 检查 users 表样例（前 3 行，确认有真实数据）
    print("\n[SAMPLE users (first 3)]")
    try:
        rows = cur.execute("SELECT login, name, synced_at, deleted_at FROM users LIMIT 3").fetchall()
        for r in rows:
            print(f"  login={r['login']}, name={r['name']}, synced_at={r['synced_at']}, deleted_at={r['deleted_at']}")
    except Exception as e:
        print(f"  ERR {e}")

    # 5. 检查 repos 表样例（前 3 行）
    print("\n[SAMPLE repos (first 3)]")
    try:
        rows = cur.execute("SELECT full_name, language, stars, pushed_at FROM repos LIMIT 3").fetchall()
        for r in rows:
            print(f"  full_name={r['full_name']}, language={r['language']}, stars={r['stars']}, pushed_at={r['pushed_at']}")
    except Exception as e:
        print(f"  ERR {e}")

    # 6. 检查 stars 表样例
    print("\n[SAMPLE stars (first 3)]")
    try:
        rows = cur.execute("SELECT user_login, repo_full_name, starred_at, removed_at FROM stars LIMIT 3").fetchall()
        for r in rows:
            print(f"  user_login={r['user_login']}, repo={r['repo_full_name']}, starred_at={r['starred_at']}, removed_at={r['removed_at']}")
    except Exception as e:
        print(f"  ERR {e}")

    conn.close()
    print("\n[DONE]")

if __name__ == "__main__":
    main()
