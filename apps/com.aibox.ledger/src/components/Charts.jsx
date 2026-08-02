// 图表（§5）。输入永远是 `[LedgerStatBucket]`（key / label / amountMinor / count / colorHex?）。
//
// 口径照抄原生：
//  - 环形取**前 8 个桶**，内径比 0.62，扇区间隙 1.5°，圆角 3；角度按 `|amountMinor|`
//  - 柱状 X 轴刻度最多 `min(桶数, 6)` 个，Y 轴标签用**紧凑金额**
//  - 图例取**前 6 项**，百分比 = round(|桶| / |总额| × 100)
//  - 一律取 `abs(amountMinor)`；金额已在 buckets 阶段换算成基准币，图表不做任何换算
//
// 纯 SVG 手绘：chart.js 虽在白名单里，但它的 canvas 在深浅色切换时要手动重绘，
// 而这里的图形足够简单，SVG 反而更稳、更好对齐设计令牌。

import React from 'react'
import { C } from './theme.js'
import { CHART_FALLBACK_COLORS } from '../lib/seeds.js'
import { moneyCompact, money } from '../lib/money.js'

export const DONUT_LIMIT = 8
export const LEGEND_LIMIT = 6

export function bucketColor(bucket, index) {
  return bucket.colorHex || CHART_FALLBACK_COLORS[index % CHART_FALLBACK_COLORS.length]
}

function arcPath(cx, cy, outer, inner, from, to) {
  const large = to - from > Math.PI ? 1 : 0
  const x1 = cx + outer * Math.cos(from)
  const y1 = cy + outer * Math.sin(from)
  const x2 = cx + outer * Math.cos(to)
  const y2 = cy + outer * Math.sin(to)
  const x3 = cx + inner * Math.cos(to)
  const y3 = cy + inner * Math.sin(to)
  const x4 = cx + inner * Math.cos(from)
  const y4 = cy + inner * Math.sin(from)
  return `M${x1} ${y1}A${outer} ${outer} 0 ${large} 1 ${x2} ${y2}L${x3} ${y3}A${inner} ${inner} 0 ${large} 0 ${x4} ${y4}Z`
}

/** 环形图（SectorMark 等价）。 */
export function DonutChart({ buckets, size = 150 }) {
  const rows = buckets.slice(0, DONUT_LIMIT)
  const total = rows.reduce((sum, row) => sum + Math.abs(row.amountMinor), 0)
  const outer = size / 2
  const inner = outer * 0.62
  const gap = (1.5 * Math.PI) / 180
  let cursor = -Math.PI / 2

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: 'block', flex: '0 0 auto' }}>
      {total === 0 ? (
        <circle cx={outer} cy={outer} r={(outer + inner) / 2} fill="none" stroke={C.line} strokeWidth={outer - inner} />
      ) : rows.map((row, index) => {
        const share = Math.abs(row.amountMinor) / total
        const from = cursor + gap / 2
        const to = cursor + share * Math.PI * 2 - gap / 2
        cursor += share * Math.PI * 2
        if (to <= from) return null
        return (
          <path
            key={row.key}
            d={arcPath(outer, outer, outer, inner, from, to)}
            fill={bucketColor(row, index)}
            strokeLinejoin="round"
            strokeWidth="3"
            stroke={bucketColor(row, index)}
          />
        )
      })}
    </svg>
  )
}

/** 环形的固定搭档：图例，取前 6 项。 */
export function ChartLegend({ buckets, currency }) {
  const rows = buckets.slice(0, LEGEND_LIMIT)
  const total = buckets.reduce((sum, row) => sum + Math.abs(row.amountMinor), 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 auto', minWidth: 0 }}>
      {rows.map((row, index) => (
        <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 9, height: 9, borderRadius: 4.5, background: bucketColor(row, index), flex: '0 0 auto',
          }}
          />
          <span className="lg-clamp-1" style={{ fontSize: 15, color: C.ink, flex: '1 1 auto', minWidth: 0 }}>
            {row.label}
          </span>
          {total > 0 ? (
            <span className="lg-mono" style={{ fontSize: 12, color: C.muted, flex: '0 0 auto' }}>
              {Math.round((Math.abs(row.amountMinor) / total) * 100)}%
            </span>
          ) : null}
          <span className="lg-mono" style={{ fontSize: 14, fontWeight: 500, color: C.ink, flex: '0 0 auto' }}>
            {money(Math.abs(row.amountMinor), currency)}
          </span>
        </div>
      ))}
    </div>
  )
}

/** 竖向柱状（每日趋势）。 */
export function TimeBarChart({ buckets, currency, height = 170, color }) {
  const rows = buckets
  const peak = rows.reduce((max, row) => Math.max(max, Math.abs(row.amountMinor)), 0)
  const tickCount = Math.min(rows.length, 6)
  const tickStep = tickCount > 0 ? Math.max(1, Math.round(rows.length / tickCount)) : 1
  const axisWidth = 46
  const labelHeight = 18
  const plotHeight = height - labelHeight

  return (
    <div style={{ display: 'flex', gap: 6, height }}>
      <div style={{
        width: axisWidth, flex: '0 0 auto', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', height: plotHeight,
      }}
      >
        {[1, 0.5, 0].map((fraction) => (
          <span key={fraction} className="lg-mono" style={{ fontSize: 10, color: C.muted, textAlign: 'right' }}>
            {moneyCompact(Math.round(peak * fraction), currency)}
          </span>
        ))}
      </div>
      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          flex: '1 1 auto', display: 'flex', alignItems: 'flex-end', gap: 3,
          borderBottom: `1px solid ${C.line}`, height: plotHeight,
        }}
        >
          {rows.map((row) => (
            <div
              key={row.key}
              title={`${row.label} ${money(Math.abs(row.amountMinor), currency)}`}
              style={{
                flex: '1 1 0', minWidth: 2,
                height: `${peak > 0 ? Math.max(1, (Math.abs(row.amountMinor) / peak) * 100) : 1}%`,
                background: color ?? C.brand, borderRadius: 3,
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 3, height: labelHeight, alignItems: 'center' }}>
          {rows.map((row, index) => (
            <span
              key={row.key}
              style={{
                flex: '1 1 0', minWidth: 0, fontSize: 9, color: C.muted, textAlign: 'center',
                overflow: 'hidden', whiteSpace: 'nowrap',
              }}
            >
              {index % tickStep === 0 ? row.label : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
