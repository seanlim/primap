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
  accentColor,
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
  accentColor: string
}) {
  const boundedProgress = Math.max(0, Math.min(progress, 1))
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - boundedProgress)

  return (
    <div
      className="min-w-0 rounded-2xl border-l-4 bg-white p-4 shadow-sm"
      style={{ borderLeftColor: accentColor }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: iconBgColor }}>
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>

      <div className="mt-4 flex items-start gap-3" style={{flexWrap: "wrap"}}>
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
          <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-gray-900">{value}</div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="grid w-full gap-2">
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{numeratorLabel}</div>
              <div className="mt-1 text-xl font-bold text-gray-900">{numerator}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{denominatorLabel}</div>
              <div className="mt-1 text-xl font-bold text-gray-900">{denominator}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}