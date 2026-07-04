/**
 * Settings.tsx
 * 设置页 - 管理本地前端偏好，并显示后端、GitHub Token、AI API 的真实状态。
 * 所有设置 onChange 即保存，提供"重置为默认值"。
 */
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import {
  Server,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  Globe,
  Bot,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react"
import { getServiceStatus, type ServiceStatus } from "@/lib/api"
import {
  getSettings,
  saveSettings,
  resetSettings,
  applyTheme,
  resolveLanguage,
  type AppSettings,
} from "@/lib/settings"

const API_BASE = import.meta.env.VITE_API_BASE || ""

// 数字夹紧到 [min, max]
function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

/**
 * 数字输入组件：内部用本地 state 管理输入显示，onBlur 时 clamp 并 commit。
 * 避免输入过程中被实时 clamp 导致体验问题（如输入 100 中间态被截断为 30）。
 */
function NumberInput({
  value,
  onCommit,
  min,
  max,
  step,
  className,
}: {
  value: number
  onCommit: (v: number) => void
  min: number
  max: number
  step?: number
  className?: string
}) {
  const [display, setDisplay] = useState(String(value))
  // 外部值变化（如重置）时同步显示
  useEffect(() => {
    setDisplay(String(value))
  }, [value])
  return (
    <Input
      type="number"
      value={display}
      onChange={(e) => setDisplay(e.target.value)}
      onBlur={() => {
        const num = Number(display)
        if (!Number.isFinite(num)) {
          setDisplay(String(value))
          return
        }
        const clamped = clamp(num, min, max)
        setDisplay(String(clamped))
        if (clamped !== value) onCommit(clamped)
      }}
      min={min}
      max={max}
      step={step}
      className={className || "w-24"}
    />
  )
}

// 布尔开关：用 Button 变体区分开/关
function Toggle({
  value,
  onChange,
  labelOn,
  labelOff,
}: {
  value: boolean
  onChange: (v: boolean) => void
  labelOn: string
  labelOff: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={value ? labelOn : labelOff}
      className={`relative h-6 w-11 rounded-full border transition-colors ${
        value ? "border-primary bg-primary" : "border-outline-variant bg-surface-container-high"
      }`}
      onClick={() => onChange(!value)}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          value ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  )
}

export default function Settings() {
  const { t, i18n } = useTranslation()
  const [form, setForm] = useState<AppSettings>(() => getSettings())
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking")
  const [backendUserCount, setBackendUserCount] = useState<number | null>(null)
  const [backendError, setBackendError] = useState<string>("")
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null)

  const checkBackend = async () => {
    setBackendStatus("checking")
    try {
      const res = await fetch(`${API_BASE}/api/users`, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const data = await res.json()
        const users = data.data || []
        setBackendStatus("online")
        setBackendUserCount(Array.isArray(users) ? users.length : 0)
        setBackendError("")
      } else {
        setBackendStatus("offline")
        setBackendUserCount(null)
        setBackendError(`HTTP ${res.status}`)
      }
    } catch {
      setBackendStatus("offline")
      setBackendUserCount(null)
      setBackendError(t("settings.offline"))
    }
  }

  const loadServiceStatus = async () => {
    const status = await getServiceStatus()
    setServiceStatus(status)
  }

  // 临时通知（2 秒后消失）
  const showNotice = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(null), 2000)
  }

  // Select/Toggle 类字段：onChange 即保存
  const updateField = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setError(null)
    const next = { ...form, [key]: value }
    setForm(next)
    saveSettings({ [key]: value })
    showNotice(t("settings.common.saved"))
    // 语言切换同步 i18n
    if (key === "language") {
      i18n.changeLanguage(resolveLanguage(next))
    }
    // 主题切换同步 documentElement
    if (key === "theme") {
      applyTheme(value as "light" | "dark" | "auto")
    }
  }

  // 数字字段：onBlur commit（NumberInput 已 clamp），含阈值交叉校验
  const commitNumber = (key: keyof AppSettings, value: number) => {
    if (key === "gemStarsMin" && value >= form.gemStarsMax) {
      setError(t("settings.thresholds.invalidRange"))
      return
    }
    if (key === "gemStarsMax" && value <= form.gemStarsMin) {
      setError(t("settings.thresholds.invalidRange"))
      return
    }
    setError(null)
    setForm({ ...form, [key]: value })
    saveSettings({ [key]: value } as Partial<AppSettings>)
    showNotice(t("settings.common.saved"))
  }

  // 重置为默认值
  const handleReset = () => {
    if (!window.confirm(t("settings.reset.confirmDesc"))) return
    const defaults = resetSettings()
    setForm(defaults)
    setError(null)
    applyTheme(defaults.theme)
    i18n.changeLanguage(resolveLanguage(defaults))
    showNotice(t("settings.reset.done"))
  }

  useEffect(() => {
    checkBackend()
    loadServiceStatus()
  }, [])

  // 排序选项
  const sortOptions = [
    { value: "starred_at:desc", label: t("settings.browsing.sortStarredDesc") },
    { value: "stars:desc", label: t("settings.browsing.sortStarsDesc") },
    { value: "pushed_at:desc", label: t("settings.browsing.sortPushedDesc") },
    { value: "full_name:asc", label: t("settings.browsing.sortNameAsc") },
  ]

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

      {/* 临时通知 */}
      {notice && (
        <div className="fixed top-20 right-6 z-50 rounded-lg bg-status-safe text-white px-4 py-2 text-sm shadow-lg">
          {notice}
        </div>
      )}

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
            {backendStatus === "online" && backendUserCount !== null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("settings.backendUsers")}</span>
                <span className="text-xs text-muted-foreground">{t("settings.onlineUsers", { count: backendUserCount })}</span>
              </div>
            )}
            {backendStatus === "offline" && backendError && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("settings.error")}</span>
                <span className="text-xs text-muted-foreground">{backendError}</span>
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={checkBackend}>
              <RefreshCw className="h-4 w-4" />
              {t("settings.reCheck")}
            </Button>
          </CardContent>
        </Card>

        {/* 服务状态 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              {t("settings.serviceStatus.title")}
            </CardTitle>
            <CardDescription>{t("settings.serviceStatus.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("settings.serviceStatus.githubToken")}</span>
              <Badge variant={serviceStatus?.github.valid ? "secondary" : "outline"} className="font-mono text-xs">
                {serviceStatus?.github.valid
                  ? t("settings.serviceStatus.valid")
                  : serviceStatus?.github.configured
                    ? t("settings.serviceStatus.invalid")
                    : t("settings.serviceStatus.notConfigured")}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("settings.serviceStatus.githubSource")}</span>
              <span className="text-xs text-muted-foreground">{serviceStatus?.github.source || t("settings.serviceStatus.none")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("settings.serviceStatus.aiApi")}</span>
              <Badge variant={serviceStatus?.ai.valid ? "secondary" : "outline"} className="font-mono text-xs">
                {serviceStatus?.ai.valid
                  ? t("settings.serviceStatus.valid")
                  : serviceStatus?.ai.configured
                    ? t("settings.serviceStatus.invalid")
                    : t("settings.serviceStatus.notConfigured")}
              </Badge>
            </div>
            {(serviceStatus?.github.message || serviceStatus?.ai.message) && (
              <p className="text-xs text-muted-foreground">
                {serviceStatus?.github.message || serviceStatus?.ai.message}
              </p>
            )}
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={loadServiceStatus}>
              <RefreshCw className="h-4 w-4" />
              {t("settings.reCheck")}
            </Button>
          </CardContent>
        </Card>

        {/* ===== 以下为新增的可调整设置卡片 ===== */}

        {/* API 超时设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              {t("settings.timeouts.title")}
            </CardTitle>
            <CardDescription>{t("settings.timeouts.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* AI 生成超时：显示秒，存储毫秒 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-on-surface">{t("settings.timeouts.ai")}</span>
                <div className="flex items-center gap-1.5">
                  <NumberInput
                    value={form.aiTimeout / 1000}
                    onCommit={(v) => commitNumber("aiTimeout", v * 1000)}
                    min={30}
                    max={180}
                    step={10}
                  />
                  <span className="text-xs text-muted-foreground">{t("settings.timeouts.seconds")}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("settings.timeouts.aiDesc")}</p>
            </div>
            {/* 同步超时 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-on-surface">{t("settings.timeouts.sync")}</span>
                <div className="flex items-center gap-1.5">
                  <NumberInput
                    value={form.syncTimeout / 1000}
                    onCommit={(v) => commitNumber("syncTimeout", v * 1000)}
                    min={60}
                    max={600}
                    step={30}
                  />
                  <span className="text-xs text-muted-foreground">{t("settings.timeouts.seconds")}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("settings.timeouts.syncDesc")}</p>
            </div>
            {/* 普通 API 超时 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-on-surface">{t("settings.timeouts.api")}</span>
                <div className="flex items-center gap-1.5">
                  <NumberInput
                    value={form.apiTimeout / 1000}
                    onCommit={(v) => commitNumber("apiTimeout", v * 1000)}
                    min={3}
                    max={30}
                    step={1}
                  />
                  <span className="text-xs text-muted-foreground">{t("settings.timeouts.seconds")}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("settings.timeouts.apiDesc")}</p>
            </div>
          </CardContent>
        </Card>

        {/* 浏览体验 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5 text-primary" />
              {t("settings.browsing.title")}
            </CardTitle>
            <CardDescription>{t("settings.browsing.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-surface">{t("settings.browsing.pageSize")}</span>
              <Select
                value={String(form.pageSize)}
                onChange={(e) => updateField("pageSize", Number(e.target.value))}
                className="w-28"
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-surface">{t("settings.browsing.defaultSort")}</span>
              <Select
                value={form.defaultSort}
                onChange={(e) => updateField("defaultSort", e.target.value)}
                className="w-44"
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-surface">{t("settings.browsing.language")}</span>
              <Select
                value={form.language}
                onChange={(e) => updateField("language", e.target.value as AppSettings["language"])}
                className="w-32"
              >
                <option value="auto">{t("settings.browsing.langAuto")}</option>
                <option value="zh-CN">{t("settings.browsing.langZh")}</option>
                <option value="en-US">{t("settings.browsing.langEn")}</option>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-surface">{t("settings.browsing.theme")}</span>
              <Select
                value={form.theme}
                onChange={(e) => updateField("theme", e.target.value as AppSettings["theme"])}
                className="w-32"
              >
                <option value="auto">{t("settings.browsing.themeAuto")}</option>
                <option value="light">{t("settings.browsing.themeLight")}</option>
                <option value="dark">{t("settings.browsing.themeDark")}</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* AI 行为 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5 text-primary" />
              {t("settings.aiBehavior.title")}
            </CardTitle>
            <CardDescription>{t("settings.aiBehavior.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-on-surface">{t("settings.aiBehavior.autoGenSummary")}</span>
                <Toggle
                  value={form.autoGenSummary}
                  onChange={(v) => updateField("autoGenSummary", v)}
                  labelOn={t("settings.common.on")}
                  labelOff={t("settings.common.off")}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t("settings.aiBehavior.autoGenSummaryDesc")}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-on-surface">{t("settings.aiBehavior.confirmForceRegen")}</span>
                <Toggle
                  value={form.confirmForceRegen}
                  onChange={(v) => updateField("confirmForceRegen", v)}
                  labelOn={t("settings.common.on")}
                  labelOff={t("settings.common.off")}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t("settings.aiBehavior.confirmForceRegenDesc")}</p>
            </div>
          </CardContent>
        </Card>

        {/* 业务阈值 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              {t("settings.thresholds.title")}
            </CardTitle>
            <CardDescription>{t("settings.thresholds.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-on-surface">{t("settings.thresholds.sleepDays")}</span>
                <NumberInput
                  value={form.sleepDays}
                  onCommit={(v) => commitNumber("sleepDays", v)}
                  min={30}
                  max={365}
                  step={1}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t("settings.thresholds.sleepDaysDesc")}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-on-surface">{t("settings.thresholds.gemStarsMin")}</span>
                <NumberInput
                  value={form.gemStarsMin}
                  onCommit={(v) => commitNumber("gemStarsMin", v)}
                  min={0}
                  max={100000}
                  step={10}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-on-surface">{t("settings.thresholds.gemStarsMax")}</span>
                <NumberInput
                  value={form.gemStarsMax}
                  onCommit={(v) => commitNumber("gemStarsMax", v)}
                  min={0}
                  max={100000}
                  step={100}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t("settings.thresholds.gemStarsDesc")}</p>
            </div>
            {error && (
              <p className="text-xs text-status-danger">{error}</p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 重置区 */}
      <section className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-low p-4">
        <div className="flex items-center gap-3">
          <RotateCcw className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-on-surface">{t("settings.reset.title")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.reset.confirmDesc")}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
          {t("settings.reset.button")}
        </Button>
      </section>
    </div>
  )
}
