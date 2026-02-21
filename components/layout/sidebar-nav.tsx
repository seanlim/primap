'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Footprints, ClipboardList, User, Shield } from 'lucide-react'
import { useAuth } from '@/lib/hooks/use-auth'

const navItems = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/walk', label: 'Walks', icon: Footprints },
  { href: '/report', label: 'Reports', icon: ClipboardList },
  { href: '/profile', label: 'Profile', icon: User },
]

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const { profile } = useAuth()

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 flex flex-col z-50">
      <div className="p-6 border-b border-gray-100">
        <Link href="/home" className="text-2xl font-bold text-green-700">
          Primap
        </Link>
        <p className="text-xs text-gray-400 mt-1">Primate Survey Platform</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          )
        })}

        {isAdmin && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Admin
              </p>
            </div>
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                pathname.startsWith('/admin')
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Shield className="w-5 h-5" />
              Admin Panel
            </Link>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-green-700">
              {profile?.full_name?.[0] || profile?.email?.[0] || '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {profile?.full_name || 'User'}
            </p>
            <p className="text-xs text-gray-400 truncate">{profile?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
