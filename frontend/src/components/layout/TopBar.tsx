/**
 * TopBar 组件 - 顶部应用栏
 * 玻璃态效果，包含搜索、导航和右侧开发者信息/主题切换/语言下拉框
 */
import { useState, useEffect } from "react"
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
  const [searchQuery, setSearchQuery] = useState("")

  const currentLang = languages.find((l) => l.code === lang) ?? languages[0]
  const searchResults = [
    { name: "microsoft/markitdown", meta: "匹配仓库 · 文档处理" },
    { name: "modelcontextprotocol/servers", meta: "匹配仓库 · MCP" },
    { name: "astral-sh/uv", meta: "匹配仓库 · Python 工具链" },
  ].filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))

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
            placeholder="搜索仓库"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-10 w-64 bg-surface-container-lowest border-outline-variant text-sm font-sans"
          />
          {searchQuery && (
            <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-outline-variant bg-surface-container-lowest p-2 shadow-lg">
              <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">搜索结果</div>
              {searchResults.length > 0 ? (
                searchResults.map((item) => (
                  <button key={item.name} className="block w-full rounded-md px-2 py-2 text-left hover:bg-surface-container">
                    <div className="text-sm font-medium text-on-surface">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.meta}</div>
                  </button>
                ))
              ) : (
                <div className="px-2 py-3 text-sm text-muted-foreground">没有匹配仓库</div>
              )}
            </div>
          )}
        </div>
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
