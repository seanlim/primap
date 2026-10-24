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
        { id: 'm1', slot_id: 'w1', user_id: 'u1', status: 'ACTIVE' },
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
        { id: 'md3', incident_id: 'i1', file_path: 'u1/incidents/i1/incident.jpg', file_name: 'incident.jpg', media_type: 'image/jpeg', file_size: 512 },
      ],
      incidents: [
        { id: 'i1', slot_id: 'w1', reported_by: 'u1', incident_type: 'OTHER', description: 'Trail blocked', resolved: false, created_at: '2026-03-14T09:30:00Z' },
      ],
    })

    const result = buildViewExportData(data)

    expect(result.summaryRows).toEqual(expect.arrayContaining([
      { metric: 'Walks', value: 1 },
      { metric: 'Media Files', value: 3 },
    ]))

    expect(result.walkRows[0]).toEqual(expect.objectContaining({
      roundName: 'Round 1',
      location: 'Pasir Ris Park',
      joinedVolunteers: 1,
      observationCount: 1,
      sightingCount: 1,
      incidentCount: 1,
      mediaCount: 3,
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
      mediaCount: 1,
    }))
    expect(result.incidentRows[0].mediaFiles).toContain('/Tan Wei Ming/incident/incident.jpg')

    expect(result.mediaRows[1].viewExportPath).toBe(
      'media/Round 1/2026-03-14 - Pasir Ris Park/Tan Wei Ming/sg-RBL-2/sighting.jpg'
    )
    expect(result.mediaRows[2]).toEqual(expect.objectContaining({
      incidentId: 'i1',
      observationId: '',
      sightingId: '',
      storageBucket: 'incident-media',
      viewExportPath: 'media/Round 1/2026-03-14 - Pasir Ris Park/Tan Wei Ming/incident/incident.jpg',
    }))
    expect(result.mediaManifest).toEqual(expect.arrayContaining([
      expect.objectContaining({
        storageBucket: 'incident-media',
        storagePath: 'u1/incidents/i1/incident.jpg',
        zipPath: 'media/Round 1/2026-03-14 - Pasir Ris Park/Tan Wei Ming/incident/incident.jpg',
      }),
    ]))
    expect(result.mediaManifest).toHaveLength(3)
  })

  it('associates sighting-only media with the parent observation and walk', () => {
    const data = makeTableData({
      profiles: [
        { id: 'u1', email: 'volunteer@example.com', full_name: 'Tan Wei Ming' },
      ],
      survey_rounds: [
        { id: 'r1', name: 'Round 1' },
      ],
      walk_slots: [
        { id: 'w1', round_id: 'r1', location_name: 'Pasir Ris Park', walk_date: '2026-03-14' },
      ],
      observations: [
        { id: 'o1', slot_id: 'w1', user_id: 'u1' },
      ],
      sightings: [
        { id: 's1', observation_id: 'o1', species: 'RBL', count: 2 },
      ],
      media: [
        { id: 'md1', observation_id: null, sighting_id: 's1', file_path: 'u1/o1/s1/sighting.jpg', file_name: 'sighting.jpg' },
      ],
    })

    const result = buildViewExportData(data)

    expect(result.walkRows[0].mediaCount).toBe(1)
    expect(result.observationRows[0].mediaCount).toBe(1)
    expect(result.sightingRows[0].mediaCount).toBe(1)
    expect(result.observationRows[0].mediaFiles).toContain('/sg-RBL-2/sighting.jpg')
  })
  it('counts active signups for completed and upcoming walks, excluding cancellations', () => {
    const walks = [
      { id: 'completed-2', walk_date: '2026-03-16', location_name: 'Thomson Nature Park' },
      { id: 'completed-3', walk_date: '2026-03-23', location_name: 'Lower Peirce Reservoir Park' },
      { id: 'upcoming', walk_date: '2026-10-26', location_name: 'Test walk' },
    ]
    const memberships = walks.flatMap((walk, index) => [
      ...Array.from({ length: index === 1 ? 3 : 2 }, (_, n) => ({
        id: `${walk.id}-${n}`, slot_id: walk.id, user_id: `u-${n}`, status: 'ACTIVE',
      })),
      { id: `${walk.id}-cancelled`, slot_id: walk.id, user_id: 'cancelled-user', status: 'CANCELLED' },
    ])
    const result = buildViewExportData(makeTableData({
      walk_slots: walks,
      slot_memberships: memberships,
      observations: walks.slice(0, 2).map(walk => ({ id: `obs-${walk.id}`, slot_id: walk.id, status: 'SUBMITTED' })),
    }))
    expect(result.walkRows.map(row => row.joinedVolunteers)).toEqual([2, 3, 2])
    expect(result.walkRows.map(row => row.cancelledVolunteers)).toEqual([1, 1, 1])
  })

  it('preserves Other species names and completion comments in viewing rows', () => {
    const result = buildViewExportData(makeTableData({
      observations: [{ id: 'o1', slot_id: 'w1', walk_completion: 'ABORTED', completion_comment: 'Heavy rain\nReturned early' }],
      sightings: [{ id: 's1', observation_id: 'o1', species: 'OTHER', species_other: 'Silvered langur' }],
    }))
    expect(result.observationRows[0]).toMatchObject({ walkCompletion: 'ABORTED', completionComment: 'Heavy rain\nReturned early' })
    expect(result.sightingRows[0]).toMatchObject({ species: 'OTHER', speciesOther: 'Silvered langur' })
  })

})
