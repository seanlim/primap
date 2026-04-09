import { describe, it, expect } from 'vitest'
import {
  buildReadableMediaPath,
  buildWalkFolderName,
  sanitizePathSegment,
} from '@/lib/export-import/view-export-paths'

describe('view-export-paths', () => {
  it('sanitizes invalid path characters', () => {
    expect(sanitizePathSegment('Round: A / East', 'Fallback')).toBe('Round A East')
  })

  it('builds readable walk folder names', () => {
    expect(buildWalkFolderName('2026-03-14', 'Pasir Ris Park')).toBe('2026-03-14 - Pasir Ris Park')
  })

  it('builds observation media paths under round, walk, and user folders', () => {
    const path = buildReadableMediaPath({
      roundName: 'Round 1',
      walkDate: '2026-03-14',
      locationName: 'Pasir Ris Park',
      userName: 'Tan Wei Ming',
      fileName: 'photo.jpg',
    }, new Set())

    expect(path).toBe('media/Round 1/2026-03-14 - Pasir Ris Park/Tan Wei Ming/obs/photo.jpg')
  })

  it('deduplicates file names within the same folder', () => {
    const usedPaths = new Set<string>()
    const first = buildReadableMediaPath({
      roundName: 'Round 1',
      walkDate: '2026-03-14',
      locationName: 'Pasir Ris Park',
      userName: 'Tan Wei Ming',
      fileName: 'photo.jpg',
    }, usedPaths)
    const second = buildReadableMediaPath({
      roundName: 'Round 1',
      walkDate: '2026-03-14',
      locationName: 'Pasir Ris Park',
      userName: 'Tan Wei Ming',
      fileName: 'photo.jpg',
    }, usedPaths)

    expect(first).toBe('media/Round 1/2026-03-14 - Pasir Ris Park/Tan Wei Ming/obs/photo.jpg')
    expect(second).toBe('media/Round 1/2026-03-14 - Pasir Ris Park/Tan Wei Ming/obs/photo (2).jpg')
  })

  it('truncates long segments to keep Windows extraction paths manageable', () => {
    const path = buildReadableMediaPath({
      roundName: 'Very Long Round Name That Keeps Going Beyond Reasonable Limits',
      walkDate: '2026-03-14',
      locationName: 'Extremely Long Location Name That Would Otherwise Blow Up The Zip Extraction Path',
      userName: 'Volunteer Name With A Surprisingly Long Display Value',
      sightingId: 's1',
      species: 'RBL',
      count: 2,
      fileName: 'very-long-file-name-that-keeps-going-and-going-forever.jpg',
    }, new Set())

    expect(path).toBe('media/Very Long Round Name Tha/2026-03-14 - Extremely Long Location/Volunteer Name With A Su/sg-RBL-2/very-long-file-name-that-keeps-going-and-goi.jpg')
  })

  it('adds stable ids to truncated entity folders to avoid silent merges', () => {
    const path = buildReadableMediaPath({
      roundId: 'round-alpha-123456',
      roundName: 'Very Long Round Name That Keeps Going',
      walkId: 'walk-alpha-abcdef',
      walkDate: '2026-03-14',
      locationName: 'Extremely Long Location Name That Keeps Going',
      userId: 'user-alpha-999999',
      userName: 'Volunteer Name With A Surprisingly Long Display Value',
      fileName: 'photo.jpg',
    }, new Set())

    expect(path).toBe('media/Very Long Round ~123456/2026-03-14 - Extremely Long ~abcdef/Volunteer Name W ~999999/obs/photo.jpg')
  })
})
