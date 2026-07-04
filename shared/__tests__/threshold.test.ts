/**
 * 阈值口径纯函数测试
 * 验证 resolveThresholds 和校验函数的行为
 */
import { describe, it, expect } from 'vitest'
import {
  ACTIVE_DAYS_MS,
  GEM_STARS_MAX,
  GEM_STARS_MIN,
  GEM_STARS_UPPER,
  SLEEP_DAYS_RANGE,
  GEM_STARS_MIN_RANGE,
  GEM_STARS_MAX_RANGE,
  resolveThresholds,
  isValidSleepDays,
  isValidGemStarsMin,
  isValidGemStarsMax,
} from '../scoring/thresholds.js'

describe('阈值常量', () => {
  it('ACTIVE_DAYS_MS 应为 90 天', () => {
    expect(ACTIVE_DAYS_MS).toBe(90 * 24 * 60 * 60 * 1000)
  })

  it('GEM_STARS 常量应正确', () => {
    expect(GEM_STARS_MAX).toBe(1000)
    expect(GEM_STARS_MIN).toBe(50)
    expect(GEM_STARS_UPPER).toBe(10000)
  })

  it('范围常量应正确', () => {
    expect(SLEEP_DAYS_RANGE).toEqual({ min: 30, max: 365 })
    expect(GEM_STARS_MIN_RANGE).toEqual({ min: 0, max: 10000 })
    expect(GEM_STARS_MAX_RANGE).toEqual({ min: 1, max: 50000 })
  })
})

describe('resolveThresholds', () => {
  it('无 options 时应回退默认值', () => {
    const r = resolveThresholds()
    expect(r.sleepMs).toBe(ACTIVE_DAYS_MS)
    expect(r.gemStarsMin).toBe(GEM_STARS_MIN)
    expect(r.gemStarsMax).toBe(GEM_STARS_MAX)
  })

  it('空对象应回退默认值', () => {
    const r = resolveThresholds({})
    expect(r.sleepMs).toBe(ACTIVE_DAYS_MS)
  })

  it('合法 sleepDays 应正确计算 sleepMs', () => {
    const r = resolveThresholds({ sleepDays: 30 })
    expect(r.sleepMs).toBe(30 * 24 * 60 * 60 * 1000)
  })

  it('合法 gemStarsMax 应覆盖默认', () => {
    const r = resolveThresholds({ gemStarsMax: 5000 })
    expect(r.gemStarsMax).toBe(5000)
  })

  it('合法 gemStarsMin 应覆盖默认', () => {
    const r = resolveThresholds({ gemStarsMin: 200 })
    expect(r.gemStarsMin).toBe(200)
  })

  it('全部合法参数应全部覆盖', () => {
    const r = resolveThresholds({ sleepDays: 180, gemStarsMin: 100, gemStarsMax: 2000 })
    expect(r.sleepMs).toBe(180 * 24 * 60 * 60 * 1000)
    expect(r.gemStarsMin).toBe(100)
    expect(r.gemStarsMax).toBe(2000)
  })

  it('非法 sleepDays（NaN/负数/Infinity）应回退默认', () => {
    expect(resolveThresholds({ sleepDays: NaN as any }).sleepMs).toBe(ACTIVE_DAYS_MS)
    expect(resolveThresholds({ sleepDays: -1 as any }).sleepMs).toBe(ACTIVE_DAYS_MS)
    expect(resolveThresholds({ sleepDays: Infinity as any }).sleepMs).toBe(ACTIVE_DAYS_MS)
  })

  it('非法 gemStarsMax（0/负数/NaN）应回退默认', () => {
    expect(resolveThresholds({ gemStarsMax: 0 }).gemStarsMax).toBe(GEM_STARS_MAX)
    expect(resolveThresholds({ gemStarsMax: -1 as any }).gemStarsMax).toBe(GEM_STARS_MAX)
  })

  it('非法 gemStarsMin（负数/NaN）应回退默认', () => {
    expect(resolveThresholds({ gemStarsMin: -1 as any }).gemStarsMin).toBe(GEM_STARS_MIN)
  })

  it('gemStarsMin=0 应被接受', () => {
    expect(resolveThresholds({ gemStarsMin: 0 }).gemStarsMin).toBe(0)
  })
})

describe('校验函数', () => {
  it('isValidSleepDays 应正确校验范围', () => {
    expect(isValidSleepDays(30)).toBe(true)
    expect(isValidSleepDays(365)).toBe(true)
    expect(isValidSleepDays(90)).toBe(true)
    expect(isValidSleepDays(29)).toBe(false)
    expect(isValidSleepDays(366)).toBe(false)
    expect(isValidSleepDays(50.5)).toBe(false)
    expect(isValidSleepDays(NaN)).toBe(false)
  })

  it('isValidGemStarsMin 应正确校验范围', () => {
    expect(isValidGemStarsMin(0)).toBe(true)
    expect(isValidGemStarsMin(10000)).toBe(true)
    expect(isValidGemStarsMin(50)).toBe(true)
    expect(isValidGemStarsMin(-1)).toBe(false)
    expect(isValidGemStarsMin(10001)).toBe(false)
  })

  it('isValidGemStarsMax 应正确校验范围', () => {
    expect(isValidGemStarsMax(1)).toBe(true)
    expect(isValidGemStarsMax(50000)).toBe(true)
    expect(isValidGemStarsMax(1000)).toBe(true)
    expect(isValidGemStarsMax(0)).toBe(false)
    expect(isValidGemStarsMax(50001)).toBe(false)
  })
})
