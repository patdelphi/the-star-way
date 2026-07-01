import React from "react"

interface LinePoint {
  label: string
  value: number
}

interface LineChartProps {
  data: LinePoint[]
  width?: number
  height?: number
}

export const LineChart: React.FC<LineChartProps> = ({ data, width = 600, height = 200 }) => {
  if (!data.length) return null

  const padding = { top: 10, right: 10, bottom: 30, left: 30 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const maxValue = Math.max(...data.map((d) => d.value), 1)
  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth

  const getX = (i: number) => padding.left + i * stepX
  const getY = (v: number) => padding.top + chartHeight - (v / maxValue) * chartHeight

  // 构建折线路径
  const pathD = data
    .map((d, i) => {
      const x = getX(i)
      const y = getY(d.value)
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
    })
    .join(" ")

  // 区域填充路径
  const areaD =
    pathD +
    ` L ${getX(data.length - 1)} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {/* 网格线 */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padding.top + chartHeight * (1 - ratio)
        return (
          <line
            key={ratio}
            x1={padding.left}
            y1={y}
            x2={padding.left + chartWidth}
            y2={y}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
          />
        )
      })}

      {/* 区域填充 */}
      <path d={areaD} fill="currentColor" fillOpacity={0.08} />

      {/* 折线 */}
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 数据点 */}
      {data.map((d, i) => (
        <circle
          key={i}
          cx={getX(i)}
          cy={getY(d.value)}
          r={3}
          fill="var(--color-surface-container-low)"
          stroke="currentColor"
          strokeWidth={2}
        />
      ))}

      {/* X 轴标签 */}
      {data.map((d, i) => (
        <text
          key={`x-${i}`}
          x={getX(i)}
          y={height - 8}
          textAnchor="middle"
          className="text-[10px] fill-muted-foreground"
        >
          {d.label}
        </text>
      ))}

      {/* Y 轴标签 */}
      {[0, 0.5, 1].map((ratio) => {
        const val = Math.round(maxValue * ratio)
        const y = padding.top + chartHeight * (1 - ratio)
        return (
          <text
            key={`y-${ratio}`}
            x={padding.left - 6}
            y={y + 3}
            textAnchor="end"
            className="text-[10px] fill-muted-foreground"
          >
            {val}
          </text>
        )
      })}
    </svg>
  )
}
