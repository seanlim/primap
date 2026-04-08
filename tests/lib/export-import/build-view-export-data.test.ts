import { describe, it, expect } from 'vitest'
import { buildViewExportData } from '@/lib/export-import/build-view-export-data'
import { TABLE_ORDER, type TableName } from '@/lib/export-import/constants'

function makeTableData(overrides: Partial<Record<TableName, Record<string, unknown>[]>> = {}) {
  const data = {} as Record<TableName, Record<string, unknown>[]>
  for (const table of TABLE_ORDER) {
    data[table] = overrides[table] ?? []
  }
  return data
}

describe('buildViewExportData', () => {
  it('builds denormalized rows and readable media manifest entries', () => {
    const data = makeTableData({
      profiles: [
        { id: 'u1', email: 'volunteer@example.com', full_name: 'Tan Wei Ming' },
      ],
      survey_rounds: [
        { id: 'r1', name: 'Round 1' },
      ],
      walk_slots: [
        { id: 'w1', round_id: 'r1', location_name: 'Pasir Ris Park', walk_date: '2026-03-14', start_time: '07:00', end_time: '09:00', max_volunteers: 8 },
      ],
      slot_memberships: [
        { id: 'm1', slot_id: 'w1', user_id: 'u1', status: 'JOINED' },
      ],
      observations: [
        { id: 'o1', slot_id: 'w1', user_id: 'u1', status: 'SUBMITTED', outcome: 'SIGHTED', walk_completion: 'COMPLETED', notes: 'Saw movement', submitted_at: '2026-03-14T09:15:00Z' },
      ],
      sightings: [
        { id: 's1', observation_id: 'o1', species: 'RBL', count: 2, observed_at: '2026-03-14T08:10:00Z', notes: 'Near the boardwalk' },
      ],
      media: [
        { id: 'md1', observation_id: 'o1', file_path: 'u1/o1/photo.jpg', file_name: 'photo.jpg', media_type: 'image/jpeg', file_size: 1024 },
        { id: 'md2', observation_id: 'o1', sighting_id: 's1', file_path: 'u1/o1/s1/sighting.jpg', file_name: 'sighting.jpg', media_type: 'image/jpeg', file_size: 2048 },
      ],
      incidents: [
        { id: 'i1', slot_id: 'w1', reported_by: 'u1', incident_type: 'OTHER', description: 'Trail blocked', resolved: false, created_at: '2026-03-14T09:30:00Z' },
      ],
    })

    const result = buildViewExportData(data)

    expect(result.summaryRows).toEqual(expect.arrayContaining([
      { metric: 'Walks', value: 1 },
      { metric: 'Media Files', value: 2 },
    ]))

    expect(result.walkRows[0]).toEqual(expect.objectContaining({
      roundName: 'Round 1',
      location: 'Pasir Ris Park',
      joinedVolunteers: 1,
      observationCount: 1,
      sightingCount: 1,
      incidentCount: 1,
      mediaCount: 2,
    }))

    expect(result.observationRows[0]).toEqual(expect.objectContaining({
      observerName: 'Tan Wei Ming',
      observerEmail: 'volunteer@example.com',
      sightingCount: 1,
      mediaCount: 2,
    }))
    expect(result.observationRows[0].mediaFiles).toContain('media/Round 1/2026-03-14 - Pasir Ris Park/Tan Wei Ming/obs/photo.jpg')

    expect(result.sightingRows[0]).toEqual(expect.objectContaining({
      species: 'RBL',
      count: 2,
      mediaCount: 1,
    }))

    expect(result.incidentRows[0]).toEqual(expect.objectContaining({
      reportedByName: 'Tan Wei Ming',
      incidentType: 'OTHER',
    }))

    expect(result.mediaRows[1].viewExportPath).toBe(
      'media/Round 1/2026-03-14 - Pasir Ris Park/Tan Wei Ming/sg-RBL-2/sighting.jpg'
    )
    expect(result.mediaManifest).toHaveLength(2)
  })
})
