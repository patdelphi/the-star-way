/**
 * 程序说明：统一应用设置管理。
 * 所有用户偏好（超时、浏览体验、AI 行为、业务阈值、界面语言、主题、GitHub Token）
 * 统一存储到 localStorage 的 starway-settings JSON 对象中。
 * 启动时自动迁移老的分散 key（starway-github-token / starway-lang），迁移后删除老 key。
 * 通过合并默认值保证向后兼容：新增字段时自动取默认值，无需手动迁移。
 */

// 应用设置类型定义
export interface AppSettings {
  // ===== 超时类（毫秒） =====
  /** AI 生成接口超时（readme-summary / star-dna / learning-path），默认 60s */
  aiTimeout: number
  /** GitHub 同步接口超时（/api/sync，多页请求），默认 180s */
  syncTimeout: number
  /** 普通 API 超时（列表/统计等），默认 8s */
  apiTimeout: number

  // ===== 浏览体验 =====
  /** 默认每页数量，默认 20 */
  pageSize: number
  /** 默认排序字段，格式 'field:direction'，默认 'starred_at:desc' */
  defaultSort: string
  /** 界面语言：'zh-CN' | 'en-US' | 'auto'（auto 跟随 navigator） */
  language: 'zh-CN' | 'en-US' | 'auto'
  /** 主题：'light' | 'dark' | 'auto'（auto 跟随 prefers-color-scheme） */
  theme: 'light' | 'dark' | 'auto'

  // ===== AI 行为 =====
  /** 仓库详情页首次访问是否自动生成 AI 摘要，默认 true */
  autoGenSummary: boolean
  /** 点击"重新生成"按钮时是否弹出二次确认，默认 true */
  confirmForceRegen: boolean

  // ===== 业务阈值 =====
  /** Sleep Stars 沉睡阈值天数，默认 90 */
  sleepDays: number
  /** Hidden Gems stars 下限，默认 50 */
  gemStarsMin: number
  /** Hidden Gems stars 上限，默认 1000 */
  gemStarsMax: number

  // ===== GitHub Token（从老 key starway-github-token 迁移） =====
  /** GitHub Token，存浏览器 localStorage，默认空字符串 */
  githubToken: string
}

// 默认设置：所有字段在此集中声明，新增字段时自动取默认值
export const DEFAULT_SETTINGS: AppSettings = {
  aiTimeout: 60000,
  syncTimeout: 180000,
  apiTimeout: 8000,
  pageSize: 20,
  defaultSort: 'starred_at:desc',
  language: 'auto',
  theme: 'auto',
  autoGenSummary: true,
  confirmForceRegen: true,
  sleepDays: 90,
  gemStarsMin: 50,
  gemStarsMax: 1000,
  githubToken: '',
}

// 统一存储 key
const STORAGE_KEY = 'starway-settings'

// 老 key（迁移后删除）
const LEGACY_TOKEN_KEY = 'starway-github-token'
const LEGACY_LANG_KEY = 'starway-lang'

// 单例缓存：避免每次读取都解析 JSON
let cachedSettings: AppSettings | null = null
let migrated = false

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function normalizeSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    aiTimeout: clampNumber(settings.aiTimeout, DEFAULT_SETTINGS.aiTimeout, 5000, 300000),
    syncTimeout: clampNumber(settings.syncTimeout, DEFAULT_SETTINGS.syncTimeout, 10000, 600000),
    apiTimeout: clampNumber(settings.apiTimeout, DEFAULT_SETTINGS.apiTimeout, 1000, 60000),
    pageSize: clampNumber(settings.pageSize, DEFAULT_SETTINGS.pageSize, 5, 100),
    sleepDays: clampNumber(settings.sleepDays, DEFAULT_SETTINGS.sleepDays, 30, 365),
    gemStarsMin: clampNumber(settings.gemStarsMin, DEFAULT_SETTINGS.gemStarsMin, 0, 10000),
    gemStarsMax: clampNumber(settings.gemStarsMax, DEFAULT_SETTINGS.gemStarsMax, 1, 50000),
  }
}

/**
 * 一次性迁移老的分散 key 到统一 starway-settings。
 * 迁移策略：老值存在且新字段为默认值时，用老值覆盖；迁移后删除老 key。
 */
function migrateLegacyKeys(base: AppSettings): AppSettings {
  if (migrated) return base
  migrated = true

  // 1. GitHub Token 迁移
  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY)
  if (legacyToken && !base.githubToken) {
    base = { ...base, githubToken: legacyToken }
  }
  if (legacyToken !== null) {
    localStorage.removeItem(LEGACY_TOKEN_KEY)
  }

  // 2. 语言偏好迁移：老 key 是 'zh-CN'/'en-US'，新字段默认 'auto'
  // 仅当老 key 存在且新字段仍为默认 'auto' 时迁移，避免覆盖用户已选的新值
  const legacyLang = localStorage.getItem(LEGACY_LANG_KEY)
  if (legacyLang && base.language === 'auto') {
    if (legacyLang.startsWith('en')) {
      base = { ...base, language: 'en-US' }
    } else if (legacyLang.startsWith('zh')) {
      base = { ...base, language: 'zh-CN' }
    }
  }
  if (legacyLang !== null) {
    localStorage.removeItem(LEGACY_LANG_KEY)
  }

  return base
}

/**
 * 读取完整设置：合并 localStorage 存储值与默认值。
 * 首次调用时执行老 key 迁移。
 */
export function getSettings(): AppSettings {
  if (cachedSettings) return cachedSettings

  let stored: Partial<AppSettings> = {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) stored = JSON.parse(raw) as Partial<AppSettings>
  } catch {
    // JSON 解析失败时回退到默认值
    stored = {}
  }

  // 合并默认值 + 存储值（存储值优先）
  let merged: AppSettings = { ...DEFAULT_SETTINGS, ...stored }

  // 迁移老 key（仅执行一次）
  merged = normalizeSettings(migrateLegacyKeys(merged))

  // 持久化合并后的结果（包含迁移后的值），保证下次读取一致
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // localStorage 满或禁用时忽略，内存中仍可用
  }

  cachedSettings = merged
  return merged
}

/**
 * 保存部分设置：合并写入，返回更新后的完整设置。
 */
export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const next: AppSettings = normalizeSettings({ ...current, ...partial })
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 写入失败时仍更新内存缓存，保证当前会话可用
  }
  cachedSettings = next
  return next
}

/**
 * 重置为默认值，清除所有用户设置（包括迁移来的 Token）。
 */
export function resetSettings(): AppSettings {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 忽略
  }
  cachedSettings = { ...DEFAULT_SETTINGS }
  return cachedSettings
}

/**
 * 读取单个字段。
 */
export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return getSettings()[key]
}

/**
 * 解析界面语言：'auto' 模式根据 navigator.language 判定，否则直接返回。
 */
export function resolveLanguage(settings: AppSettings): 'zh-CN' | 'en-US' {
  if (settings.language === 'auto') {
    return navigator.language?.startsWith('en') ? 'en-US' : 'zh-CN'
  }
  return settings.language
}

/**
 * 应用主题到 documentElement：light/dark 直接切换，auto 跟随 prefers-color-scheme。
 * @returns 实际生效的主题（'light' | 'dark'），方便 UI 显示当前状态
 */
export function applyTheme(theme: 'light' | 'dark' | 'auto'): 'light' | 'dark' {
  const isDark =
    theme === 'dark' ||
    (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
  return isDark ? 'dark' : 'light'
}
