import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SIGHTING_COLOR,
  getSpeciesColor,
  getSpeciesDisplayName,
  getSpeciesShortLabel,
  NOT_SIGHTED_COLOR,
  SPECIES_COLORS,
} from '@/lib/constants/species'

describe('species constants helpers', () => {
  it('returns configured colors for known species and the default color otherwise', () => {
    expect(getSpeciesColor('RBL')).toBe(SPECIES_COLORS.RBL)
    expect(getSpeciesColor('LTM')).toBe(SPECIES_COLORS.LTM)
    expect(getSpeciesColor('DUSKY')).toBe(SPECIES_COLORS.DUSKY)
    expect(getSpeciesColor('OTHER')).toBe(SPECIES_COLORS.OTHER)
    expect(getSpeciesColor('UNKNOWN')).toBe(DEFAULT_SIGHTING_COLOR)
    expect(getSpeciesColor()).toBe(DEFAULT_SIGHTING_COLOR)
  })

  it('returns short labels for built-in species and trims custom OTHER labels', () => {
    expect(getSpeciesShortLabel('RBL')).toBe('RBL')
    expect(getSpeciesShortLabel('LTM')).toBe('LTM')
    expect(getSpeciesShortLabel('DUSKY')).toBe('DUSKY')
    expect(getSpeciesShortLabel('OTHER', '  Silvered Langur  ')).toBe('Silvered Langur')
  })

  it('falls back to generic labels when OTHER has no usable custom label', () => {
    expect(getSpeciesShortLabel('OTHER', '')).toBe('Other')
    expect(getSpeciesShortLabel('OTHER', '   ')).toBe('Other')
    expect(getSpeciesShortLabel('UNKNOWN')).toBeNull()
  })

  it('returns display names for built-in species and OTHER variants', () => {
    expect(getSpeciesDisplayName('RBL')).toBe("Raffles' Banded Langur")
    expect(getSpeciesDisplayName('LTM')).toBe('Long-tailed Macaque')
    expect(getSpeciesDisplayName('DUSKY')).toBe('Dusky Langur')
    expect(getSpeciesDisplayName('OTHER', '  Silvered Langur  ')).toBe('Silvered Langur')
    expect(getSpeciesDisplayName('OTHER', '')).toBe('Other Species')
    expect(getSpeciesDisplayName('UNKNOWN')).toBeNull()
  })

  it('exports the not-sighted color used by map and analytics views', () => {
    expect(NOT_SIGHTED_COLOR).toBe('#f59e0b')
  })
})
