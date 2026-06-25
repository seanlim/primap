'use client'

interface WalkAnalyticsFiltersProps {
  walks: Array<{ id: string; label: string }>
  selectedWalkId: string
}

export function WalkAnalyticsFilters({
  walks,
  selectedWalkId,
}: WalkAnalyticsFiltersProps) {
  return (
    <form className="rounded-xl bg-white p-4 shadow-sm space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Walk</label>
        <div className="flex gap-3">
          <select
            name="walk"
            defaultValue={selectedWalkId}
            onChange={(event) => {
              event.currentTarget.form?.requestSubmit()
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {walks.map((walk) => (
              <option key={walk.id} value={walk.id}>
                {walk.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            View
          </button>
        </div>
      </div>
    </form>
  )
}
