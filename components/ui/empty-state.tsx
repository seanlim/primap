import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  color?: 'gray' | 'green' | 'blue' | 'yellow' | 'red'
}

const colorMap = {
  gray: { bg: 'bg-gray-100', icon: 'text-gray-400', ring: '' },
  green: { bg: 'bg-green-50', icon: 'text-green-500', ring: 'ring-4 ring-green-50' },
  blue: { bg: 'bg-blue-50', icon: 'text-blue-500', ring: 'ring-4 ring-blue-50' },
  yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-500', ring: 'ring-4 ring-yellow-50' },
  red: { bg: 'bg-red-50', icon: 'text-red-500', ring: 'ring-4 ring-red-50' },
}

export function EmptyState({ icon: Icon, title, description, action, color = 'gray' }: EmptyStateProps) {
  const colors = colorMap[color]

  return (
    <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
      {Icon && (
        <div className={`w-14 h-14 ${colors.bg} ${colors.ring} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <Icon className={`w-7 h-7 ${colors.icon}`} />
        </div>
      )}
      <p className="font-medium text-gray-700">{title}</p>
      {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
      {action && (
        action.href ? (
          <a href={action.href} className="inline-block mt-3 text-green-600 font-medium text-sm bg-green-50 px-4 py-2 rounded-lg hover:bg-green-100 transition-colors">
            {action.label}
          </a>
        ) : (
          <button onClick={action.onClick} className="mt-3 text-green-600 font-medium text-sm bg-green-50 px-4 py-2 rounded-lg hover:bg-green-100 transition-colors">
            {action.label}
          </button>
        )
      )}
    </div>
  )
}
