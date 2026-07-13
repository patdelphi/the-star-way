/**
 * D1StarRepository 核心查询测试
 * 使用 miniflare 模拟 D1 环境，验证 MVP 所需的全部查询和写入方法
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Miniflare } from 'miniflare'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { D1StarRepository, SYSTEM_DEMO_LOGIN } from '../d1-repository.js'

// 当前文件所在目录
const __dirname = dirname(fileURLToPath(import.meta.url))

// migration SQL 文件路径
// __dirname = cloudflare/worker/src/__tests__
// 需回退 3 层到 cloudflare/，然后进入 d1/migrations/
const MIGRATION_PATHS = [
  resolve(__dirname, '..', '..', '..', 'd1', 'migrations', '0001_init.sql'),
  resolve(__dirname, '..', '..', '..', 'd1', 'migrations', '0002_star_sync_continuation.sql'),
]

// 测试用 miniflare 实例
let mf: Miniflare
let repo: D1StarRepository

/**
 * 初始化 miniflare 并加载 D1 schema
 */
async function setupMiniflare(): Promise<Miniflare> {
  const mf = new Miniflare({
    modules: true,
    script: `export default { fetch() { return new Response('ok') } }`,
    d1Databases: ['DB'],
  })

  const d1 = await mf.getD1Database('DB')
  for (const migrationPath of MIGRATION_PATHS) {
    const migrationSql = readFileSync(migrationPath, 'utf-8')
    const cleanSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
    const statements = cleanSql.split(';').map(s => s.trim()).filter(s => s.length > 0)
    await d1.batch(statements.map(s => d1.prepare(s)))
  }

  return mf
}

/**
 * 插入测试数据：1 个用户 + 3 个仓库 + 3 条星标 + 2 个标签
 */
async function seedTestData(d1: D1Database): Promise<void> {
  const now = new Date().toISOString()

  // 用户
  await d1.prepare(`
    INSERT INTO users (login, avatar_url, profile_url, synced_at, name, bio, company, location, followers, public_repos, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).bind(
    'testuser', 'https://avatars.test/testuser.png',
    'https://github.com/testuser', now,
    'Test User', 'Test bio', 'Test Co', 'Earth',
    100, 50,
  ).run()

  // 系统演示用户（用于验证 listUsers 排除逻辑）
  await d1.prepare(`
    INSERT INTO users (login, synced_at, deleted_at) VALUES (?, ?, NULL)
  `).bind(SYSTEM_DEMO_LOGIN, now).run()

  // 仓库
  const repos = [
    {
      github_id: 1, full_name: 'testuser/repo1', owner: 'testuser', name: 'repo1',
      html_url: 'https://github.com/testuser/repo1', description: 'First test repo',
      language: 'Python', license: 'MIT', stars: 100, forks: 10, open_issues: 5,
      topics_json: '["python", "ai", "llm"]', created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z', pushed_at: now, archived: 0, fork: 0, homepage: null,
    },
    {
      github_id: 2, full_name: 'testuser/repo2', owner: 'testuser', name: 'repo2',
      html_url: 'https://github.com/testuser/repo2', description: 'Second test repo',
      language: 'TypeScript', license: 'MIT', stars: 500, forks: 20, open_issues: 2,
      topics_json: '["typescript", "react"]', created_at: '2024-02-01T00:00:00Z',
      updated_at: '2024-07-01T00:00:00Z', pushed_at: now, archived: 0, fork: 0, homepage: 'https://test.com',
    },
    {
      github_id: 3, full_name: 'other/repo3', owner: 'other', name: 'repo3',
      html_url: 'https://github.com/other/repo3', description: 'Third repo (GPL)',
      language: 'Python', license: 'GPL-3.0', stars: 50, forks: 5, open_issues: 1,
      topics_json: '["python", "gpl"]', created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-06-01T00:00:00Z', pushed_at: '2023-06-01T00:00:00Z', archived: 0, fork: 0, homepage: null,
    },
  ]

  for (const r of repos) {
    await d1.prepare(`
      INSERT INTO repos (github_id, full_name, owner, name, html_url, description, language, license,
        stars, forks, open_issues, topics_json, created_at, updated_at, pushed_at, archived, fork, homepage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      r.github_id, r.full_name, r.owner, r.name, r.html_url, r.description,
      r.language, r.license, r.stars, r.forks, r.open_issues, r.topics_json,
      r.created_at, r.updated_at, r.pushed_at, r.archived, r.fork, r.homepage,
    ).run()
  }

  // 星标
  const stars = [
    { user_login: 'testuser', repo_full_name: 'testuser/repo1', starred_at: '2024-03-01T00:00:00Z' },
    { user_login: 'testuser', repo_full_name: 'testuser/repo2', starred_at: '2024-04-01T00:00:00Z' },
    { user_login: 'testuser', repo_full_name: 'other/repo3', starred_at: '2024-05-01T00:00:00Z' },
  ]
  for (const s of stars) {
    await d1.prepare(`
      INSERT INTO stars (user_login, repo_full_name, starred_at, first_seen_at, last_seen_at, removed_at)
      VALUES (?, ?, ?, ?, ?, NULL)
    `).bind(s.user_login, s.repo_full_name, s.starred_at, now, now).run()
  }

  // 标签
  const tags = [
    { repo_full_name: 'testuser/repo1', tag: 'AI / LLM', tag_source: 'topic', confidence: 0.95 },
    { repo_full_name: 'testuser/repo1', tag: 'Python', tag_source: 'topic', confidence: 0.95 },
    { repo_full_name: 'testuser/repo2', tag: '前端框架', tag_source: 'topic', confidence: 0.95 },
  ]
  for (const t of tags) {
    await d1.prepare(`
      INSERT INTO repo_tags (repo_full_name, tag, tag_source, confidence)
      VALUES (?, ?, ?, ?)
    `).bind(t.repo_full_name, t.tag, t.tag_source, t.confidence).run()
  }
}

describe('D1StarRepository', () => {
  beforeAll(async () => {
    mf = await setupMiniflare()
    const d1 = await mf.getD1Database('DB')
    repo = new D1StarRepository(d1)
  })

  afterAll(async () => {
    await mf.dispose()
  })

  beforeEach(async () => {
    // 每个测试前重置数据
    const d1 = await mf.getD1Database('DB')
    // 清空所有表
    await d1.exec('DELETE FROM repo_tags')
    await d1.exec('DELETE FROM stars')
    await d1.exec('DELETE FROM repos')
    await d1.exec('DELETE FROM sync_runs')
    await d1.exec('DELETE FROM users')
    // 重新插入测试数据
    await seedTestData(d1)
  })

  // ===== 用户相关 =====

  describe('用户查询', () => {
    it('listUsers 应返回非 demo-user 的用户，并包含 repoCount 和 tagCount', async () => {
      const users = await repo.listUsers()
      expect(users.length).toBe(1)
      expect(users[0].login).toBe('testuser')
      expect(users[0].repoCount).toBe(3)
      expect(users[0].tagCount).toBe(3) // AI/LLM + Python + 前端框架
    })

    it('ensureUserExists 应正确判断用户存在性', async () => {
      expect(await repo.ensureUserExists('testuser')).toBe(true)
      expect(await repo.ensureUserExists(SYSTEM_DEMO_LOGIN)).toBe(true)
      expect(await repo.ensureUserExists('nonexistent')).toBe(false)
    })

    it('getUserStarCount 应返回用户星标数', async () => {
      expect(await repo.getUserStarCount('testuser')).toBe(3)
      expect(await repo.getUserStarCount('nonexistent')).toBe(0)
    })
  })

  // ===== 仓库列表 =====

  describe('仓库列表查询', () => {
    it('listRepos 应返回所有星标仓库并按 stars 倒序', async () => {
      const result = await repo.listRepos({ userLogin: 'testuser', sortBy: 'stars', sortOrder: 'DESC' })
      expect(result.total).toBe(3)
      expect(result.items.length).toBe(3)
      // repo2 (500) > repo1 (100) > repo3 (50)
      expect(result.items[0].repo.full_name).toBe('testuser/repo2')
      expect(result.items[1].repo.full_name).toBe('testuser/repo1')
      expect(result.items[2].repo.full_name).toBe('other/repo3')
    })

    it('listRepos 应支持 language 筛选', async () => {
      const result = await repo.listRepos({ userLogin: 'testuser', language: 'Python' })
      expect(result.total).toBe(2)
      expect(result.items.every(i => i.repo.language === 'Python')).toBe(true)
    })

    it('listRepos 应支持 tag 筛选', async () => {
      const result = await repo.listRepos({ userLogin: 'testuser', tag: 'Python' })
      expect(result.total).toBe(1)
      expect(result.items[0].repo.full_name).toBe('testuser/repo1')
    })

    it('listRepos 应支持分页', async () => {
      const page1 = await repo.listRepos({ userLogin: 'testuser', limit: 2, offset: 0 })
      expect(page1.items.length).toBe(2)
      const page2 = await repo.listRepos({ userLogin: 'testuser', limit: 2, offset: 2 })
      expect(page2.items.length).toBe(1)
    })

    it('listRepos 应返回 tags 数组', async () => {
      const result = await repo.listRepos({ userLogin: 'testuser' })
      const repo1 = result.items.find(i => i.repo.full_name === 'testuser/repo1')
      expect(repo1?.tags).toContain('AI / LLM')
      expect(repo1?.tags).toContain('Python')
    })

    it('getRepoForUser 应返回指定仓库详情', async () => {
      const r = await repo.getRepoForUser('testuser', 'testuser/repo1')
      expect(r).not.toBeNull()
      expect(r?.repo.full_name).toBe('testuser/repo1')
      expect(r?.repo.language).toBe('Python')
      expect(r?.tags).toContain('AI / LLM')
    })

    it('getRepoForUser 不存在时返回 null', async () => {
      const r = await repo.getRepoForUser('testuser', 'nonexistent/repo')
      expect(r).toBeNull()
    })

    it('getRepoGlobal 应返回全局仓库查询结果', async () => {
      const r = await repo.getRepoGlobal('other/repo3')
      expect(r).not.toBeNull()
      expect(r?.full_name).toBe('other/repo3')
    })

    it('getRepoTags 应返回仓库标签', async () => {
      const tags = await repo.getRepoTags('testuser/repo1')
      expect(tags).toContain('AI / LLM')
      expect(tags).toContain('Python')
    })
  })

  // ===== 统计查询 =====

  describe('统计查询', () => {
    it('queryLanguageStats 应返回语言分布', async () => {
      const stats = await repo.queryLanguageStats('testuser')
      const python = stats.find(s => s.language === 'Python')
      expect(python).toBeDefined()
      expect(python?.count).toBe(2)
    })

    it('queryTopicStats 应从 topics_json 提取 topic 分布', async () => {
      const stats = await repo.queryTopicStats('testuser')
      const python = stats.find(s => s.topic === 'python')
      expect(python).toBeDefined()
      expect(python?.count).toBe(2)
    })

    it('queryLicenseStats 应返回 license 分布', async () => {
      const stats = await repo.queryLicenseStats('testuser')
      const mit = stats.find(s => s.license === 'MIT')
      expect(mit).toBeDefined()
      expect(mit?.count).toBe(2)
    })

    it('queryRepoCount 应返回仓库总数', async () => {
      expect(await repo.queryRepoCount('testuser')).toBe(3)
    })

    it('queryActiveRepoCount 应返回活跃仓库数（90 天内有更新）', async () => {
      const count = await repo.queryActiveRepoCount('testuser')
      // repo1 和 repo2 的 pushed_at 是 now，repo3 是 2023 年
      expect(count).toBe(2)
    })
  })

  // ===== 用户摘要 =====

  describe('用户摘要', () => {
    it('getUserSummary 应返回完整摘要', async () => {
      const summary = await repo.getUserSummary('testuser')
      expect(summary.repoCount).toBe(3)
      expect(summary.activeRepoCount).toBe(2) // repo1 + repo2
      expect(summary.tagCount).toBe(3)
      expect(summary.hiddenGemsCount).toBeGreaterThanOrEqual(0)
      expect(summary.sleepStarsCount).toBe(1) // repo3
      expect(summary.licenseRiskCount).toBe(1) // repo3 GPL
      expect(summary.lastSyncedAt).not.toBeNull()
    })
  })

  // ===== 全局概览 =====

  describe('全局概览', () => {
    it('getOverview 应返回全局统计数据', async () => {
      const overview = await repo.getOverview()
      expect(overview.userCount).toBe(1) // 排除 demo-user
      expect(overview.repoCount).toBe(3)
      expect(overview.activeRepoCount).toBe(2)
      expect(overview.tagCount).toBe(3)
      expect(overview.languages.length).toBeGreaterThan(0)
      expect(overview.topics.length).toBeGreaterThan(0)
      expect(overview.licenses.length).toBeGreaterThan(0)
      expect(overview.recentStars.length).toBe(3)
      expect(overview.starTrend.length).toBeGreaterThan(0)
    })

    it('getOverview 应支持阈值参数', async () => {
      // gemStarsMin=600: 所有仓库 stars 都 < 600，gemRepos 应为空
      // 注：gemRepos 查询用 gemStarsMin 作下限，GEM_STARS_UPPER(10000) 作上限
      const overview = await repo.getOverview({ gemStarsMin: 600, gemStarsMax: 50000 })
      expect(overview.gemRepos.length).toBe(0)
    })
  })

  // ===== 趋势和标签 =====

  describe('趋势和标签', () => {
    it('getUserStarTimeline 应返回按月聚合的星标数', async () => {
      const timeline = await repo.getUserStarTimeline('testuser')
      expect(timeline.length).toBe(3) // 2024-03, 2024-04, 2024-05
      // 按月升序
      expect(timeline[0].month).toBe('2024-03')
      expect(timeline[2].month).toBe('2024-05')
      expect(timeline.every(t => t.count === 1)).toBe(true)
    })

    it('listTags 应返回带 count 的标签列表', async () => {
      const tags = await repo.listTags('testuser')
      const pythonTag = tags.find(t => t.tag === 'Python')
      expect(pythonTag).toBeDefined()
      expect(pythonTag?.count).toBe(1)
    })
  })

  // ===== 写入操作 =====

  describe('写入操作（同步流程）', () => {
    it('upsertUserForSync 应创建或更新用户', async () => {
      const now = new Date().toISOString()
      await repo.upsertUserForSync('newuser', now)
      expect(await repo.ensureUserExists('newuser')).toBe(true)
    })

    it('insertSyncRun 应返回 sync_run id', async () => {
      const now = new Date().toISOString()
      const id = await repo.insertSyncRun('testuser', now)
      expect(id).toBeGreaterThan(0)
    })

    it('updateSyncRunSuccess 应更新为成功状态', async () => {
      const now = new Date().toISOString()
      const id = await repo.insertSyncRun('testuser', now)
      await repo.updateSyncRunSuccess(id, now, 10, 10, 0, 1, 4999, null)
      const runs = await repo.listSyncRuns('testuser')
      const run = runs.find(r => r.id === id)
      expect(run?.status).toBe('success')
      expect(run?.repos_upserted).toBe(10)
    })

    it('updateSyncRunFailure 应更新为失败状态', async () => {
      const now = new Date().toISOString()
      const id = await repo.insertSyncRun('testuser', now)
      await repo.updateSyncRunFailure(id, now, '网络错误')
      const runs = await repo.listSyncRuns('testuser')
      const run = runs.find(r => r.id === id)
      expect(run?.status).toBe('failed')
      expect(run?.error_message).toBe('网络错误')
    })

    it('batchUpsertReposAndStars 应批量写入仓库和星标', async () => {
      const now = new Date().toISOString()
      const repos = [
        {
          repo: {
            id: 100, full_name: 'new/repo100', owner: { login: 'new' }, name: 'repo100',
            html_url: 'https://github.com/new/repo100', description: 'New repo',
            language: 'Rust', license: { spdx_id: 'MIT' }, stargazers_count: 200,
            forks_count: 30, open_issues_count: 3, topics: ['rust', 'cli'],
            created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z',
            pushed_at: now, archived: false, fork: false, homepage: null,
          },
          starred_at: '2024-06-01T00:00:00Z',
        },
      ]
      const result = await repo.batchUpsertReposAndStars('testuser', repos, now)
      expect(result.reposUpserted).toBe(1)
      expect(result.starsUpserted).toBe(1)
      // 验证写入
      const r = await repo.getRepoForUser('testuser', 'new/repo100')
      expect(r).not.toBeNull()
      expect(r?.repo.language).toBe('Rust')
    })

    it('batchUpsertReposAndStars 应按 github_id 处理仓库改名', async () => {
      const d1 = await mf.getD1Database('DB')
      const now = new Date().toISOString()

      // 模拟 GitHub 仓库改名：同一个 github_id 已存在旧 full_name。
      await d1.prepare(`
        INSERT INTO repos (github_id, full_name, owner, name, html_url, created_at, updated_at, archived, fork)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
      `).bind(
        100, 'old-owner/old-name', 'old-owner', 'old-name',
        'https://github.com/new-owner/new-name', now, now,
      ).run()
      await d1.prepare(`
        INSERT INTO stars (user_login, repo_full_name, starred_at, first_seen_at, last_seen_at, removed_at)
        VALUES (?, ?, ?, ?, ?, NULL)
      `).bind('testuser', 'old-owner/old-name', now, now, now).run()

      await repo.batchUpsertReposAndStars('testuser', [{
        repo: {
          id: 100, full_name: 'new-owner/new-name', owner: { login: 'new-owner' }, name: 'new-name',
          html_url: 'https://github.com/new-owner/new-name', description: null,
          language: 'TypeScript', license: null, stargazers_count: 10,
          forks_count: 1, open_issues_count: 0, topics: [],
          created_at: now, updated_at: now, pushed_at: now,
          archived: false, fork: false, homepage: null,
        },
        starred_at: now,
      }], now)

      const renamedRepo = await d1.prepare('SELECT full_name FROM repos WHERE github_id = ?').bind(100).first<{ full_name: string }>()
      expect(renamedRepo?.full_name).toBe('new-owner/new-name')
      const renamedStar = await d1.prepare('SELECT 1 AS found FROM stars WHERE user_login = ? AND repo_full_name = ?')
        .bind('testuser', 'new-owner/new-name').first<{ found: number }>()
      expect(renamedStar?.found).toBe(1)
      const staleStar = await d1.prepare('SELECT 1 AS found FROM stars WHERE user_login = ? AND repo_full_name = ?')
        .bind('testuser', 'old-owner/old-name').first<{ found: number }>()
      expect(staleStar).toBeNull()
    })

    it('batchUpsertReposAndStars 应处理 full_name 被旧 github_id 占用', async () => {
      const d1 = await mf.getD1Database('DB')
      const now = new Date().toISOString()

      // 模拟仓库转移或 GitHub 数据更正：full_name 相同但 github_id 发生变化。
      await d1.prepare(`
        INSERT INTO repos (github_id, full_name, owner, name, html_url, created_at, updated_at, archived, fork)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
      `).bind(
        101, 'new-owner/new-name', 'new-owner', 'new-name',
        'https://github.com/new-owner/new-name', now, now,
      ).run()

      await repo.batchUpsertReposAndStars('testuser', [{
        repo: {
          id: 102, full_name: 'new-owner/new-name', owner: { login: 'new-owner' }, name: 'new-name',
          html_url: 'https://github.com/new-owner/new-name', description: null,
          language: 'TypeScript', license: null, stargazers_count: 10,
          forks_count: 1, open_issues_count: 0, topics: [],
          created_at: now, updated_at: now, pushed_at: now,
          archived: false, fork: false, homepage: null,
        },
        starred_at: now,
      }], now)

      const currentRepo = await d1.prepare('SELECT github_id FROM repos WHERE full_name = ?')
        .bind('new-owner/new-name').first<{ github_id: number }>()
      expect(currentRepo?.github_id).toBe(102)
      const duplicateCount = await d1.prepare('SELECT COUNT(*) AS count FROM repos WHERE full_name = ?')
        .bind('new-owner/new-name').first<{ count: number }>()
      expect(duplicateCount?.count).toBe(1)
    })

  })

  // ===== 分类 =====

  describe('分类', () => {
    it('classifyReposForUser 应为所有仓库生成标签', async () => {
      const result = await repo.classifyReposForUser('testuser')
      expect(result.repoCount).toBe(3)
      expect(result.tagsCreated).toBeGreaterThan(0)
      // 验证 repo1 有 AI / LLM 标签（来自 topic llm）
      const tags = await repo.getRepoTags('testuser/repo1')
      expect(tags).toContain('AI / LLM')
    })
  })
})
