import React from "react"

interface PieSlice {
  label: string
  value: number
  color: string
}

interface PieChartProps {
  data: PieSlice[]
  size?: number
  donut?: boolean
}

export const PieChart: React.FC<PieChartProps> = ({ data, size = 160, donut = true }) => {
  if (!data.length) return null

  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return null

  const radius = size / 2
  const center = radius
  const innerRadius = donut ? radius * 0.55 : 0

  let currentAngle = -Math.PI / 2 // 从顶部开始

  const slices = data.map((d) => {
    const angle = (d.value / total) * Math.PI * 2
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    const x1 = center + radius * Math.cos(startAngle)
    const y1 = center + radius * Math.sin(startAngle)
    const x2 = center + radius * Math.cos(endAngle)
    const y2 = center + radius * Math.sin(endAngle)

    const largeArc = angle > Math.PI ? 1 : 0

    let path = ""
    if (donut) {
      const ix1 = center + innerRadius * Math.cos(startAngle)
      const iy1 = center + innerRadius * Math.sin(startAngle)
      const ix2 = center + innerRadius * Math.cos(endAngle)
      const iy2 = center + innerRadius * Math.sin(endAngle)
      path = `M ${ix1} ${iy1} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`
    } else {
      path = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
    }

    return { ...d, path, pct: ((d.value / total) * 100).toFixed(1) }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {slices.map((s, i) => (
        <path
          key={i}
          d={s.path}
          fill={s.color}
          stroke="var(--color-surface-container-low)"
          strokeWidth={2}
          className="transition-opacity hover:opacity-80"
        />
      ))}
    </svg>
  )
}

export const PieChartLegend: React.FC<{ data: PieSlice[] }> = ({ data }) => {
  if (!data.length) return null
  const total = data.reduce((sum, d) => sum + d.value, 0)
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-on-surface-variant truncate">{d.label}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className="font-mono text-xs text-muted-foreground">{d.value}</span>
            <span className="font-mono text-xs text-on-surface w-10 text-right">
              {total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
