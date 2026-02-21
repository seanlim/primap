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
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-xl p-8 text-center shadow-sm">
      {Icon && (
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Icon className="w-6 h-6 text-gray-400" />
        </div>
      )}
      <p className="font-medium text-gray-700">{title}</p>
      {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
      {action && (
        action.href ? (
          <a href={action.href} className="text-green-600 font-medium text-sm hover:underline mt-3 inline-block">
            {action.label}
          </a>
        ) : (
          <button onClick={action.onClick} className="text-green-600 font-medium text-sm hover:underline mt-3">
            {action.label}
          </button>
        )
      )}
    </div>
  )
}
