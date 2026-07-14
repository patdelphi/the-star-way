/** 分享卡片预览与下载组件。 */
import { useMemo, useState } from "react"
import { Download, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buildShareCardSvg, downloadShareCard, type ShareCardData } from "@/lib/share-card"

interface ShareCardProps {
  data: ShareCardData
  open: boolean
  title: string
  previewLabel: string
  downloadLabel: string
  closeLabel: string
  downloadFailedLabel: string
  onClose: () => void
}

export function ShareCard({ data, open, title, previewLabel, downloadLabel, closeLabel, downloadFailedLabel, onClose }: ShareCardProps) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState("")
  const svgDataUrl = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildShareCardSvg(data))}`, [data])

  if (!open) return null

  const handleDownload = async () => {
    setDownloading(true)
    setError("")
    try {
      await downloadShareCard(data, `${data.login}-star-dna.png`)
    } catch {
      setError(downloadFailedLabel)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex max-h-[96vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant/60 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
            <p className="text-sm text-muted-foreground">{previewLabel}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={closeLabel}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex min-h-0 justify-center overflow-hidden bg-surface-container-low p-4 sm:p-6">
          <img src={svgDataUrl} alt={title} className="h-auto max-h-[calc(96vh-11rem)] w-auto max-w-full rounded-xl shadow-lg" />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-outline-variant/60 px-5 py-4">
          <p className="text-sm text-status-danger" role="alert">{error}</p>
          <Button className="ml-auto gap-2" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloadLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
