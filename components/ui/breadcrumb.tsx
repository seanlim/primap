import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  onNavigate?: (href: string) => void
}

export function Breadcrumb({ items, onNavigate }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
          {item.href ? (
            onNavigate ? (
              <button
                type="button"
                onClick={() => onNavigate(item.href!)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                {item.label}
              </button>
            ) : (
              <Link href={item.href} className="text-gray-400 hover:text-gray-600 transition-colors">
                {item.label}
              </Link>
            )
          ) : (
            <span className="text-gray-700 font-medium truncate max-w-[200px]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
