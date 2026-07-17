"use client"

import { Clock } from 'lucide-react'
import { DOW_SHORT_MON_FIRST } from '@/lib/dashboard/date-utils'
import type { ResponseTimeSummary } from '@/lib/dashboard/types'
import { EmptyState } from './empty-state'
import { Skeleton } from './skeleton'

interface ResponseTimeChartProps {
  data: ResponseTimeSummary | null
  loading: boolean
  thresholdMinutes?: number
}

const VB_W = 760
const VB_H = 260
const PADDING = { top: 16, right: 16, bottom: 28, left: 44 }

export function ResponseTimeChart({
  data,
  loading,
  thresholdMinutes = 5,
}: ResponseTimeChartProps) {
  const hasData = data?.buckets.some((b) => b.avgMinutes != null) ?? false

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Average First Response Time
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Minutes to reply to a customer&apos;s first unreplied message, by
            weekday
          </p>
        </div>
        <div className="flex items-center gap-3 text-right text-xs">
          {thresholdMinutes > 0 && (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-medium text-rose-600 tabular-nums">
              target {thresholdMinutes}m
            </span>
          )}
          {data && (data.thisWeekAvg != null || data.lastWeekAvg != null) && (
            <div>
              <div className="text-muted-foreground">
                This week:{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {fmt(data.thisWeekAvg)}
                </span>
              </div>
              <div className="text-muted-foreground">
                Last week:{' '}
                <span className="tabular-nums">{fmt(data.lastWeekAvg)}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="p-5">
        {loading || !data ? (
          <Skeleton className="h-[260px] w-full" />
        ) : !hasData ? (
          <EmptyState
            icon={Clock}
            title="No replies recorded yet"
            hint="This chart fills in as you reply to customer messages."
          />
        ) : (
          <ResponseBars buckets={data.buckets} thresholdMinutes={thresholdMinutes} />
        )}
      </div>
    </section>
  )
}

function ResponseBars({
  buckets,
  thresholdMinutes,
}: {
  buckets: ResponseTimeSummary['buckets']
  thresholdMinutes: number
}) {
  const chartW = VB_W - PADDING.left - PADDING.right
  const chartH = VB_H - PADDING.top - PADDING.bottom
  const barGap = 12
  const barWidth = (chartW - barGap * (buckets.length - 1)) / buckets.length

  const values = buckets.map((b) =>
    b.avgMinutes == null ? 0 : Number(b.avgMinutes) || 0,
  )
  const maxVal = Math.max(thresholdMinutes, ...values, 1)
  const niceMax = niceCeil(maxVal)
  const ticks = [0, niceMax / 2, niceMax].map((v) => Math.round(v))

  const yFor = (minutes: number) =>
    PADDING.top + chartH - (minutes / niceMax) * chartH

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="h-[260px] w-full"
      role="img"
      aria-label="Average first response time by weekday"
    >
      {ticks.map((tick) => {
        const y = yFor(tick)
        return (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={VB_W - PADDING.right}
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeDasharray="3 3"
            />
            <text
              x={PADDING.left - 8}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-slate-500 text-[10px]"
            >
              {tick}m
            </text>
          </g>
        )
      })}

      {thresholdMinutes > 0 && thresholdMinutes <= niceMax && (
        <line
          x1={PADDING.left}
          x2={VB_W - PADDING.right}
          y1={yFor(thresholdMinutes)}
          y2={yFor(thresholdMinutes)}
          stroke="rgb(244 63 94 / 0.55)"
          strokeDasharray="4 4"
        />
      )}

      {buckets.map((bucket, i) => {
        const minutes = bucket.avgMinutes == null ? null : Number(bucket.avgMinutes)
        const x = PADDING.left + i * (barWidth + barGap)
        const label = DOW_SHORT_MON_FIRST[i] ?? `D${i + 1}`
        if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) {
          return (
            <g key={bucket.dow}>
              <text
                x={x + barWidth / 2}
                y={VB_H - 8}
                textAnchor="middle"
                className="fill-slate-500 text-[10px]"
              >
                {label}
              </text>
            </g>
          )
        }

        const barHeight = (minutes / niceMax) * chartH
        const y = PADDING.top + chartH - barHeight
        return (
          <g key={bucket.dow}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={4}
              fill="#14b8a6"
            />
            <text
              x={x + barWidth / 2}
              y={Math.max(PADDING.top + 10, y - 6)}
              textAnchor="middle"
              className="fill-primary text-[10px] tabular-nums"
            >
              {minutes.toFixed(1)}m
            </text>
            <text
              x={x + barWidth / 2}
              y={VB_H - 8}
              textAnchor="middle"
              className="fill-slate-500 text-[10px]"
            >
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function niceCeil(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 4
  const pow = Math.pow(10, Math.floor(Math.log10(max)))
  const normalised = max / pow
  let nice: number
  if (normalised <= 1) nice = 1
  else if (normalised <= 2) nice = 2
  else if (normalised <= 5) nice = 5
  else nice = 10
  return nice * pow
}

function fmt(mins: number | null): string {
  if (mins == null) return '—'
  const n = Number(mins)
  if (!Number.isFinite(n)) return '—'
  if (n < 1) return `${Math.max(1, Math.round(n * 60))}s`
  if (n < 60) return `${n.toFixed(1)}m`
  return `${(n / 60).toFixed(1)}h`
}
