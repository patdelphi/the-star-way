/**
 * Settings.tsx
 * 设置页 - 后端连接、数据库、导出目录等配置信息
 */
import { useEffect, useState } from "react"
import { useTranslation, Trans } from "react-i18next"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Server,
  Database,
  FolderOpen,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Key,
  Eye,
  EyeOff,
} from "lucide-react"
import { getGitHubToken, setGitHubToken, clearGitHubToken, getTokenSource } from "@/lib/api"

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3210"

export default function Settings() {
  const { t } = useTranslation()
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking")
  const [backendInfo, setBackendInfo] = useState<string>("")
  const [token, setToken] = useState(getGitHubToken() || "")
  const [showToken, setShowToken] = useState(false)
  const [tokenSource, setTokenSource] = useState<{ source: string | null; hasToken: boolean; envVar: string | null } | null>(null)

  const checkBackend = async () => {
    setBackendStatus("checking")
    try {
      const res = await fetch(`${API_BASE}/api/users`, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const data = await res.json()
        const users = data.data || []
        setBackendStatus("online")
        setBackendInfo(t("settings.onlineUsers", { count: users.length }))
      } else {
        setBackendStatus("offline")
        setBackendInfo(`HTTP ${res.status}`)
      }
    } catch {
      setBackendStatus("offline")
      setBackendInfo(t("settings.offline"))
    }
  }

  const loadTokenSource = async () => {
    const source = await getTokenSource()
    setTokenSource(source)
  }

  useEffect(() => { checkBackend(); loadTokenSource() }, [])

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs uppercase tracking-wider">
              {t("nav.settings")}
            </Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-on-surface">
            {t("nav.settings")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("settings.subtitle")}
          </p>
        </div>
      </section>

      {/* 配置卡片网格 */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* 后端连接状态 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Server className="h-5 w-5 text-primary" />
              {t("settings.backendApi")}
            </CardTitle>
            <CardDescription>{t("settings.backendApiDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("settings.address")}</span>
              <code className="text-xs font-mono bg-surface-container-high px-2 py-0.5 rounded">{API_BASE}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("settings.status")}</span>
              <div className="flex items-center gap-2">
                {backendStatus === "online" ? (
                  <CheckCircle2 className="h-4 w-4 text-status-safe" />
                ) : backendStatus === "offline" ? (
                  <XCircle className="h-4 w-4 text-status-danger" />
                ) : (
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <span className="text-sm">
                  {backendStatus === "online" ? t("settings.online") : backendStatus === "offline" ? t("settings.offline") : t("settings.checking")}
                </span>
              </div>
            </div>
            {backendInfo && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("settings.info")}</span>
                <span className="text-xs text-muted-foreground">{backendInfo}</span>
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={checkBackend}>
              <RefreshCw className="h-4 w-4" />
              {t("settings.reCheck")}
            </Button>
          </CardContent>
        </Card>

        {/* 数据库 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5 text-primary" />
              {t("settings.database")}
            </CardTitle>
            <CardDescription>{t("settings.databaseDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("settings.dbType")}</span>
              <Badge variant="outline" className="font-mono text-xs">SQLite (WAL)</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("settings.dbLocation")}</span>
              <span className="text-xs text-muted-foreground truncate max-w-[180px]">backend/data/starway.db</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("settings.dbMode")}</span>
              <Badge variant="secondary" className="font-mono text-xs">Demo 数据（691 条）</Badge>
            </div>
          </CardContent>
        </Card>

        {/* GitHub Token */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Key className="h-5 w-5 text-primary" />
              {t("settings.githubToken")}
            </CardTitle>
            <CardDescription>{t("settings.githubTokenDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("settings.status")}</span>
              <Badge variant={token ? "default" : "outline"} className="font-mono text-xs">
                {token ? t("settings.tokenConfigured") : t("settings.tokenNotConfigured")}
              </Badge>
            </div>
            {tokenSource && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("settings.tokenSource")}</span>
                <div className="flex items-center gap-1.5">
                  {token ? (
                    <>
                      <Badge variant="secondary" className="text-[10px]">{t("settings.sourceBrowser")}</Badge>
                      {tokenSource.hasToken && (
                        <span className="text-[10px] text-muted-foreground">+ {tokenSource.envVar}</span>
                      )}
                    </>
                  ) : tokenSource.hasToken ? (
                    <Badge variant="secondary" className="text-[10px]">{tokenSource.envVar}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">{t("settings.sourceAnonymous")}</Badge>
                  )}
                </div>
              </div>
            )}
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-on-surface"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={() => { setGitHubToken(token); setBackendInfo(t("settings.tokenSaved")) }}
              >
                {t("settings.save")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => { clearGitHubToken(); setToken(""); setBackendInfo(t("settings.tokenCleared")) }}
              >
                {t("settings.clear")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <Trans
                i18nKey="settings.tokenHint"
                components={{
                  a: <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" />,
                  code: <code />,
                }}
              />
            </p>
          </CardContent>
        </Card>

        {/* 导出目录 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderOpen className="h-5 w-5 text-primary" />
              {t("settings.export")}
            </CardTitle>
            <CardDescription>{t("settings.exportDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("settings.exportFormats")}</span>
              <div className="flex gap-1.5">
                <Badge variant="outline" className="text-[10px]">CSV</Badge>
                <Badge variant="outline" className="text-[10px]">JSON</Badge>
                <Badge variant="outline" className="text-[10px]">Markdown</Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("settings.encoding")}</span>
              <span className="text-xs text-muted-foreground">UTF-8 BOM</span>
            </div>
          </CardContent>
        </Card>

        {/* AI 增强 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className="h-5 w-5 text-primary" />
              {t("settings.aiEnhance")}
            </CardTitle>
            <CardDescription>{t("settings.aiEnhanceDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("settings.status")}</span>
              <Badge variant="outline" className="text-xs">{t("settings.aiReady")}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("settings.aiProvider")}</span>
              <span className="text-xs text-muted-foreground">OpenAI-compatible / Ollama</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              {t("settings.aiHint")}
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
