'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getMediaByClientParent } from '@/lib/offline/db'

interface MediaParent {
  key: string
  clientParentId: string
  count: number
}
interface MediaBudget {
  maxFiles: number
  total: number
  ready: boolean
  reserve: (key: string, requested: number) => number
  reportCount: (key: string, count: number) => void
}
const Context = createContext<MediaBudget | null>(null)
export const useReportMediaBudget = () => useContext(Context)

export function ReportMediaBudgetProvider({ maxFiles, parents, children }: {
  maxFiles: number
  parents: MediaParent[]
  children: React.ReactNode
}) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const countsRef = useRef(counts)
  const [queued, setQueued] = useState<Record<string, number>>({})
  const [loadedParents, setLoadedParents] = useState<string | null>(null)
  const parentIds = JSON.stringify(parents.map(p => [p.key, p.clientParentId]))

  useEffect(() => {
    let cancelled = false
    const entries: [string, string][] = JSON.parse(parentIds)
    Promise.all(entries.map(async ([key, id]) => [key, (await getMediaByClientParent(id)).length] as const))
      .then(result => {
        if (!cancelled) { setQueued(Object.fromEntries(result)); setLoadedParents(parentIds) }
      })
      .catch(() => { if (!cancelled) setLoadedParents(parentIds) })
    return () => { cancelled = true }
  }, [parentIds])

  const ready = loadedParents === parentIds

  const reportCount = useCallback((key: string, count: number) => {
    if (countsRef.current[key] === count) return
    countsRef.current = { ...countsRef.current, [key]: count }
    setCounts(countsRef.current)
  }, [])
  const total = parents.reduce((sum, p) => sum + (counts[p.key] ?? p.count + (queued[p.key] ?? 0)), 0)

  // Reserve synchronously so two pickers cannot claim the same remaining place
  // before React renders the first picker's in-flight uploads.
  const reserve = (key: string, requested: number) => {
    if (!ready) return 0
    const used = parents.reduce((sum, p) => sum + (countsRef.current[p.key] ?? p.count + (queued[p.key] ?? 0)), 0)
    const allowed = Math.max(0, Math.min(requested, maxFiles - used))
    const parent = parents.find(p => p.key === key)
    reportCount(key, (countsRef.current[key] ?? (parent?.count ?? 0) + (queued[key] ?? 0)) + allowed)
    return allowed
  }
  return <Context.Provider value={{ maxFiles, total, ready, reserve, reportCount }}>{children}</Context.Provider>
}
