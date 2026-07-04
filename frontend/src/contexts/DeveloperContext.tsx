/**
 * DeveloperContext.tsx
 * 维护当前选中的 GitHub 开发者，用于星标仓库、单个仓库和仓库详情页面共享查询上下文。
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

const STORAGE_KEY = "starway-current-login"
const DEFAULT_LOGIN = "patdelphi"

type DeveloperContextValue = {
  currentLogin: string
  setCurrentLogin: (login: string) => void
}

const DeveloperContext = createContext<DeveloperContextValue | null>(null)

export function DeveloperProvider({ children }: { children: ReactNode }) {
  const [currentLogin, setCurrentLoginState] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_LOGIN
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored && stored !== "demo-user" ? stored : DEFAULT_LOGIN
  })

  const setCurrentLogin = (login: string) => {
    const normalized = login.trim()
    const safeLogin = normalized === "demo-user" ? DEFAULT_LOGIN : normalized
    setCurrentLoginState(safeLogin)
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, safeLogin)
    }
  }

  const value = useMemo(() => ({ currentLogin, setCurrentLogin }), [currentLogin])

  return <DeveloperContext.Provider value={value}>{children}</DeveloperContext.Provider>
}

export function useDeveloper() {
  const context = useContext(DeveloperContext)
  if (!context) {
    throw new Error("useDeveloper must be used within DeveloperProvider")
  }
  return context
}
