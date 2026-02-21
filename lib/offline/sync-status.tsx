'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { getOutboxItems } from './db'
import { processOutbox } from './sync-engine'

interface SyncStatusContextType {
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
  syncNow: () => Promise<void>
}

const SyncStatusContext = createContext<SyncStatusContextType>({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  syncNow: async () => {},
})

export function SyncStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const syncingRef = useRef(false)

  const refreshPendingCount = useCallback(async () => {
    try {
      const items = await getOutboxItems()
      setPendingCount(items.length)
    } catch {
      // IndexedDB might not be available
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return
    syncingRef.current = true
    setIsSyncing(true)

    try {
      await processOutbox()
      await refreshPendingCount()
    } finally {
      syncingRef.current = false
      setIsSyncing(false)
    }
  }, [refreshPendingCount])

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      syncNow()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial sync and periodic check
    refreshPendingCount()
    const interval = setInterval(() => {
      refreshPendingCount()
      if (navigator.onLine) syncNow()
    }, 30000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [syncNow, refreshPendingCount])

  return (
    <SyncStatusContext.Provider value={{ isOnline, pendingCount, isSyncing, syncNow }}>
      {children}
    </SyncStatusContext.Provider>
  )
}

export function useSyncStatus() {
  return useContext(SyncStatusContext)
}
