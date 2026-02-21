'use client'

import { useIsDesktop } from '@/lib/hooks/use-media-query'
import { BottomNav } from './bottom-nav'
import { SidebarNav } from './sidebar-nav'

export function AppShell({ children, isAdmin }: { children: React.ReactNode; isAdmin: boolean }) {
  const isDesktop = useIsDesktop()

  return (
    <div className="min-h-screen bg-gray-50">
      {isDesktop ? (
        <>
          <SidebarNav isAdmin={isAdmin} />
          <main className="ml-64 min-h-screen">
            <div className="max-w-4xl mx-auto p-6">
              {children}
            </div>
          </main>
        </>
      ) : (
        <>
          <main className="pb-20 min-h-screen">
            <div className="max-w-lg mx-auto p-4">
              {children}
            </div>
          </main>
          <BottomNav isAdmin={isAdmin} />
        </>
      )}
    </div>
  )
}
