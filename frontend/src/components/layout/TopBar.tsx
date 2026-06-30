/**
 * TopBar 组件 - 顶部应用栏
 * 玻璃态效果，包含搜索、导航和右侧开发者信息/主题切换/语言下拉框
 */
import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Search, Sun, Moon, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light"
    if (document.documentElement.classList.contains("dark")) return "dark"
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"))
  return { theme, toggleTheme }
}

// 支持的语言列表
const languages = [
  { code: "zh", label: "中文" },
  { code: "en", label: "English" },
]

export function TopBar() {
  const { theme, toggleTheme } = useTheme()
  const [lang, setLang] = useState("zh")
  const [langOpen, setLangOpen] = useState(false)

  const currentLang = languages.find((l) => l.code === lang) ?? languages[0]

  return (
    <header className="flex justify-between items-center w-full px-4 md:px-6 h-16 bg-surface/80 backdrop-blur-xl border-b border-outline-variant sticky top-0 z-30">
      <div className="flex items-center gap-4 md:gap-6 ml-12 md:ml-0">
        {/* Mobile Brand */}
        <div className="md:hidden font-semibold text-lg text-primary tracking-tight font-sans">
          Star Way
        </div>

        {/* Search */}
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <Input
            placeholder="搜索星标..."
            className="pl-10 w-64 bg-surface-container-lowest border-outline-variant text-sm font-sans"
          />
        </div>

        {/* Nav Links */}
        <nav className="hidden lg:flex gap-6">
          <Link
            to="/"
            className="text-primary border-b-2 border-primary pb-1 text-sm font-medium font-sans"
          >
            探索者
          </Link>
          <Link
            to="/catalog"
            className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium font-sans"
          >
            合集
          </Link>
        </nav>
      </div>

      {/* Right side: Developer name + Theme toggle + Language dropdown */}
      <div className="flex items-center gap-3">
        {/* Developer name */}
        <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant text-sm font-sans text-on-surface tracking-wide">
          @patdelphi
        </span>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="text-on-surface-variant hover:text-primary"
          onClick={toggleTheme}
          title={theme === "light" ? "切换至暗色模式" : "切换至亮色模式"}
        >
          {theme === "light" ? (
            <Moon className="w-5 h-5" />
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
                      l.code === lang
                        ? "text-primary bg-surface-container font-medium"
                        : "text-on-surface-variant hover:bg-surface-container hover:text-primary"
                    }`}
                    onClick={() => {
                      setLang(l.code)
                      setLangOpen(false)
                    }}
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
