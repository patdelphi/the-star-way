/**
 * Sidebar 组件 - 固定侧边栏导航
 * 桌面端显示固定侧边栏，移动端使用 Sheet 抽屉
 */
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  Users,
  Compass,
  LineChart,
  Settings,
  Terminal,
  Menu,
  Star,
  LayoutDashboard,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet"

const navGroups = [
  {
    titleKey: "nav.groupOverview",
    items: [
      { path: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
      { path: "/developers", icon: Users, labelKey: "nav.developers" },
    ],
  },
  {
    titleKey: "nav.groupBrowse",
    items: [
      { path: "/explorer", icon: Compass, labelKey: "nav.starExplorer" },
      { path: "/catalog", icon: FileText, labelKey: "nav.starCatalog" },
    ],
  },
  {
    titleKey: "nav.groupAnalysis",
    items: [
      { path: "/analysis", icon: LineChart, labelKey: "nav.repoAnalysis" },
    ],
  },
  {
    titleKey: "nav.groupSystem",
    items: [
      { path: "/settings", icon: Settings, labelKey: "nav.settings" },
    ],
  },
]

// 底部外链：仅保留 GitHub 项目链接（新窗口打开）
const footerLinks = [
  { url: "https://github.com/patdelphi/the-star-way", icon: Terminal, labelKey: "nav.github" },
]

function SidebarContent() {
  const location = useLocation()
  const { t } = useTranslation()

  return (
    <div className="flex flex-col h-full py-8">
      {/* Brand */}
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant shrink-0 bg-primary p-1 flex items-center justify-center">
          <Star className="w-5 h-5 text-on-primary" />
        </div>
        <div>
          <h1 className="font-semibold text-lg text-primary tracking-tight leading-tight font-sans">
            {t('app.title')}
          </h1>
          <p className="text-sm text-on-surface-variant font-sans">
            {t('app.subtitle')}
          </p>
        </div>
      </div>

      {/* Main Nav */}
      <div className="flex-1 px-4 flex flex-col gap-1">
        {navGroups.map((group) => (
          <div key={group.titleKey} className="flex flex-col gap-1 mb-2">
            <span className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t(group.titleKey)}
            </span>
            {group.items.map((item) => {
              const isActive = location.pathname === item.path
              const Icon = item.icon
              return (
                <Link
                  key={item.labelKey}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors duration-200",
                    isActive
                      ? "text-primary font-bold border-r-2 border-primary bg-surface-container"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-primary"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-sans text-sm tracking-wide">
                    {t(item.labelKey)}
                  </span>
                </Link>
              )
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 mt-auto flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          {footerLinks.map((item) => {
            const Icon = item.icon
            return (
              <a
                key={item.labelKey}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-2 rounded-lg text-on-surface-variant font-medium hover:bg-surface-container hover:text-primary transition-colors duration-200"
              >
                <Icon className="w-4 h-4" />
                <span className="font-sans text-sm tracking-wider">
                  {t(item.labelKey)}
                </span>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="hidden md:flex flex-col w-[280px] h-screen fixed left-0 top-0 bg-surface border-r border-outline-variant z-40">
        <SidebarContent />
      </nav>

      {/* Mobile Sheet */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="bg-surface/80 backdrop-blur-xl border-outline-variant"
            >
              <Menu className="w-5 h-5 text-on-surface" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0">
            <SheetClose asChild>
              <div className="h-full">
                <SidebarContent />
              </div>
            </SheetClose>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
