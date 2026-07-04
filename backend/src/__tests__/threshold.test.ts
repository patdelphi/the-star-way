/**
 * 业务阈值参数化测试
 * 验证 queryUserSummary / queryGlobalOverview / queryActiveRepoCount
 * 在自定义 sleepDays / gemStarsMin / gemStarsMax 下行为正确，无参时回退默认常量
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createConnection, initDatabase } from '../db/connection.js'
import { parseCsv, importCsvRecords } from '../import/csv-importer.js'
import {
  queryUserSummary,
  queryGlobalOverview,
  queryActiveRepoCount,
} from '../repository/repo-queries.js'
import type Database from 'better-sqlite3'

// 生成 n 天前的 YYYY-MM-DD 日期字符串（与 CSV 中 pushed_at 格式一致）
function daysAgoDate(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

const TEST_USER = 'octocat'

// 动态构造测试 CSV：3 个仓库 pushed_at 分别为 10/60/200 天前，stars 分别为 100/500/5000
function buildCsv(): string {
  return `序号,项目名称,星星数量,简介,中文简介,URL,编程语言,License,Forks,Open Issues,Topics,标星时间,最近更新
1,repo/active-low,100,active low star,活跃低星,https://github.com/repo/active-low,JavaScript,MIT,5,1,"demo",${daysAgoDate(5)},${daysAgoDate(10)}
2,repo/mid-star,500,mid star,中等星,https://github.com/repo/mid-star,Python,MIT,10,2,"demo",${daysAgoDate(5)},${daysAgoDate(60)}
3,repo/sleep-high,5000,sleep high star,沉睡高星,https://github.com/repo/sleep-high,Go,MIT,50,5,"demo",${daysAgoDate(5)},${daysAgoDate(200)}`
}

let db: Database.Database

describe('业务阈值参数化', () => {
  beforeEach(() => {
    db = createConnection(':memory:')
    initDatabase(db)
    importCsvRecords(db, parseCsv(buildCsv()), TEST_USER)
  })

  afterEach(() => {
    db.close()
  })

  // ===== queryUserSummary 默认阈值（向后兼容） =====
  describe('queryUserSummary 默认阈值', () => {
    it('无 options 时使用默认 90 天阈值', () => {
      const summary = queryUserSummary(db, TEST_USER)
      // 10 天 + 60 天 <= 90 天 → 活跃 2 个
      expect(summary.activeRepoCount).toBe(2)
      // 200 天 > 90 天 → 沉睡 1 个
      expect(summary.sleepStarsCount).toBe(1)
      // stars<=1000 且活跃 → repo1(100) + repo2(500) = 2
      expect(summary.hiddenGemsCount).toBe(2)
      // 仓库总数 3
      expect(summary.repoCount).toBe(3)
    })
  })

  // ===== queryUserSummary 自定义 sleepDays =====
  describe('queryUserSummary 自定义 sleepDays', () => {
    it('sleepDays=30 时仅 10 天内的仓库活跃', () => {
      const summary = queryUserSummary(db, TEST_USER, { sleepDays: 30 })
      expect(summary.activeRepoCount).toBe(1)  // 仅 repo1(10天)
      expect(summary.sleepStarsCount).toBe(2)  // repo2(60天) + repo3(200天)
      // hiddenGems 受 sleepDays 影响：30 天内活跃且 stars<=1000 → repo1
      expect(summary.hiddenGemsCount).toBe(1)
    })

    it('sleepDays=365 时所有仓库都活跃', () => {
      const summary = queryUserSummary(db, TEST_USER, { sleepDays: 365 })
      expect(summary.activeRepoCount).toBe(3)
      expect(summary.sleepStarsCount).toBe(0)
      // stars<=1000 且活跃 → repo1 + repo2（repo3 stars=5000 超过 1000）
      expect(summary.hiddenGemsCount).toBe(2)
    })
  })

  // ===== queryUserSummary 自定义 gemStarsMax =====
  describe('queryUserSummary 自定义 gemStarsMax', () => {
    it('gemStarsMax=200 时仅 stars<=200 的算隐藏宝石', () => {
      const summary = queryUserSummary(db, TEST_USER, { gemStarsMax: 200 })
      // 默认 90 天活跃 + stars<=200 → repo1(100) = 1
      expect(summary.hiddenGemsCount).toBe(1)
      // activeRepoCount 不受 gemStarsMax 影响
      expect(summary.activeRepoCount).toBe(2)
    })

    it('gemStarsMax=10000 时活跃仓库中 stars<=10000 都算隐藏宝石', () => {
      const summary = queryUserSummary(db, TEST_USER, { gemStarsMax: 10000 })
      // 默认 90 天活跃：repo1(100) + repo2(500)，repo3(200天) 沉睡不计
      // 两个活跃仓库 stars 都 <= 10000 → 2
      expect(summary.hiddenGemsCount).toBe(2)
    })

    it('gemStarsMax=10000 且 sleepDays=365 时全部仓库都算隐藏宝石', () => {
      const summary = queryUserSummary(db, TEST_USER, { gemStarsMax: 10000, sleepDays: 365 })
      // sleepDays=365 时 repo3 也活跃，三个仓库 stars 都 <= 10000 → 3
      expect(summary.hiddenGemsCount).toBe(3)
    })
  })

  // ===== queryGlobalOverview 默认阈值（向后兼容） =====
  describe('queryGlobalOverview 默认阈值', () => {
    it('无 options 时使用默认 90 天阈值', () => {
      const overview = queryGlobalOverview(db)
      expect(overview.userCount).toBe(1)
      expect(overview.repoCount).toBe(3)
      expect(overview.activeRepoCount).toBe(2)  // repo1 + repo2
      expect(overview.sleepStarsCount).toBe(1)  // repo3
      expect(overview.hiddenGemsCount).toBe(2)  // repo1 + repo2
      // gemRepos: BETWEEN 50 AND 10000 且活跃 → repo1(100) + repo2(500)，按 stars DESC → repo2 在前
      expect(overview.gemRepos).toHaveLength(2)
      expect(overview.gemRepos[0].full_name).toBe('repo/mid-star')
    })
  })

  // ===== queryGlobalOverview 自定义 sleepDays =====
  describe('queryGlobalOverview 自定义 sleepDays', () => {
    it('sleepDays=30 时仅 10 天内的仓库活跃', () => {
      const overview = queryGlobalOverview(db, { sleepDays: 30 })
      expect(overview.activeRepoCount).toBe(1)
      expect(overview.sleepStarsCount).toBe(2)
      expect(overview.hiddenGemsCount).toBe(1)
      // gemRepos 也受 sleepDays 影响：仅 repo1
      expect(overview.gemRepos).toHaveLength(1)
      expect(overview.gemRepos[0].full_name).toBe('repo/active-low')
    })
  })

  // ===== queryGlobalOverview 自定义 gemStarsMax =====
  describe('queryGlobalOverview 自定义 gemStarsMax', () => {
    it('gemStarsMax=200 时仅 stars<=200 的算隐藏宝石', () => {
      const overview = queryGlobalOverview(db, { gemStarsMax: 200 })
      expect(overview.hiddenGemsCount).toBe(1)  // repo1
    })

    it('gemStarsMax=10000 时活跃仓库中 stars<=10000 都算隐藏宝石', () => {
      const overview = queryGlobalOverview(db, { gemStarsMax: 10000 })
      // 默认 90 天活跃：repo1(100) + repo2(500)，repo3(200天) 沉睡不计 → 2
      expect(overview.hiddenGemsCount).toBe(2)
    })

    it('gemStarsMax=10000 且 sleepDays=365 时全部仓库都算隐藏宝石', () => {
      const overview = queryGlobalOverview(db, { gemStarsMax: 10000, sleepDays: 365 })
      // sleepDays=365 时 repo3 也活跃，三个仓库 stars 都 <= 10000 → 3
      expect(overview.hiddenGemsCount).toBe(3)
    })
  })

  // ===== queryGlobalOverview 自定义 gemStarsMin（仅影响 gemRepos） =====
  describe('queryGlobalOverview 自定义 gemStarsMin', () => {
    it('gemStarsMin=200 时仅 stars>=200 的进 gemRepos', () => {
      const overview = queryGlobalOverview(db, { gemStarsMin: 200 })
      // BETWEEN 200 AND 10000 且活跃 → repo2(500) = 1
      expect(overview.gemRepos).toHaveLength(1)
      expect(overview.gemRepos[0].full_name).toBe('repo/mid-star')
      // hiddenGemsCount 不受 gemStarsMin 影响，仍是默认 gemStarsMax=1000
      expect(overview.hiddenGemsCount).toBe(2)
    })
  })

  // ===== queryActiveRepoCount 自定义 sleepDays =====
  describe('queryActiveRepoCount 自定义 sleepDays', () => {
    it('默认 90 天阈值', () => {
      expect(queryActiveRepoCount(db, TEST_USER)).toBe(2)
    })

    it('sleepDays=30 时仅 1 个活跃', () => {
      expect(queryActiveRepoCount(db, TEST_USER, { sleepDays: 30 })).toBe(1)
    })

    it('sleepDays=365 时全部活跃', () => {
      expect(queryActiveRepoCount(db, TEST_USER, { sleepDays: 365 })).toBe(3)
    })

    it('无 userLogin 时默认 90 天阈值（全库）', () => {
      expect(queryActiveRepoCount(db)).toBe(2)
    })
  })
})
