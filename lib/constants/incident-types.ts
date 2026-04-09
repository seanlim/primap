import type { Database } from '@/lib/types/database'

/**
 * Single source of truth for incident type literals, ordered list (for
 * dropdowns), and human-readable labels (for display + email subjects).
 */

export type IncidentType = Database['public']['Enums']['incident_type']

export const INCIDENT_TYPES: ReadonlyArray<{ value: IncidentType; label: string }> = [
  { value: 'INJURED_ANIMAL', label: 'Injured Animal' },
  { value: 'DEAD_ANIMAL', label: 'Dead Animal' },
  { value: 'HUMAN_WILDLIFE_CONFLICT', label: 'Human-Wildlife Conflict' },
  { value: 'HABITAT_DAMAGE', label: 'Habitat Damage' },
  { value: 'OTHER', label: 'Other' },
] as const

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = INCIDENT_TYPES.reduce(
  (acc, t) => {
    acc[t.value] = t.label
    return acc
  },
  {} as Record<IncidentType, string>
)
