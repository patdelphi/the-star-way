# -*- coding: utf-8 -*-
"""
程序说明：检查指定仓库的 license 字段
用于诊断"协议未识别"问题
"""
import sqlite3
import sys

DB_PATH = "backend/data/starway.db"
TARGET_REPO = "EbookFoundation/free-programming-books"

conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

row = cur.execute(
    "SELECT full_name, license, html_url FROM repos WHERE full_name=?",
    (TARGET_REPO,)
).fetchone()

if not row:
    print(f"[ERR] 仓库不存在: {TARGET_REPO}")
    sys.exit(1)

print(f"full_name: {row['full_name']}")
print(f"license:   {repr(row['license'])}")
print(f"html_url:  {row['html_url']}")

# 同时统计全库 license 分布
print("\n[license 分布（前 15）]")
rows = cur.execute(
    "SELECT license, COUNT(*) as n FROM repos GROUP BY license ORDER BY n DESC LIMIT 15"
).fetchall()
for r in rows:
    print(f"  {repr(r['license'])}: {r['n']}")

conn.close()
