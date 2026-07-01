/**
 * 分类与统计测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createConnection, initDatabase, withTransaction } from '../../db/connection.js'
import { parseCsv, importCsvRecords, DEMO_USER_LOGIN } from '../../import/csv-importer.js'
import { classifyAllRepos, classifyRepo } from '../classifier.js'
import { queryRepos, queryLanguageStats, queryTopicStats, queryLicenseStats, queryRepoCount, queryActiveRepoCount } from '../../repository/repo-queries.js'
import type Database from 'better-sqlite3'
import { rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const TEST_DB_DIR = join(tmpdir(), 'starway-test-cls-' + process.pid)
function getTestDbPath() { return join(TEST_DB_DIR, 'test.db') }
function cleanup() { if (existsSync(TEST_DB_DIR)) rmSync(TEST_DB_DIR, { recursive: true, force: true }) }

// 模拟 CSV
const MOCK_CSV = `序号,项目名称,星星数量,简介,中文简介,URL,编程语言,License,Forks,Open Issues,Topics,标星时间,最近更新
1,awesome-python/awesome-python,150000,An awesome list curated list of Python frameworks,Python 精选列表,https://github.com/awesome-python/awesome-python,未知,未知,4000,10,"python, awesome, awesome-list, collections, curated-list",2025-06-01,2026-06-20
2,langchain-ai/langchain,80000,Build context-aware reasoning applications,构建上下文推理应用,https://github.com/langchain-ai/langchain,Python,MIT,8000,200,"llm, ai, agent, rag, langchain, python",2025-09-01,2026-06-28
3,microsoft/vscode,180000,Visual Studio Code editor,代码编辑器,https://github.com/microsoft/vscode,TypeScript,MIT,30000,150,"editor, vscode, typescript, ide",2025-03-15,2026-06-25
4,vercel/next.js,130000,The React framework for the web,React Web 框架,https://github.com/vercel/next.js,TypeScript,MIT,28000,300,"react, nextjs, web, frontend, typescript",2025-01-20,2026-06-30
5,denoland/deno,100000,A modern runtime for JS and TS,JS/TS 运行时,https://github.com/denoland/deno,Rust,MIT,8000,80,"deno, runtime, typescript, javascript",2025-07-01,2025-07-01
6,torvalds/linux,200000,Linux kernel source tree,Linux 内核,https://github.com/torvalds/linux,C,GPL-2.0,50000,100,"kernel, linux, operating-system",2024-01-01,2026-06-30
7,portainer/portainer,30000,A lightweight management UI for Docker,Docker 管理面板,https://github.com/portainer/portainer,Go,GPL-3.0,3000,50,"docker, management, ui, self-hosted",2025-05-01,2026-06-15`

let db: Database.Database

describe('分类功能', () => {
  beforeEach(() => {
    cleanup()
    db = createConnection(getTestDbPath())
    initDatabase(db)
  })

  afterEach(() => {
    db.close()
    cleanup()
  })

  describe('classifyRepo（单仓库分类）', () => {
    it('应从 topics 匹配 AI / LLM 标签', () => {
      const tags = classifyRepo('langchain', 'Build LLM apps', '["llm", "ai", "agent", "rag"]')
      const tagNames = tags.map(t => t.tag)
      expect(tagNames).toContain('AI / LLM')
      expect(tagNames).toContain('AI Agent')
      expect(tagNames).toContain('RAG / 向量检索')
    })

    it('应从 topics 匹配前端框架标签', () => {
      const tags = classifyRepo('next.js', 'The React framework', '["react", "nextjs", "typescript"]')
      const tagNames = tags.map(t => t.tag)
      expect(tagNames).toContain('前端框架')
      expect(tagNames).toContain('JavaScript / TypeScript')
    })

    it('应从仓库名称匹配标签', () => {
      const tags = classifyRepo('awesome-python', 'A curated list', '["awesome-list", "python"]')
      const tagNames = tags.map(t => t.tag)
      expect(tagNames).toContain('Awesome 列表')
      expect(tagNames).toContain('Python')
    })

    it('应从描述匹配标签', () => {
      const tags = classifyRepo('portainer', 'A lightweight self-hosted Docker management UI', '["docker"]')
      const tagNames = tags.map(t => t.tag)
      expect(tagNames).toContain('容器 / 编排')
      expect(tagNames).toContain('可自托管')
      expect(tagNames).toContain('轻量级')
    })

    it('置信度应正确：topic > name > description', () => {
      const tags = classifyRepo('awesome-react', 'A curated awesome list for learning react', '["react", "awesome-list"]')
      const tagMap = new Map(tags.map(t => [t.tag, t]))

      // 来自 topic
      expect(tagMap.get('前端框架')!.source).toBe('topic')
      expect(tagMap.get('前端框架')!.confidence).toBe(0.95)

      // 来自 name
      expect(tagMap.get('Awesome 列表')!.source).toBe('topic') // topic 也匹配了

      // 来自 description
      expect(tagMap.get('学习资源')!.source).toBe('description')
      expect(tagMap.get('学习资源')!.confidence).toBe(0.80)
    })

    it('同一标签不应重复出现', () => {
      const tags = classifyRepo('test', null, '["ai", "machine-learning"]')
      const aiCount = tags.filter(t => t.tag === 'AI / LLM').length
      expect(aiCount).toBeLessThanOrEqual(1)
    })

    it('无匹配时应返回空数组', () => {
      const tags = classifyRepo('xyz', 'some random text', '[]')
      expect(tags).toEqual([])
    })
  })

  describe('classifyAllRepos（批量分类）', () => {
    beforeEach(() => {
      const records = parseCsv(MOCK_CSV)
      importCsvRecords(db, records)
    })

    it('应对所有仓库执行分类', () => {
      const result = classifyAllRepos(db)
      expect(result.repoCount).toBe(7)
      expect(result.tagsCreated).toBeGreaterThan(0)
    })

    it('分类后应可查询标签', () => {
      classifyAllRepos(db)
      const tags = db.prepare('SELECT tag, tag_source, confidence FROM repo_tags WHERE repo_full_name = ?')
        .all('langchain-ai/langchain') as any[]

      const tagNames = tags.map(t => t.tag)
      expect(tagNames).toContain('AI / LLM')
      expect(tagNames).toContain('Python')
      expect(tagNames).toContain('AI Agent')
      expect(tagNames).toContain('RAG / 向量检索')
    })

    it('分类后应支持按标签筛选仓库', () => {
      classifyAllRepos(db)
      const result = queryRepos(db, { tag: 'AI / LLM' })
      expect(result.total).toBeGreaterThanOrEqual(1)
      expect(result.items.some(r => r.repo.full_name === 'langchain-ai/langchain')).toBe(true)
    })

    it('重新分类应覆盖旧标签但保留手动标签', () => {
      // 先手动添加一个标签到已存在的仓库
      db.prepare('INSERT OR IGNORE INTO repo_tags (repo_full_name, tag, tag_source, confidence) VALUES (?, ?, ?, ?)')
        .run('awesome-python/awesome-python', '手动标签', 'manual', 1.0)

      // 执行分类
      classifyAllRepos(db)

      // 手动标签应保留
      const manualTag = db.prepare("SELECT * FROM repo_tags WHERE tag_source = 'manual'")
        .get() as any
      expect(manualTag).toBeDefined()
      expect(manualTag.tag).toBe('手动标签')
    })

    it('awesome 列表应匹配多个标签', () => {
      classifyAllRepos(db)
      const tags = db.prepare('SELECT tag FROM repo_tags WHERE repo_full_name = ?')
        .all('awesome-python/awesome-python') as any[]
      const tagNames = tags.map(t => t.tag)
      expect(tagNames).toContain('Awesome 列表')
      expect(tagNames).toContain('Python')
    })
  })
})

describe('统计功能扩展', () => {
  beforeEach(() => {
    cleanup()
    db = createConnection(getTestDbPath())
    initDatabase(db)
    const records = parseCsv(MOCK_CSV)
    importCsvRecords(db, records)
  })

  afterEach(() => {
    db.close()
    cleanup()
  })

  it('语言分布应包含 Python', () => {
    const stats = queryLanguageStats(db)
    const python = stats.find(s => s.language === 'Python')
    expect(python).toBeDefined()
    expect(python!.count).toBeGreaterThanOrEqual(1)
  })

  it('协议分布应包含 GPL', () => {
    const stats = queryLicenseStats(db)
    const gpl = stats.find(s => s.license === 'GPL-2.0')
    expect(gpl).toBeDefined()
  })

  it('仓库总数应正确', () => {
    expect(queryRepoCount(db)).toBe(7)
  })

  it('沉睡仓库统计（pushed_at 超过 90 天）', () => {
    // denoland/deno 的 pushed_at 是 2025-07-01，已经超过 90 天
    const activeCount = queryActiveRepoCount(db)
    // 应该小于总仓库数
    expect(activeCount).toBeLessThan(7)
  })
})
