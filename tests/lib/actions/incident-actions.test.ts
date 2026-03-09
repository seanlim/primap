import { revalidatePath } from 'next/cache'

const { mockSupabase, methods } = vi.hoisted(() => {
  const methods = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    limit: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  for (const key of Object.keys(methods) as (keyof typeof methods)[]) {
    if (key !== 'single') methods[key].mockReturnThis()
  }
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn().mockReturnValue(methods),
  }
  return { mockSupabase, methods }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

import { reportIncident } from '@/lib/actions/incident-actions'

function resetChain() {
  methods.select.mockReturnThis()
  methods.insert.mockReturnThis()
  methods.update.mockReturnThis()
  methods.delete.mockReturnThis()
  methods.upsert.mockReturnThis()
  methods.eq.mockReturnThis()
  methods.neq.mockReturnThis()
  methods.in.mockReturnThis()
  methods.limit.mockReturnThis()
  methods.single.mockResolvedValue({ data: null, error: null })
}

const validInput = {
  slotId: 'slot-1',
  incidentType: 'INJURED_ANIMAL' as const,
  description: 'Found injured monkey',
}

describe('incident-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
  })

  describe('reportIncident', () => {
    it('returns error when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const result = await reportIncident(validInput)

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('succeeds with lat/lng', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
      })

      const result = await reportIncident({
        ...validInput,
        lat: 1.3521,
        lng: 103.8198,
      })

      expect(result).toEqual({ success: true })
      expect(mockSupabase.from).toHaveBeenCalledWith('incidents')
      expect(methods.insert).toHaveBeenCalledWith({
        slot_id: 'slot-1',
        reported_by: 'user-1',
        incident_type: 'INJURED_ANIMAL',
        description: 'Found injured monkey',
        lat: 1.3521,
        lng: 103.8198,
      })
      expect(revalidatePath).toHaveBeenCalledWith('/report/slot-1')
    })

    it('succeeds without lat/lng', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
      })

      const result = await reportIncident(validInput)

      expect(result).toEqual({ success: true })
      expect(methods.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          lat: undefined,
          lng: undefined,
        })
      )
    })

    it('returns error on DB insert failure', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
      })
      methods.insert.mockReturnValueOnce({
        error: { message: 'Insert failed' },
      })

      const result = await reportIncident(validInput)

      expect(result).toEqual({ error: 'Insert failed' })
      expect(revalidatePath).not.toHaveBeenCalled()
    })
  })
})
