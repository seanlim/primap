import { buildVolunteerAnalyticsSnapshot } from '@/lib/admin-volunteer-analytics'

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
        { id: 'ended-slot', walk_date: '2026-03-10', end_time: '10:00:00', max_volunteers: 3 },
        { id: 'future-slot', walk_date: '2026-03-25', end_time: '10:00:00', max_volunteers: 3 },
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
        { id: 'slot-1', walk_date: '2026-03-10', end_time: '10:00:00', max_volunteers: 2 },
        { id: 'slot-2', walk_date: '2026-03-11', end_time: '10:00:00', max_volunteers: 4 },
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
        { id: 'slot-1', walk_date: '2026-03-10', end_time: '10:00:00', max_volunteers: 3 },
        { id: 'slot-2', walk_date: '2026-03-11', end_time: '10:00:00', max_volunteers: 3 },
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
        { id: 'slot-1', walk_date: '2026-03-10', end_time: '10:00:00', max_volunteers: 3 },
        { id: 'slot-2', walk_date: '2026-03-11', end_time: '10:00:00', max_volunteers: 3 },
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
})
