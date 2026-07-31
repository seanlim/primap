import {
  buildVolunteerAnalyticsSnapshot,
  getAdminUsersAnalytics,
  getAdminRoundsAnalyticsPageSnapshot,
  getAdminVolunteerAnalyticsLanding,
  getAdminWalksAnalyticsPageSnapshotByRound,
} from '@/lib/admin-volunteer-analytics'

describe('buildVolunteerAnalyticsSnapshot', () => {
  const round = {
    id: 'round-1',
    name: 'Round 1',
    start_date: '2026-03-01',
    end_date: '2026-03-31',
    status: 'OPEN' as const,
  }

  const allTime = {
    activeRegisteredVolunteers: 12,
    totalVolunteerSignUps: 44,
    totalVolunteerCancellations: 6,
    totalSubmittedReports: 18,
  }

  it('excludes future walks from the completion-rate denominator', () => {
    const snapshot = buildVolunteerAnalyticsSnapshot({
      round,
      now: new Date('2026-03-20T12:00:00+08:00'),
      slots: [
        { id: 'ended-slot', round_id: 'round-1', walk_date: '2026-03-10', start_time: '07:00:00', end_time: '10:00:00', location_name: 'Hill', max_volunteers: 3 },
        { id: 'future-slot', round_id: 'round-1', walk_date: '2026-03-25', start_time: '07:00:00', end_time: '10:00:00', location_name: 'River', max_volunteers: 3 },
      ],
      memberships: [
        { slot_id: 'ended-slot', user_id: 'user-1', status: 'ACTIVE' },
        { slot_id: 'future-slot', user_id: 'user-2', status: 'ACTIVE' },
      ],
      observations: [
        { slot_id: 'ended-slot', status: 'SUBMITTED' },
      ],
      allTime,
    })

    expect(snapshot.currentRound?.reportCompletionRate).toBe(1)
  })

  it('uses max_volunteers when calculating fill rate', () => {
    const snapshot = buildVolunteerAnalyticsSnapshot({
      round,
      now: new Date('2026-03-20T12:00:00+08:00'),
      slots: [
        { id: 'slot-1', round_id: 'round-1', walk_date: '2026-03-10', start_time: '07:00:00', end_time: '10:00:00', location_name: 'Hill', max_volunteers: 2 },
        { id: 'slot-2', round_id: 'round-1', walk_date: '2026-03-11', start_time: '07:00:00', end_time: '10:00:00', location_name: 'River', max_volunteers: 4 },
      ],
      memberships: [
        { slot_id: 'slot-1', user_id: 'user-1', status: 'ACTIVE' },
        { slot_id: 'slot-2', user_id: 'user-2', status: 'ACTIVE' },
        { slot_id: 'slot-2', user_id: 'user-3', status: 'ACTIVE' },
      ],
      observations: [],
      allTime,
    })

    expect(snapshot.currentRound?.capacityFillRate).toBe(0.5)
  })

  it('counts participating volunteers distinctly by user', () => {
    const snapshot = buildVolunteerAnalyticsSnapshot({
      round,
      now: new Date('2026-03-20T12:00:00+08:00'),
      slots: [
        { id: 'slot-1', round_id: 'round-1', walk_date: '2026-03-10', start_time: '07:00:00', end_time: '10:00:00', location_name: 'Hill', max_volunteers: 3 },
        { id: 'slot-2', round_id: 'round-1', walk_date: '2026-03-11', start_time: '07:00:00', end_time: '10:00:00', location_name: 'River', max_volunteers: 3 },
      ],
      memberships: [
        { slot_id: 'slot-1', user_id: 'user-1', status: 'ACTIVE' },
        { slot_id: 'slot-2', user_id: 'user-1', status: 'ACTIVE' },
        { slot_id: 'slot-2', user_id: 'user-2', status: 'ACTIVE' },
      ],
      observations: [],
      allTime,
    })

    expect(snapshot.currentRound?.participatingVolunteers).toBe(2)
  })

  it('marks ended walks as missing reports when submitted reports trail active sign-ups', () => {
    const snapshot = buildVolunteerAnalyticsSnapshot({
      round,
      now: new Date('2026-03-20T12:00:00+08:00'),
      slots: [
        { id: 'slot-1', round_id: 'round-1', walk_date: '2026-03-10', start_time: '07:00:00', end_time: '10:00:00', location_name: 'Hill', max_volunteers: 3 },
        { id: 'slot-2', round_id: 'round-1', walk_date: '2026-03-11', start_time: '07:00:00', end_time: '10:00:00', location_name: 'River', max_volunteers: 3 },
      ],
      memberships: [
        { slot_id: 'slot-1', user_id: 'user-1', status: 'ACTIVE' },
        { slot_id: 'slot-1', user_id: 'user-2', status: 'ACTIVE' },
        { slot_id: 'slot-2', user_id: 'user-3', status: 'ACTIVE' },
      ],
      observations: [
        { slot_id: 'slot-1', status: 'SUBMITTED' },
        { slot_id: 'slot-2', status: 'SUBMITTED' },
      ],
      allTime,
    })

    expect(snapshot.roundHealth?.missingReportWalks).toBe(1)
  })

  it('keeps round-level totals available for the current round summary', () => {
    const snapshot = buildVolunteerAnalyticsSnapshot({
      round,
      now: new Date('2026-03-20T12:00:00+08:00'),
      slots: [
        { id: 'slot-ended', round_id: 'round-1', walk_date: '2026-03-10', start_time: '07:00:00', end_time: '10:00:00', location_name: 'Hill', max_volunteers: 4 },
        { id: 'slot-upcoming', round_id: 'round-1', walk_date: '2026-03-25', start_time: '07:00:00', end_time: '10:00:00', location_name: 'River', max_volunteers: 2 },
      ],
      memberships: [
        { slot_id: 'slot-ended', user_id: 'user-1', status: 'ACTIVE' },
        { slot_id: 'slot-ended', user_id: 'user-2', status: 'ACTIVE' },
        { slot_id: 'slot-ended', user_id: 'user-3', status: 'CANCELLED' },
        { slot_id: 'slot-upcoming', user_id: 'user-4', status: 'ACTIVE' },
      ],
      observations: [
        { slot_id: 'slot-ended', status: 'SUBMITTED' },
      ],
      allTime,
    })

    expect(snapshot.currentRound).toMatchObject({
      walkSignUps: 3,
      walkCancellations: 1,
      submittedReports: 1,
    })
    expect(snapshot.roundHealth).toMatchObject({
      totalWalks: 2,
      completedWalks: 1,
      upcomingWalks: 1,
      missingReportWalks: 1,
    })
  })
})

describe('getAdminUsersAnalytics indicators', () => {
  function createQuery(result: { data?: unknown }) {
    const query = {
      eq: () => query,
      order: () => query,
      limit: () => query,
      in: () => query,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(resolve({ data: result.data ?? null, error: null })),
    }

    return query
  }

  it('flags high participation by active sign-ups, not submitted reports', async () => {
    const supabase = {
      from: (table: string) => ({
        select: (..._args: unknown[]) => {
          if (table === 'profiles') {
            return createQuery({ data: [{ id: 'user-1' }, { id: 'user-2' }] })
          }
          if (table === 'slot_memberships') {
            return createQuery({
              data: [
                { user_id: 'user-1', status: 'ACTIVE' },
                { user_id: 'user-1', status: 'ACTIVE' },
                { user_id: 'user-1', status: 'ACTIVE' },
              ],
            })
          }
          if (table === 'observations') {
            return createQuery({
              data: [
                { user_id: 'user-2', status: 'SUBMITTED' },
                { user_id: 'user-2', status: 'SUBMITTED' },
              ],
            })
          }
          throw new Error(`Unexpected table ${table}`)
        },
      }),
    }

    const snapshot = await getAdminUsersAnalytics(supabase as never, undefined, {
      highParticipationThreshold: 2,
    })

    expect(snapshot.userStats['user-1']).toMatchObject({
      participations: 3,
      submissions: 0,
      hasHighParticipationIndicator: true,
    })
    expect(snapshot.userStats['user-2']).toMatchObject({
      participations: 0,
      submissions: 2,
      hasHighParticipationIndicator: false,
    })
  })

  it('counts late cancellations inside and on the threshold boundary only', async () => {
    const supabase = {
      from: (table: string) => ({
        select: (..._args: unknown[]) => {
          if (table === 'profiles') return createQuery({ data: [{ id: 'user-1' }] })
          if (table === 'slot_memberships') {
            return createQuery({
              data: [
                {
                  user_id: 'user-1',
                  status: 'CANCELLED',
                  walk_slots: { reminder_sent_at: '2026-04-09T05:00:00' },
                },
                {
                  user_id: 'user-1',
                  status: 'CANCELLED',
                  walk_slots: { reminder_sent_at: null },
                },
                {
                  user_id: 'user-1',
                  status: 'CANCELLED',
                  walk_slots: { reminder_sent_at: '2026-04-09T05:00:00' },
                },
              ],
            })
          }
          if (table === 'observations') return createQuery({ data: [] })
          throw new Error(`Unexpected table ${table}`)
        },
      }),
    }

    const snapshot = await getAdminUsersAnalytics(supabase as never, undefined, {
      highParticipationThreshold: 10,
    })

    expect(snapshot.userStats['user-1']).toMatchObject({
      cancellations: 3,
      lateCancellations: 2,
      hasLateCancellationIndicator: true,
    })
  })
})

describe('getAdminWalksAnalyticsPageSnapshotByRound', () => {
  function createQuery(result: { data?: unknown; count?: number | null }) {
    const query = {
      eq: () => query,
      order: () => query,
      limit: () => query,
      in: () => query,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(resolve({ data: result.data ?? null, error: null, count: result.count ?? null })),
    }

    return query
  }

  it('returns an empty snapshot instead of crashing when rounds are missing', async () => {
    const supabase = {
      from: (table: string) => ({
        select: (..._args: unknown[]) => {
          if (table === 'survey_rounds') return createQuery({ data: [] })
          if (table === 'walk_slots') {
            return createQuery({
              data: [
                {
                  id: 'slot-1',
                  round_id: 'missing-round',
                  walk_date: '2026-03-10',
                  start_time: '07:00:00',
                  end_time: '10:00:00',
                  location_name: 'Hill',
                  max_volunteers: 3,
                },
              ],
            })
          }
          if (table === 'slot_memberships') return createQuery({ data: [] })
          if (table === 'observations') return createQuery({ data: [] })
          if (table === 'sightings') return createQuery({ data: [] })
          if (table === 'profiles') return createQuery({ count: 0 })
          throw new Error(`Unexpected table ${table}`)
        },
      }),
    }

    await expect(getAdminWalksAnalyticsPageSnapshotByRound(supabase as never, null)).resolves.toEqual({
      availableRounds: [],
      targetRound: null,
      availableWalks: [],
      targetWalk: null,
      targetWalkRoundName: null,
      overview: null,
      reportMapPoints: [],
    })
  })

  it('includes sighted and not-sighted coordinates for the selected walk', async () => {
    const supabase = {
      from: (table: string) => ({
        select: (..._args: unknown[]) => {
          if (table === 'survey_rounds') {
            return createQuery({
              data: [
                {
                  id: 'round-1',
                  name: 'Round 1',
                  start_date: '2026-03-01',
                  end_date: '2026-03-31',
                  status: 'OPEN',
                },
              ],
            })
          }
          if (table === 'walk_slots') {
            return createQuery({
              data: [
                {
                  id: 'slot-1',
                  round_id: 'round-1',
                  walk_date: '2026-03-10',
                  start_time: '07:00:00',
                  end_time: '10:00:00',
                  location_name: 'Hill',
                  max_volunteers: 3,
                },
              ],
            })
          }
          if (table === 'slot_memberships') {
            return createQuery({
              data: [
                { slot_id: 'slot-1', user_id: 'user-1', status: 'ACTIVE' },
              ],
            })
          }
          if (table === 'observations') {
            return createQuery({
              data: [
                { id: 'obs-1', slot_id: 'slot-1', status: 'SUBMITTED', outcome: 'SIGHTED', lat: 1.35, lng: 103.81 },
                { id: 'obs-2', slot_id: 'slot-1', status: 'SUBMITTED', outcome: 'NOT_SIGHTED', lat: 1.333, lng: 103.799 },
              ],
            })
          }
          if (table === 'sightings') {
            return createQuery({
              data: [
                { observation_id: 'obs-1', lat: 1.3521, lng: 103.8198, species: 'RBL' },
                { observation_id: 'obs-1', lat: null, lng: 103.81, species: 'RBL' },
                { observation_id: 'obs-1', lat: 1.301, lng: 103.77, species: 'LTM' },
              ],
            })
          }
          if (table === 'profiles') return createQuery({ count: 0 })
          throw new Error(`Unexpected table ${table}`)
        },
      }),
    }

    const snapshot = await getAdminWalksAnalyticsPageSnapshotByRound(supabase as never, 'round-1', {
      walkId: 'slot-1',
      now: new Date('2026-03-20T12:00:00+08:00'),
    })

    expect(snapshot.reportMapPoints).toEqual([
      {
        lat: 1.3521,
        lng: 103.8198,
        outcome: 'SIGHTED',
        label: 'RBL',
        popupMeta: ['Hill', '10 Mar 2026 07:00', 'Round 1'],
        species: 'RBL',
      },
      {
        lat: 1.301,
        lng: 103.77,
        outcome: 'SIGHTED',
        label: 'LTM',
        popupMeta: ['Hill', '10 Mar 2026 07:00', 'Round 1'],
        species: 'LTM',
      },
      {
        lat: 1.333,
        lng: 103.799,
        outcome: 'NOT_SIGHTED',
        label: 'No sighting report 1',
        popupMeta: ['Hill', '10 Mar 2026 07:00', 'Round 1'],
      },
    ])
  })

  it('uses the custom species name for OTHER sighting map labels', async () => {
    const supabase = {
      from: (table: string) => ({
        select: (..._args: unknown[]) => {
          if (table === 'survey_rounds') {
            return createQuery({
              data: [
                {
                  id: 'round-1',
                  name: 'Round 1',
                  start_date: '2026-03-01',
                  end_date: '2026-03-31',
                  status: 'OPEN',
                },
              ],
            })
          }
          if (table === 'walk_slots') {
            return createQuery({
              data: [
                {
                  id: 'slot-1',
                  round_id: 'round-1',
                  walk_date: '2026-03-10',
                  start_time: '07:00:00',
                  end_time: '10:00:00',
                  location_name: 'Hill',
                  max_volunteers: 3,
                },
              ],
            })
          }
          if (table === 'slot_memberships') return createQuery({ data: [] })
          if (table === 'observations') {
            return createQuery({
              data: [
                { id: 'obs-1', slot_id: 'slot-1', status: 'SUBMITTED', outcome: 'SIGHTED', lat: 1.35, lng: 103.81 },
              ],
            })
          }
          if (table === 'sightings') {
            return createQuery({
              data: [
                { observation_id: 'obs-1', lat: 1.3521, lng: 103.8198, species: 'OTHER', species_other: 'Silvered Langur' },
              ],
            })
          }
          if (table === 'profiles') return createQuery({ count: 0 })
          throw new Error(`Unexpected table ${table}`)
        },
      }),
    }

    const snapshot = await getAdminWalksAnalyticsPageSnapshotByRound(supabase as never, 'round-1', {
      walkId: 'slot-1',
      now: new Date('2026-03-20T12:00:00+08:00'),
    })

    expect(snapshot.reportMapPoints).toEqual([
      {
        lat: 1.3521,
        lng: 103.8198,
        outcome: 'SIGHTED',
        label: 'Silvered Langur',
        popupMeta: ['Hill', '10 Mar 2026 07:00', 'Round 1'],
        species: 'OTHER',
        speciesOther: 'Silvered Langur',
      },
    ])
  })
})

describe('admin analytics report maps', () => {
  function createQuery(result: { data?: unknown; count?: number | null }) {
    const query = {
      eq: () => query,
      order: () => query,
      limit: () => query,
      in: () => query,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(resolve({ data: result.data ?? null, error: null, count: result.count ?? null })),
    }

    return query
  }

  function createAnalyticsSupabase() {
    const sightings = [
      { observation_id: 'obs-1', lat: 1.3521, lng: 103.8198, species: 'RBL' },
      { observation_id: 'obs-3', lat: 1.3099, lng: 103.7801, species: 'DUSKY' },
    ]

    return {
      from: (table: string) => ({
        select: (..._args: unknown[]) => {
          if (table === 'survey_rounds') {
            return createQuery({
              data: [
                {
                  id: 'round-1',
                  name: 'Round 1',
                  start_date: '2026-03-01',
                  end_date: '2026-03-31',
                  status: 'OPEN',
                },
                {
                  id: 'round-2',
                  name: 'Round 2',
                  start_date: '2026-04-01',
                  end_date: '2026-04-30',
                  status: 'DRAFT',
                },
              ],
            })
          }
          if (table === 'walk_slots') {
            return createQuery({
              data: [
                {
                  id: 'slot-1',
                  round_id: 'round-1',
                  walk_date: '2026-03-10',
                  start_time: '07:00:00',
                  end_time: '10:00:00',
                  location_name: 'Hill',
                  max_volunteers: 3,
                },
                {
                  id: 'slot-2',
                  round_id: 'round-2',
                  walk_date: '2026-04-12',
                  start_time: '08:00:00',
                  end_time: '10:00:00',
                  location_name: 'Coast',
                  max_volunteers: 3,
                },
              ],
            })
          }
          if (table === 'slot_memberships') return createQuery({ data: [] })
          if (table === 'observations') {
            return createQuery({
              data: [
                { id: 'obs-1', slot_id: 'slot-1', status: 'SUBMITTED', outcome: 'SIGHTED', lat: 1.35, lng: 103.81 },
                { id: 'obs-2', slot_id: 'slot-1', status: 'SUBMITTED', outcome: 'NOT_SIGHTED', lat: 1.333, lng: 103.799 },
                { id: 'obs-3', slot_id: 'slot-2', status: 'SUBMITTED', outcome: 'SIGHTED', lat: 1.31, lng: 103.78 },
              ],
            })
          }
          if (table === 'sightings') {
            const query = {
              eq: () => query,
              order: () => query,
              limit: () => query,
              in: (_column: string, ids: string[]) =>
                createQuery({
                  data: sightings.filter((sighting) => ids.includes(sighting.observation_id)),
                }),
              then: (resolve: (value: unknown) => unknown) =>
                Promise.resolve(resolve({ data: sightings, error: null, count: null })),
            }
            return query
          }
          if (table === 'profiles') return createQuery({ count: 0 })
          throw new Error(`Unexpected table ${table}`)
        },
      }),
    }
  }

  it('scopes the landing snapshot to the current round', async () => {
    const snapshot = await getAdminVolunteerAnalyticsLanding(createAnalyticsSupabase() as never, new Date('2026-03-20T12:00:00+08:00'))

    expect(snapshot.targetRound).toMatchObject({
      id: 'round-1',
      name: 'Round 1',
      status: 'OPEN',
    })
    expect(snapshot.currentRound).toMatchObject({
      totalWalks: 1,
      submittedReports: 2,
      walkSignUps: 0,
    })
    expect(snapshot.reportMapPoints).toEqual([
      {
        lat: 1.3521,
        lng: 103.8198,
        outcome: 'SIGHTED',
        label: 'RBL',
        popupMeta: ['Hill', '10 Mar 2026 07:00', 'Round 1'],
        species: 'RBL',
      },
      {
        lat: 1.333,
        lng: 103.799,
        outcome: 'NOT_SIGHTED',
        label: 'No sighting report 1',
        popupMeta: ['Hill', '10 Mar 2026 07:00', 'Round 1'],
      },
    ])
  })

  it('uses the round whose date range contains today even when another round is open', async () => {
    const snapshot = await getAdminVolunteerAnalyticsLanding(createAnalyticsSupabase() as never, new Date('2026-04-15T12:00:00+08:00'))

    expect(snapshot.targetRound).toMatchObject({
      id: 'round-2',
      name: 'Round 2',
      status: 'DRAFT',
    })
    expect(snapshot.currentRound).toMatchObject({
      totalWalks: 1,
      submittedReports: 1,
    })
    expect(snapshot.reportMapPoints).toEqual([
      {
        lat: 1.3099,
        lng: 103.7801,
        outcome: 'SIGHTED',
        label: 'DUSKY',
        popupMeta: ['Coast', '12 Apr 2026 08:00', 'Round 2'],
        species: 'DUSKY',
      },
    ])
  })

  it('includes only the selected round report map points on the rounds analytics page', async () => {
    const snapshot = await getAdminRoundsAnalyticsPageSnapshot(createAnalyticsSupabase() as never, {
      roundId: 'round-1',
      now: new Date('2026-03-20T12:00:00+08:00'),
    })

    expect(snapshot.reportMapPoints).toEqual([
      {
        lat: 1.3521,
        lng: 103.8198,
        outcome: 'SIGHTED',
        label: 'RBL',
        popupMeta: ['Hill', '10 Mar 2026 07:00', 'Round 1'],
        species: 'RBL',
      },
      {
        lat: 1.333,
        lng: 103.799,
        outcome: 'NOT_SIGHTED',
        label: 'No sighting report 1',
        popupMeta: ['Hill', '10 Mar 2026 07:00', 'Round 1'],
      },
    ])
  })
})
