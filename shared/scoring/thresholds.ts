/**
 * 业务阈值口径（Sleep Stars / Hidden Gems）
 * 运行时无关的纯常量和纯函数
 * Node 后端和 Cloudflare Worker 共用
 */

// 活跃阈值：90 天（毫秒）
export const ACTIVE_DAYS_MS = 90 * 24 * 60 * 60 * 1000

// Hidden Gems stars 上限
export const GEM_STARS_MAX = 1000

// Gem 筛选范围
export const GEM_STARS_MIN = 50
export const GEM_STARS_UPPER = 10000

// 前端可配置范围（settings 页面校验）
export const SLEEP_DAYS_RANGE = { min: 30, max: 365 } as const
export const GEM_STARS_MIN_RANGE = { min: 0, max: 10000 } as const
export const GEM_STARS_MAX_RANGE = { min: 1, max: 50000 } as const

/**
 * 业务阈值可选项
 * 由前端 settings 透传，无值时回退到默认常量，保证向后兼容
 */
export interface ThresholdOptions {
  sleepDays?: number    // 沉睡星标判定天数，默认 90
  gemStarsMin?: number  // gemRepos stars 下限，默认 GEM_STARS_MIN
  gemStarsMax?: number  // hiddenGemsCount stars 上限，默认 GEM_STARS_MAX
}

/**
 * 解析阈值 options，非法或缺失时回退到默认常量
 * @param options 业务阈值可选项
 * @returns 解析后的 sleepMs / gemStarsMin / gemStarsMax
 */
export function resolveThresholds(options?: ThresholdOptions) {
  const sleepDays = options?.sleepDays
  const sleepMs = typeof sleepDays === 'number' && Number.isFinite(sleepDays) && sleepDays > 0
    ? sleepDays * 24 * 60 * 60 * 1000
    : ACTIVE_DAYS_MS
  const gemStarsMax = typeof options?.gemStarsMax === 'number' && Number.isFinite(options.gemStarsMax) && options.gemStarsMax > 0
    ? options.gemStarsMax
    : GEM_STARS_MAX
  const gemStarsMin = typeof options?.gemStarsMin === 'number' && Number.isFinite(options.gemStarsMin) && options.gemStarsMin >= 0
    ? options.gemStarsMin
    : GEM_STARS_MIN
  return { sleepMs, gemStarsMin, gemStarsMax }
}

/**
 * 校验单个阈值参数是否在允许范围内
 */
export function isValidSleepDays(value: number): boolean {
  return Number.isInteger(value) && value >= SLEEP_DAYS_RANGE.min && value <= SLEEP_DAYS_RANGE.max
}
export function isValidGemStarsMin(value: number): boolean {
  return Number.isInteger(value) && value >= GEM_STARS_MIN_RANGE.min && value <= GEM_STARS_MIN_RANGE.max
}
export function isValidGemStarsMax(value: number): boolean {
  return Number.isInteger(value) && value >= GEM_STARS_MAX_RANGE.min && value <= GEM_STARS_MAX_RANGE.max
}
