import { revalidatePath } from 'next/cache'

// ─── Hoisted mocks ──────────────────────────────────────────────────────────
//
// `reportIncident` makes several `from()` calls in sequence:
//   1. from('slot_memberships').select().eq().eq().eq().maybeSingle() — membership
//   2. from('incidents').insert({...}).select('id').single()          — insert
//   3. from('profiles').select().eq('id', user.id).single()           — reporter
//   4. from('walk_slots').select().eq('id', walkId).single()          — walk
//   5. from('profiles').select().eq('role','ADMIN').eq('status','ACTIVE') — admins
//
// The cleanest mock is a table-aware `from()` that returns a fresh chain per
// table per call so we can configure each one independently.

const { mockSupabase, tableMocks, getInsertChain, sendIncidentReportedEmail } = vi.hoisted(() => {
  type ChainResult = { data: unknown; error: { message: string } | null }

  function makeAwaitableChain(result: ChainResult) {
    const chain: Record<string, unknown> & PromiseLike<ChainResult> = {
      select: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      delete: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      neq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve(result)),
      maybeSingle: vi.fn(() => Promise.resolve(result)),
      then: (resolve: (value: ChainResult) => unknown) => resolve(result),
    } as Record<string, unknown> & PromiseLike<ChainResult>
    return chain
  }

  // Per-test configuration
  const tableMocks = {
    membership: {
      // .maybeSingle() returns the row directly (or null), not an array.
      data: { id: 'membership-1' } as unknown,
      error: null as { message: string } | null,
    },
    insertIncident: {
      data: { id: 'inc-1' } as unknown,
      error: null as { message: string } | null,
    },
    reporter: {
      data: { full_name: 'Volunteer One', email: 'vol@example.com' } as unknown,
      error: null as { message: string } | null,
    },
    walk: {
      data: { location_name: 'Bukit Timah', walk_date: '2026-04-15' } as unknown,
      error: null as { message: string } | null,
    },
    admins: {
      data: [{ email: 'admin1@example.com' }, { email: 'admin2@example.com' }] as unknown,
      error: null as { message: string } | null,
    },
  }

  // Track the insert chain so tests can assert on the .insert() call payload
  let lastInsertChain: ReturnType<typeof makeAwaitableChain> | null = null

  // Counts of how many times each profile select has been called, so we can
  // route the first profile lookup (reporter by id) vs the second (admin list)
  let profileCallNumber = 0

  const fromMock = vi.fn((table: string) => {
    if (table === 'slot_memberships') {
      return makeAwaitableChain({ data: tableMocks.membership.data, error: tableMocks.membership.error })
    }
    if (table === 'incidents') {
      const chain = makeAwaitableChain({ data: tableMocks.insertIncident.data, error: tableMocks.insertIncident.error })
      lastInsertChain = chain
      return chain
    }
    if (table === 'walk_slots') {
      return makeAwaitableChain({ data: tableMocks.walk.data, error: tableMocks.walk.error })
    }
    if (table === 'profiles') {
      profileCallNumber += 1
      // First call is reporter lookup (by id, returns single object)
      // Subsequent call(s) are admin lookups (by role/status, returns array)
      if (profileCallNumber === 1) {
        return makeAwaitableChain({ data: tableMocks.reporter.data, error: tableMocks.reporter.error })
      }
      return makeAwaitableChain({ data: tableMocks.admins.data, error: tableMocks.admins.error })
    }
    return makeAwaitableChain({ data: null, error: null })
  })

  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: fromMock,
  }

  // Export a helper to retrieve the most recent incidents insert chain
  const getInsertChain = () => lastInsertChain
  const resetProfileCounter = () => {
    profileCallNumber = 0
  }
  ;(tableMocks as Record<string, unknown>).resetProfileCounter = resetProfileCounter

  const sendIncidentReportedEmail = vi.fn().mockResolvedValue(undefined)

  return { mockSupabase, tableMocks, getInsertChain, sendIncidentReportedEmail }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('@/lib/email', () => ({
  sendIncidentReportedEmail,
}))

import { reportIncident } from '@/lib/actions/incident-actions'

const validInput = {
  walkId: 'slot-1',
  incidentType: 'INJURED_ANIMAL' as const,
  description: 'Found injured monkey',
}

function setAuthedUser(id = 'user-1') {
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id } } })
}

function resetTableMocks() {
  tableMocks.membership.data = { id: 'membership-1' }
  tableMocks.membership.error = null
  tableMocks.insertIncident.data = { id: 'inc-1' }
  tableMocks.insertIncident.error = null
  tableMocks.reporter.data = { full_name: 'Volunteer One', email: 'vol@example.com' }
  tableMocks.reporter.error = null
  tableMocks.walk.data = { location_name: 'Bukit Timah', walk_date: '2026-04-15' }
  tableMocks.walk.error = null
  tableMocks.admins.data = [{ email: 'admin1@example.com' }, { email: 'admin2@example.com' }]
  tableMocks.admins.error = null
  ;(tableMocks as unknown as { resetProfileCounter: () => void }).resetProfileCounter()
}

describe('incident-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetTableMocks()
    sendIncidentReportedEmail.mockResolvedValue(undefined)
  })

  describe('reportIncident — auth & membership', () => {
    it('returns error when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const result = await reportIncident(validInput)

      expect(result).toEqual({ error: 'Not authenticated' })
      expect(sendIncidentReportedEmail).not.toHaveBeenCalled()
      expect(revalidatePath).not.toHaveBeenCalled()
    })

    it('returns error when membership query errors', async () => {
      setAuthedUser()
      tableMocks.membership.data = null
      tableMocks.membership.error = { message: 'Membership lookup failed' }

      const result = await reportIncident(validInput)

      expect(result).toEqual({ error: 'Membership lookup failed' })
      expect(sendIncidentReportedEmail).not.toHaveBeenCalled()
    })

    it('returns error when user is not an active slot participant', async () => {
      setAuthedUser()
      tableMocks.membership.data = null // .maybeSingle() returns null when no row

      const result = await reportIncident(validInput)

      expect(result).toEqual({
        error: 'Only walk participants can report incidents for this walk',
      })
      expect(sendIncidentReportedEmail).not.toHaveBeenCalled()
    })

    it('fail-closed: rejects when membership data is undefined (no legacy compat)', async () => {
      setAuthedUser()
      // Defensive: if the query somehow returns undefined data with no error,
      // the action MUST reject (fail-closed). This guards against any client
      // quirk that might return a malformed response.
      tableMocks.membership.data = undefined as unknown as typeof tableMocks.membership.data

      const result = await reportIncident(validInput)

      expect(result).toEqual({
        error: 'Only walk participants can report incidents for this walk',
      })
      expect(sendIncidentReportedEmail).not.toHaveBeenCalled()
    })
  })

  describe('reportIncident — successful submission', () => {
    it('returns success with incidentId on happy path with lat/lng', async () => {
      setAuthedUser()

      const result = await reportIncident({ ...validInput, lat: 1.3521, lng: 103.8198 })

      expect(result).toEqual({ success: true, incidentId: 'inc-1' })
      expect(mockSupabase.from).toHaveBeenCalledWith('incidents')
      const insertChain = getInsertChain()
      expect(insertChain?.insert).toHaveBeenCalledWith({
        slot_id: 'slot-1',
        reported_by: 'user-1',
        incident_type: 'INJURED_ANIMAL',
        description: 'Found injured monkey',
        lat: 1.3521,
        lng: 103.8198,
      })
    })

    it('returns success without lat/lng', async () => {
      setAuthedUser()

      const result = await reportIncident(validInput)

      expect(result).toEqual({ success: true, incidentId: 'inc-1' })
      const insertChain = getInsertChain()
      expect(insertChain?.insert).toHaveBeenCalledWith(
        expect.objectContaining({ lat: undefined, lng: undefined })
      )
    })

    it('returns error gracefully when insert returns no data id', async () => {
      setAuthedUser()
      tableMocks.insertIncident.data = null

      const result = await reportIncident(validInput)

      expect(result).toEqual({ error: 'Failed to create incident' })
      expect(sendIncidentReportedEmail).not.toHaveBeenCalled()
      expect(revalidatePath).not.toHaveBeenCalled()
    })

    it('returns error on DB insert failure', async () => {
      setAuthedUser()
      tableMocks.insertIncident.data = null
      tableMocks.insertIncident.error = { message: 'Insert failed' }

      const result = await reportIncident(validInput)

      expect(result).toEqual({ error: 'Insert failed' })
      expect(revalidatePath).not.toHaveBeenCalled()
      expect(sendIncidentReportedEmail).not.toHaveBeenCalled()
    })
  })

  describe('reportIncident — admin notification', () => {
    it('calls sendIncidentReportedEmail with active admin emails after successful insert', async () => {
      setAuthedUser()

      await reportIncident(validInput)

      expect(sendIncidentReportedEmail).toHaveBeenCalledTimes(1)
      expect(sendIncidentReportedEmail).toHaveBeenCalledWith(
        ['admin1@example.com', 'admin2@example.com'],
        expect.objectContaining({
          typeLabel: 'Injured Animal',
          description: 'Found injured monkey',
          reporterName: 'Volunteer One',
          walkLocation: 'Bukit Timah',
          walkDate: '2026-04-15',
        })
      )
      // The action must NOT pass mediaCount — it always fires before media
      // upload, and the email template intentionally omits attachment counts.
      const callPayload = sendIncidentReportedEmail.mock.calls[0][1]
      expect(callPayload).not.toHaveProperty('mediaCount')
    })

    it('does NOT call email helper when there are zero active admins', async () => {
      setAuthedUser()
      tableMocks.admins.data = []

      const result = await reportIncident(validInput)

      expect(result).toMatchObject({ success: true })
      expect(sendIncidentReportedEmail).not.toHaveBeenCalled()
    })

    it('still returns success when admin lookup errors', async () => {
      setAuthedUser()
      tableMocks.admins.data = null
      tableMocks.admins.error = { message: 'Admin lookup failed' }

      const result = await reportIncident(validInput)

      expect(result).toMatchObject({ success: true, incidentId: 'inc-1' })
      expect(sendIncidentReportedEmail).not.toHaveBeenCalled()
    })

    it('still returns success when sendIncidentReportedEmail throws', async () => {
      setAuthedUser()
      sendIncidentReportedEmail.mockRejectedValueOnce(new Error('SMTP down'))

      const result = await reportIncident(validInput)

      expect(result).toMatchObject({ success: true, incidentId: 'inc-1' })
      // revalidate must still happen so admins see the new incident on next visit
      expect(revalidatePath).toHaveBeenCalledWith('/admin/incidents')
    })

    it('falls back to email when reporter has no full_name', async () => {
      setAuthedUser()
      tableMocks.reporter.data = { full_name: null, email: 'fallback@example.com' }

      await reportIncident(validInput)

      expect(sendIncidentReportedEmail).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ reporterName: 'fallback@example.com' })
      )
    })

    it('falls back to "A volunteer" when reporter lookup returns null', async () => {
      setAuthedUser()
      tableMocks.reporter.data = null

      await reportIncident(validInput)

      expect(sendIncidentReportedEmail).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ reporterName: 'A volunteer' })
      )
    })

    it('falls back to "Unknown location" when walk lookup returns null', async () => {
      setAuthedUser()
      tableMocks.walk.data = null

      await reportIncident(validInput)

      expect(sendIncidentReportedEmail).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ walkLocation: 'Unknown location', walkDate: '' })
      )
    })

    it('passes the human-readable label for each incident type', async () => {
      setAuthedUser()

      await reportIncident({ ...validInput, incidentType: 'HUMAN_WILDLIFE_CONFLICT' })

      expect(sendIncidentReportedEmail).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ typeLabel: 'Human-Wildlife Conflict' })
      )
    })
  })

  describe('reportIncident — revalidation', () => {
    it('revalidates /report/{walkId} on success', async () => {
      setAuthedUser()

      await reportIncident(validInput)

      expect(revalidatePath).toHaveBeenCalledWith('/report/slot-1')
    })

    it('revalidates /admin/incidents on success (regression for previous /admin/reports bug)', async () => {
      setAuthedUser()

      await reportIncident(validInput)

      expect(revalidatePath).toHaveBeenCalledWith('/admin/incidents')
    })

    it('does NOT revalidate the deprecated /admin/reports paths', async () => {
      setAuthedUser()

      await reportIncident(validInput)

      const calls = (revalidatePath as unknown as { mock: { calls: unknown[][] } }).mock.calls
      const args = calls.map(c => c[0])
      expect(args).not.toContain('/admin/reports')
      expect(args).not.toContain('/admin/reports/slot-1')
    })

    it('does not revalidate on failed insert', async () => {
      setAuthedUser()
      tableMocks.insertIncident.data = null
      tableMocks.insertIncident.error = { message: 'boom' }

      await reportIncident(validInput)

      expect(revalidatePath).not.toHaveBeenCalled()
    })
  })
})
