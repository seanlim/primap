'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Footprints, ClipboardList, User, Shield, BookOpen } from 'lucide-react'

const navItems = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/walk', label: 'Walks', icon: Footprints },
  { href: '/report', label: 'Reports', icon: ClipboardList },
  { href: '/guidance', label: 'Guide', icon: BookOpen },
  { href: '/profile', label: 'Profile', icon: User },
]

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()

  const items = isAdmin
    ? [...navItems, { href: '/admin', label: 'Admin', icon: Shield }]
    : navItems

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors relative ${
                isActive
                  ? 'text-green-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {isActive && (
                <span className="absolute top-1 w-1 h-1 rounded-full bg-green-600" />
              )}
              <item.icon className={`w-5 h-5 ${isActive ? 'mt-1' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
