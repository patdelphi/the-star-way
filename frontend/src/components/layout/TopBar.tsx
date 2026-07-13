/**
 * TopBar 组件 - 顶部应用栏
 * 玻璃态效果，包含搜索、导航和右侧开发者信息/主题切换/语言下拉框
 */
import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Search, Sun, Moon, Monitor, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDeveloper } from "@/contexts/DeveloperContext"
import { getRepos, type Repo } from "@/lib/api"
import { getSettings, saveSettings, applyTheme } from "@/lib/settings"

function useTheme() {
  // 主题三态：light / dark / auto（跟随系统），从统一设置读取
  const [theme, setTheme] = useState<"light" | "dark" | "auto">(() => getSettings().theme)

  useEffect(() => {
    applyTheme(theme)
    saveSettings({ theme })
    // auto 模式监听系统主题变化，切换时自动跟随
    if (theme === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = () => applyTheme("auto")
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    }
  }, [theme])

  // 三态循环：light → dark → auto → light
  const cycleTheme = () => setTheme((t) => (t === "light" ? "dark" : t === "dark" ? "auto" : "light"))
  return { theme, cycleTheme }
}

// 语言列表：label 使用该语言的自称（永远显示原文，不随当前 UI 语言变化）
const languages = [
  { code: "zh-CN", label: "中文" },
  { code: "en-US", label: "English" },
]

export function TopBar() {
  const { theme, cycleTheme } = useTheme()
  const { t, i18n } = useTranslation()
  const { currentLogin } = useDeveloper()
  const navigate = useNavigate()
  const [langOpen, setLangOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Repo[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // 搜索防抖
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    searchTimerRef.current = setTimeout(async () => {
      try {
        const result = await getRepos(currentLogin, { q: searchQuery.trim(), pageSize: 8 })
        setSearchResults(result.items)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [searchQuery, currentLogin])

  // 点击外部关闭搜索结果
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelectRepo = (repo: Repo) => {
    navigate(`/analysis?repo=${encodeURIComponent(repo.full_name)}`)
    setSearchQuery("")
    setSearchResults([])
    setSearchFocused(false)
  }

  // 从 i18n 当前语言映射到下拉选项
  const currentLangCode = i18n.language?.startsWith('zh') ? 'zh-CN' : 'en-US'
  const currentLang = languages.find((l) => l.code === currentLangCode) ?? languages[0]

  const handleLangChange = (code: string) => {
    const language = code === 'en-US' ? 'en-US' : 'zh-CN'
    saveSettings({ language })
    i18n.changeLanguage(language)
    setLangOpen(false)
  }

  return (
    <header className="flex justify-between items-center w-full px-4 md:px-6 h-16 bg-surface/80 backdrop-blur-xl border-b border-outline-variant sticky top-0 z-30">
      <div className="flex items-center gap-4 md:gap-6 ml-12 md:ml-0">
        {/* Mobile Brand */}
        <div className="md:hidden font-semibold text-lg text-primary tracking-tight font-sans">
          {t('app.title')}
        </div>

        {/* Search */}
        <div className="relative hidden sm:block" ref={searchContainerRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <Input
            placeholder={t('topBar.searchPlaceholder')}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            className="pl-10 w-64 bg-surface-container-lowest border-outline-variant text-sm font-sans"
          />
          {searchFocused && searchQuery.trim() && (
            <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-outline-variant bg-surface-container-lowest p-2 shadow-lg">
              <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">{t('topBar.searchResults')}</div>
              {searchLoading ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((repo) => (
                  <button
                    key={repo.full_name}
                    className="block w-full rounded-md px-2 py-2 text-left hover:bg-surface-container"
                    onClick={() => handleSelectRepo(repo)}
                  >
                    <div className="text-sm font-medium text-on-surface truncate">{repo.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{repo.description ?? repo.language ?? ''}</div>
                  </button>
                ))
              ) : (
                <div className="px-2 py-3 text-sm text-muted-foreground">{t('topBar.noResults')}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right side: Developer name + Theme toggle + Language dropdown */}
      <div className="flex items-center gap-3">
        {/* Developer name */}
        <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant text-sm font-sans text-on-surface tracking-wide">
          @{currentLogin}
        </span>

        {/* Theme toggle: light → dark → auto → light 三态循环 */}
        <Button
          variant="ghost"
          size="icon"
          className="text-on-surface-variant hover:text-primary"
          onClick={cycleTheme}
          title={
            theme === "light" ? t('topBar.switchDark')
            : theme === "dark" ? t('topBar.switchAuto')
            : t('topBar.switchLight')
          }
        >
          {theme === "light" ? (
            <Moon className="w-5 h-5" />
          ) : theme === "dark" ? (
            <Monitor className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
        </Button>

        {/* Language dropdown */}
        <div className="relative">
          <Button
            variant="ghost"
            className="text-on-surface-variant hover:text-primary font-sans text-sm tracking-wider gap-1.5"
            onClick={() => setLangOpen(!langOpen)}
          >
            <span aria-hidden>🌐</span>
            {currentLang.label}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${langOpen ? "rotate-180" : ""}`} />
          </Button>

          {/* Dropdown menu */}
          {langOpen && (
            <>
              {/* 遮罩关闭 */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setLangOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[120px] rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg py-1">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    className={`w-full text-left px-4 py-2 text-sm font-sans transition-colors ${
                      l.code === currentLang.code
                        ? "text-primary bg-surface-container font-medium"
                        : "text-on-surface-variant hover:bg-surface-container hover:text-primary"
                    }`}
                    onClick={() => handleLangChange(l.code)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
