/**
 * DeveloperContext.tsx
 * 维护当前选中的 GitHub 开发者，用于星标仓库、单个仓库和仓库详情页面共享查询上下文。
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

const STORAGE_KEY = "starway-current-login"
const DEFAULT_LOGIN = "patdelphi"

/** 统一规范化跨页面共享的 GitHub login，避免 @login 旧值污染当前开发者状态。 */
function normalizeGitHubLogin(input: string): string {
  let value = input.trim()
  value = value.replace(/^https?:\/\/github\.com\//i, "")
  value = value.split(/[/?#]/)[0] || value
  return value.replace(/^@+/, "").trim()
}

type DeveloperContextValue = {
  currentLogin: string
  setCurrentLogin: (login: string) => void
}

const DeveloperContext = createContext<DeveloperContextValue | null>(null)

export function DeveloperProvider({ children }: { children: ReactNode }) {
  const [currentLogin, setCurrentLoginState] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_LOGIN
    const stored = localStorage.getItem(STORAGE_KEY)
    const normalized = stored ? normalizeGitHubLogin(stored) : ""
    return normalized && normalized !== "demo-user" ? normalized : DEFAULT_LOGIN
  })

  const setCurrentLogin = (login: string) => {
    const normalized = normalizeGitHubLogin(login)
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
