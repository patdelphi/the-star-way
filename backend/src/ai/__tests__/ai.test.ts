/**
 * AI 模块框架测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createConnection, initDatabase } from '../../db/connection.js'
import { loadAiConfig, DEFAULT_AI_CONFIG } from '../config.js'
import { cacheTranslation, getCachedTranslation, cacheAnalysisReport, getCachedAnalysisReport } from '../cache.js'
import type Database from 'better-sqlite3'
import { rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const TEST_DB_DIR = join(tmpdir(), 'starway-test-ai-' + process.pid)
function getTestDbPath() { return join(TEST_DB_DIR, 'test.db') }
function cleanup() { if (existsSync(TEST_DB_DIR)) rmSync(TEST_DB_DIR, { recursive: true, force: true }) }

let db: Database.Database

describe('AI 配置', () => {
  it('默认配置应为关闭状态', () => {
    expect(DEFAULT_AI_CONFIG.enabled).toBe(false)
    expect(DEFAULT_AI_CONFIG.base_url).toBe('')
    expect(DEFAULT_AI_CONFIG.api_key).toBe('')
    expect(DEFAULT_AI_CONFIG.model).toBe('')
  })

  it('loadAiConfig 无环境变量时应返回关闭配置', () => {
    const config = loadAiConfig()
    expect(config.enabled).toBe(false)
  })
})

describe('AI 缓存', () => {
  beforeEach(() => {
    cleanup()
    db = createConnection(getTestDbPath())
    initDatabase(db)
  })

  afterEach(() => {
    db.close()
    cleanup()
  })

  describe('翻译缓存', () => {
    it('应正确写入和读取翻译缓存', () => {
      // 先插入对应的仓库以满足外键约束
      db.prepare('INSERT INTO repos (github_id, full_name, owner, name, html_url) VALUES (1, ?, ?, ?, ?)')
        .run('test/repo', 'test', 'repo', 'https://github.com/test/repo')
      cacheTranslation(db, 'test/repo', 'zh-CN', '测试翻译', '测试摘要', 'test-provider')
      const cached = getCachedTranslation(db, 'test/repo', 'zh-CN')
      expect(cached).not.toBeNull()
      expect(cached!.translated_description).toBe('测试翻译')
      expect(cached!.translated_readme_summary).toBe('测试摘要')
      expect(cached!.provider).toBe('test-provider')
      expect(cached!.updated_at).toBeTruthy()
    })

    it('重复写入应覆盖旧缓存', () => {
      db.prepare('INSERT OR IGNORE INTO repos (github_id, full_name, owner, name, html_url) VALUES (1, ?, ?, ?, ?)')
        .run('test/repo', 'test', 'repo', 'https://github.com/test/repo')
      cacheTranslation(db, 'test/repo', 'zh-CN', '旧翻译', null, 'old')
      cacheTranslation(db, 'test/repo', 'zh-CN', '新翻译', '新摘要', 'new')
      const cached = getCachedTranslation(db, 'test/repo', 'zh-CN')
      expect(cached!.translated_description).toBe('新翻译')
      expect(cached!.translated_readme_summary).toBe('新摘要')
      expect(cached!.provider).toBe('new')
    })

    it('未缓存的翻译应返回 null', () => {
      const cached = getCachedTranslation(db, 'nonexistent/repo', 'zh-CN')
      expect(cached).toBeNull()
    })
  })

  describe('分析报告缓存', () => {
    it('应正确写入和读取分析报告', () => {
      // 先插入对应的用户以满足外键约束
      db.prepare('INSERT OR IGNORE INTO users (login) VALUES (?)').run('demo-user')
      const content = JSON.stringify({ summary: '测试报告' })
      cacheAnalysisReport(db, 'demo-user', 'overview', 'zh-CN', content)
      const cached = getCachedAnalysisReport(db, 'demo-user', 'overview', 'zh-CN')
      expect(cached).not.toBeNull()
      expect(cached!.content_json).toBe(content)
      expect(cached!.created_at).toBeTruthy()
    })

    it('重复写入应覆盖旧报告', () => {
      db.prepare('INSERT OR IGNORE INTO users (login) VALUES (?)').run('demo-user')
      cacheAnalysisReport(db, 'demo-user', 'overview', 'zh-CN', '"old"')
      cacheAnalysisReport(db, 'demo-user', 'overview', 'zh-CN', '"new"')
      const cached = getCachedAnalysisReport(db, 'demo-user', 'overview', 'zh-CN')
      expect(cached!.content_json).toBe('"new"')
    })

    it('未缓存的报告应返回 null', () => {
      const cached = getCachedAnalysisReport(db, 'nonexistent', 'overview')
      expect(cached).toBeNull()
    })
  })
})
