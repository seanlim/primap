'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { getAppDateString } from '@/lib/utils/walk-participation'

export function WalkFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const date = searchParams.get('date') || ''
  const location = searchParams.get('location') || ''
  const availability = searchParams.get('availability') || ''
  const today = getAppDateString()

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page') // reset page on filter change
    router.push(`/walk?${params.toString()}`)
  }, [router, searchParams])

  const clearFilters = useCallback(() => {
    router.push('/walk')
  }, [router])

  const hasFilters = date || location || availability

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="walk-date-filter" className="block text-xs font-medium text-gray-500 mb-1">Date</label>
          <input
            id="walk-date-filter"
            type="date"
            value={date}
            min={today}
            onChange={(e) => updateParam('date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label htmlFor="walk-availability-filter" className="block text-xs font-medium text-gray-500 mb-1">Availability</label>
          <select
            id="walk-availability-filter"
            value={availability}
            onChange={(e) => updateParam('availability', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">All</option>
            <option value="open">Open Only</option>
            <option value="full">Full Only</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="walk-location-filter" className="block text-xs font-medium text-gray-500 mb-1">Location</label>
        <input
          id="walk-location-filter"
          type="text"
          value={location}
          onChange={(e) => updateParam('location', e.target.value)}
          placeholder="Search location..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      {hasFilters && (
        <button
          onClick={clearFilters}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
