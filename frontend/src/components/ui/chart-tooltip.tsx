/**
 * 统一图表 Tooltip：为 Recharts 提供同一套明暗主题样式。
 */
import type { TooltipProps } from "recharts"
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent"

export function ThemedChartTooltip({ active, label, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      {label !== undefined && (
        <div className="mb-1 font-medium text-popover-foreground">{String(label)}</div>
      )}
      <div className="space-y-1">
        {payload.map((item, index) => (
          <div key={`${String(item.name)}-${index}`} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{String(item.name ?? item.dataKey ?? "")}</span>
            <span className="font-mono font-semibold text-popover-foreground">{String(item.value ?? "")}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
