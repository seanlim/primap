export const SPECIES_COLORS = {
  RBL: '#111111',
  LTM: '#8b5e3c',
  DUSKY: '#f97316',
  OTHER: '#6b7280',
} as const

export const DEFAULT_SIGHTING_COLOR = '#16a34a'
export const NOT_SIGHTED_COLOR = '#f59e0b'

export function getSpeciesColor(species?: string) {
  if (!species) return DEFAULT_SIGHTING_COLOR
  return SPECIES_COLORS[species as keyof typeof SPECIES_COLORS] ?? DEFAULT_SIGHTING_COLOR
}
