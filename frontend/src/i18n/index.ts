/**
 * i18next 初始化配置
 * 支持中英文切换，语言偏好统一存储到 starway-settings（见 settings.ts）
 * 启动时从 settings 读取语言：'auto' 模式跟随 navigator.language，否则用指定语言
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhCN from './locales/zh-CN.json'
import enUS from './locales/en-US.json'
import { getSettings, resolveLanguage } from '@/lib/settings'

// 启动时确定初始语言：settings.language 为 'auto' 时跟随系统，否则用指定值
const initialLng = resolveLanguage(getSettings())

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    'en-US': { translation: enUS },
  },
  lng: initialLng,
  fallbackLng: 'zh-CN',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
