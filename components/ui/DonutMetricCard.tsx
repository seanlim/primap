import type { ComponentType } from 'react'

export default function DonutMetricCard({
  title,
  value,
  numerator,
  denominator,
  numeratorLabel,
  denominatorLabel,
  progress,
  icon: Icon,
  ringColor,
  trackColor,
  iconBgColor,
  iconColor,
}: {
  title: string
  value: string
  numerator: number
  denominator: number
  numeratorLabel: string
  denominatorLabel: string
  progress: number
  icon: ComponentType<{ className?: string }>
  ringColor: string
  trackColor: string
  iconBgColor: string
  iconColor: string
}) {
  const boundedProgress = Math.max(0, Math.min(progress, 1))
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - boundedProgress)
  const hasPercentSuffix = value.endsWith('%')
  const valueNumber = hasPercentSuffix ? value.slice(0, -1) : value

  return (
    <div
      className="min-w-0 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
    >
      <div
        className="border-b border-gray-100 px-4 py-3.5"
        style={{ background: `linear-gradient(90deg, ${iconBgColor}, rgba(255,255,255,0.96))` }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-black/5" style={{ backgroundColor: iconBgColor }}>
            <Icon className="h-5 w-5" style={{ color: iconColor }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">{title}</h2>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-5 p-4">
        <div className="relative h-36 w-36 shrink-0">
          <svg viewBox="0 0 92 92" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="46" cy="46" r={radius} fill="none" stroke={trackColor} strokeWidth="10" />
            <circle
              cx="46"
              cy="46"
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-gray-100">
            <span
              className="flex items-start leading-none tabular-nums"
              style={{ color: iconColor }}
            >
              <span className="text-[42px] font-semibold tracking-[-0.04em]">{valueNumber}</span>
              {hasPercentSuffix && <span className="mt-1 text-[22px] font-semibold">%</span>}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="grid w-full gap-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{numeratorLabel}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{numerator}</div>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{denominatorLabel}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{denominator}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
