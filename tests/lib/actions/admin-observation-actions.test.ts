import { revalidatePath } from 'next/cache'

// ── Hoisted mocks ──────────────────────────────────────────────────────

const { mockSupabase, methods, mockAdminSupabase, adminMethods, adminStorage } =
  vi.hoisted(() => {
    // Regular supabase client (for auth / requireAdmin role check)
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

    // Admin (service-role) supabase client – used by the actions under test
    const adminMethods = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      eq: vi.fn(),
      neq: vi.fn(),
      in: vi.fn(),
      limit: vi.fn(),
      order: vi.fn(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    for (const key of Object.keys(adminMethods) as (keyof typeof adminMethods)[]) {
      if (key !== 'single') adminMethods[key].mockReturnThis()
    }
    const adminStorage = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    }
    const mockAdminSupabase = {
      from: vi.fn().mockReturnValue(adminMethods),
      storage: {
        from: vi.fn().mockReturnValue(adminStorage),
      },
    }

    return { mockSupabase, methods, mockAdminSupabase, adminMethods, adminStorage }
  })

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminSupabase),
}))

import {
  adminGetObservation,
  adminUpdateObservation,
  adminDeleteMedia,
} from '@/lib/actions/admin-observation-actions'

// ── Helpers ────────────────────────────────────────────────────────────

function resetChain() {
  // Regular client chain
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

  // Admin client chain
  adminMethods.select.mockReturnThis()
  adminMethods.insert.mockReturnThis()
  adminMethods.update.mockReturnThis()
  adminMethods.delete.mockReturnThis()
  adminMethods.upsert.mockReturnThis()
  adminMethods.eq.mockReturnThis()
  adminMethods.neq.mockReturnThis()
  adminMethods.in.mockReturnThis()
  adminMethods.limit.mockReturnThis()
  adminMethods.order.mockReturnThis()
  adminMethods.single.mockResolvedValue({ data: null, error: null })
  adminStorage.upload.mockResolvedValue({ error: null })
  adminStorage.remove.mockResolvedValue({ error: null })

  // Reset from() implementations
  mockAdminSupabase.from.mockReturnValue(adminMethods)
}

function setupAdmin() {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: 'admin-1' } },
  })
  // requireAdmin → profiles select where role = ADMIN
  methods.single.mockResolvedValueOnce({ data: { role: 'ADMIN' }, error: null })
}

const baseUpdateInput = {
  observationId: 'obs-1',
  walkId: 'slot-1',
  walkCompletion: 'COMPLETED' as const,
  outcome: 'NOT_SIGHTED' as const,
  notes: 'Updated by admin',
  lat: 1.35,
  lng: 103.82,
}

const sightingInput = {
  species: 'RBL' as const,
  count: '3',
  lat: 1.36,
  lng: 103.83,
  notes: 'Near trail',
}

const otherSightingInput = {
  species: 'OTHER' as const,
  species_other: 'Silvered Langur',
  count: '2',
  lat: 1.37,
  lng: 103.84,
  notes: 'Unusual species',
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('admin-observation-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
  })

  // ─── requireAdmin (shared by all actions) ────────────────────────────

  describe('requireAdmin', () => {
    it('throws when no user is authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      await expect(adminGetObservation('obs-1')).rejects.toThrow(
        'Not authenticated'
      )
    })

    it('throws when role is VOLUNTEER', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
      })
      methods.single.mockResolvedValueOnce({
        data: { role: 'VOLUNTEER' },
        error: null,
      })

      await expect(adminGetObservation('obs-1')).rejects.toThrow(
        'Not authorized'
      )
    })

    it('throws when profile lookup returns null', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
      })
      methods.single.mockResolvedValueOnce({ data: null, error: null })

      await expect(adminGetObservation('obs-1')).rejects.toThrow(
        'Not authorized'
      )
    })

    it('throws on adminUpdateObservation when not admin', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      await expect(adminUpdateObservation(baseUpdateInput)).rejects.toThrow(
        'Not authenticated'
      )
    })

    it('throws on adminDeleteMedia when not admin', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      await expect(adminDeleteMedia('media-1')).rejects.toThrow(
        'Not authenticated'
      )
    })
  })

  // ─── adminGetObservation ─────────────────────────────────────────────

  describe('adminGetObservation', () => {
    it('returns null when observation is not found', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      })

      const result = await adminGetObservation('nonexistent')

      expect(result).toBeNull()
      expect(mockAdminSupabase.from).toHaveBeenCalledWith('observations')
    })

    it('returns the full observation with sightings and media', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: {
          id: 'obs-1',
          user_id: 'user-1',
          slot_id: 'slot-1',
          walk_completion: 'COMPLETED',
          outcome: 'SIGHTED',
          notes: 'Test notes',
          lat: null,
          lng: null,
          status: 'SUBMITTED',
          profiles: { full_name: 'Alice', email: 'alice@test.com' },
          sightings: [
            {
              id: 'sight-1',
              species: 'RBL',
              species_other: null,
              count: '3',
              observed_at: '2026-04-01T08:30:00.000Z',
              lat: 1.36,
              lng: 103.83,
              notes: 'Near trail',
              media: [{ id: 'm1', file_path: 'p.jpg', file_name: 'p.jpg', media_type: 'PHOTO' }],
            },
          ],
          media: [],
        },
        error: null,
      })

      const result = await adminGetObservation('obs-1')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('obs-1')
      expect(result!.userId).toBe('user-1')
      expect(result!.userName).toBe('Alice')
      expect(result!.slotId).toBe('slot-1')
      expect(result!.walkCompletion).toBe('COMPLETED')
      expect(result!.outcome).toBe('SIGHTED')
      expect(result!.notes).toBe('Test notes')
      expect(result!.status).toBe('SUBMITTED')
      expect(result!.sightings).toHaveLength(1)
      expect(result!.sightings[0].species).toBe('RBL')
      expect(result!.sightings[0].media).toHaveLength(1)
      expect(result!.media).toHaveLength(0)
    })

    it('uses email as userName when full_name is null', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: {
          id: 'obs-1',
          user_id: 'user-1',
          slot_id: 'slot-1',
          walk_completion: 'COMPLETED',
          outcome: 'NOT_SIGHTED',
          notes: null,
          lat: 1.35,
          lng: 103.82,
          status: 'SUBMITTED',
          profiles: { full_name: null, email: 'alice@test.com' },
          sightings: [],
          media: [],
        },
        error: null,
      })

      const result = await adminGetObservation('obs-1')

      expect(result!.userName).toBe('alice@test.com')
    })

    it('slices observed_at to 16 chars for datetime-local input', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: {
          id: 'obs-1',
          user_id: 'user-1',
          slot_id: 'slot-1',
          walk_completion: 'COMPLETED',
          outcome: 'SIGHTED',
          notes: null,
          lat: null,
          lng: null,
          status: 'SUBMITTED',
          profiles: { full_name: 'Alice', email: 'alice@test.com' },
          sightings: [
            {
              id: 'sight-1',
              species: 'LTM',
              species_other: null,
              count: '5',
              observed_at: '2026-04-01T08:30:00.000Z',
              lat: 1.36,
              lng: 103.83,
              notes: null,
              media: [],
            },
          ],
          media: [],
        },
        error: null,
      })

      const result = await adminGetObservation('obs-1')

      expect(result!.sightings[0].observedAt).toBe('2026-04-01T08:30')
    })

    it('returns null observedAt when observed_at is null', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: {
          id: 'obs-1',
          user_id: 'user-1',
          slot_id: 'slot-1',
          walk_completion: 'COMPLETED',
          outcome: 'SIGHTED',
          notes: null,
          lat: null,
          lng: null,
          status: 'SUBMITTED',
          profiles: { full_name: 'Alice', email: 'alice@test.com' },
          sightings: [
            {
              id: 'sight-1',
              species: 'RBL',
              species_other: null,
              count: '1',
              observed_at: null,
              lat: 1.36,
              lng: 103.83,
              notes: null,
              media: [],
            },
          ],
          media: [],
        },
        error: null,
      })

      const result = await adminGetObservation('obs-1')

      expect(result!.sightings[0].observedAt).toBeNull()
    })
  })

  // ─── adminUpdateObservation ──────────────────────────────────────────

  describe('adminUpdateObservation', () => {
    it('returns error when observation does not exist', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: null,
        error: null,
      })

      const result = await adminUpdateObservation(baseUpdateInput)

      expect(result).toEqual({ error: 'Observation not found' })
    })

    it('updates a NOT_SIGHTED observation with no sightings', async () => {
      setupAdmin()
      // 1) existing check
      adminMethods.single.mockResolvedValueOnce({
        data: { id: 'obs-1' },
        error: null,
      })

      const result = await adminUpdateObservation(baseUpdateInput)

      expect(result).toEqual({ success: true })
      expect(mockAdminSupabase.from).toHaveBeenCalledWith('observations')
      expect(adminMethods.update).toHaveBeenCalledWith(
        expect.objectContaining({
          walk_completion: 'COMPLETED',
          outcome: 'NOT_SIGHTED',
          notes: 'Updated by admin',
          lat: 1.35,
          lng: 103.82,
        })
      )
      expect(revalidatePath).toHaveBeenCalledWith('/admin/reports/slot-1')
      expect(revalidatePath).toHaveBeenCalledWith('/report/slot-1')
    })

    it('nullifies lat/lng for SIGHTED outcome', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: { id: 'obs-1' },
        error: null,
      })

      const result = await adminUpdateObservation({
        ...baseUpdateInput,
        outcome: 'SIGHTED',
        lat: 1.35,
        lng: 103.82,
        sightings: [sightingInput],
      })

      expect(result).toEqual({ success: true })
      expect(adminMethods.update).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'SIGHTED',
          lat: null,
          lng: null,
        })
      )
    })

    it('returns error when observation update fails', async () => {
      setupAdmin()

      let fromCallCount = 0
      mockAdminSupabase.from.mockImplementation(() => {
        fromCallCount++
        // Call 1: observations existence check
        if (fromCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'obs-1' },
                  error: null,
                }),
              }),
            }),
          }
        }
        // Call 2: observations update — fails
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: { message: 'DB update error' },
            }),
          }),
        }
      })

      const result = await adminUpdateObservation(baseUpdateInput)

      expect(result).toEqual({ error: 'DB update error' })
      mockAdminSupabase.from.mockReturnValue(adminMethods)
    })

    // Helper: builds a from() mock for adminUpdateObservation multi-query flows.
    // Call 1 = observations existence check, Call 2 = observations update,
    // subsequent calls are per-test custom chains.
    function setupUpdateFromMock(customCalls: Record<number, unknown>) {
      let fromCallCount = 0
      mockAdminSupabase.from.mockImplementation(() => {
        fromCallCount++
        if (customCalls[fromCallCount]) return customCalls[fromCallCount]
        return adminMethods
      })
    }

    it('inserts new sightings when no ID is present', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: { id: 'obs-1' },
        error: null,
      })

      setupUpdateFromMock({
        // Call 1: observations select (existence) → handled by adminMethods.single
        // Call 2: observations update → adminMethods (default)
        // Call 3: sightings select (existing)
        3: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [] }),
          }),
        },
        // Call 4: sightings insert → adminMethods (default)
      })

      const result = await adminUpdateObservation({
        ...baseUpdateInput,
        outcome: 'SIGHTED',
        sightings: [sightingInput],
      })

      expect(result).toEqual({ success: true })
      expect(adminMethods.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          observation_id: 'obs-1',
          species: 'RBL',
          count: '3',
          lat: 1.36,
          lng: 103.83,
        })
      )

      mockAdminSupabase.from.mockReturnValue(adminMethods)
    })

    it('updates existing sightings by ID', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: { id: 'obs-1' },
        error: null,
      })

      setupUpdateFromMock({
        3: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [{ id: 'sight-1' }] }),
          }),
        },
      })

      const result = await adminUpdateObservation({
        ...baseUpdateInput,
        outcome: 'SIGHTED',
        sightings: [{ ...sightingInput, id: 'sight-1' }],
      })

      expect(result).toEqual({ success: true })
      expect(adminMethods.update).toHaveBeenCalledWith(
        expect.objectContaining({
          species: 'RBL',
          count: '3',
        })
      )

      mockAdminSupabase.from.mockReturnValue(adminMethods)
    })

    it('removes sightings no longer in the form and cleans up media', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: { id: 'obs-1' },
        error: null,
      })

      setupUpdateFromMock({
        // Call 3: sightings select (existing)
        3: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'sight-old' }, { id: 'sight-keep' }],
            }),
          }),
        },
        // Call 4: media select (for cleanup of sight-old)
        4: {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ file_path: 'user-1/sight-old/photo.jpg' }],
            }),
          }),
        },
        // Call 5+: sightings delete, sighting update → adminMethods
      })

      const result = await adminUpdateObservation({
        ...baseUpdateInput,
        outcome: 'SIGHTED',
        sightings: [{ ...sightingInput, id: 'sight-keep' }],
      })

      expect(result).toEqual({ success: true })
      expect(adminStorage.remove).toHaveBeenCalledWith([
        'user-1/sight-old/photo.jpg',
      ])

      mockAdminSupabase.from.mockReturnValue(adminMethods)
    })

    it('removes all existing sightings with media when form has empty sightings array', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: { id: 'obs-1' },
        error: null,
      })

      setupUpdateFromMock({
        3: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'sight-a' }],
            }),
          }),
        },
        4: {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ file_path: 'path/a.jpg' }, { file_path: 'path/b.jpg' }],
            }),
          }),
        },
      })

      const result = await adminUpdateObservation({
        ...baseUpdateInput,
        sightings: [],
      })

      expect(result).toEqual({ success: true })
      expect(adminStorage.remove).toHaveBeenCalledWith([
        'path/a.jpg',
        'path/b.jpg',
      ])

      mockAdminSupabase.from.mockReturnValue(adminMethods)
    })

    it('removes all sightings when sightings is undefined (no sightings provided)', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: { id: 'obs-1' },
        error: null,
      })

      setupUpdateFromMock({
        3: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'sight-x' }],
            }),
          }),
        },
        4: {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [] }),
          }),
        },
      })

      const result = await adminUpdateObservation({
        observationId: 'obs-1',
        walkId: 'slot-1',
        walkCompletion: 'COMPLETED',
        outcome: 'NOT_SIGHTED',
        lat: 1.0,
        lng: 103.0,
      })

      expect(result).toEqual({ success: true })

      mockAdminSupabase.from.mockReturnValue(adminMethods)
    })

    it('handles mixed sightings: update existing, insert new, remove stale', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: { id: 'obs-1' },
        error: null,
      })

      setupUpdateFromMock({
        3: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'sight-keep' },
                { id: 'sight-remove' },
              ],
            }),
          }),
        },
        // media select for removed sighting
        4: {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [] }),
          }),
        },
      })

      const result = await adminUpdateObservation({
        ...baseUpdateInput,
        outcome: 'SIGHTED',
        sightings: [
          { ...sightingInput, id: 'sight-keep' },
          { ...sightingInput },
        ],
      })

      expect(result).toEqual({ success: true })

      mockAdminSupabase.from.mockReturnValue(adminMethods)
    })

    it('sets notes to null when notes is empty', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: { id: 'obs-1' },
        error: null,
      })

      await adminUpdateObservation({
        ...baseUpdateInput,
        notes: '',
      })

      expect(adminMethods.update).toHaveBeenCalledWith(
        expect.objectContaining({ notes: null })
      )
    })

    it('sets notes to null when notes is undefined', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: { id: 'obs-1' },
        error: null,
      })

      await adminUpdateObservation({
        ...baseUpdateInput,
        notes: undefined,
      })

      expect(adminMethods.update).toHaveBeenCalledWith(
        expect.objectContaining({ notes: null })
      )
    })

    it('sets species_other correctly for OTHER species', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: { id: 'obs-1' },
        error: null,
      })

      setupUpdateFromMock({
        3: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [] }),
          }),
        },
      })

      await adminUpdateObservation({
        ...baseUpdateInput,
        outcome: 'SIGHTED',
        sightings: [otherSightingInput],
      })

      expect(adminMethods.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          species: 'OTHER',
          species_other: 'Silvered Langur',
        })
      )

      mockAdminSupabase.from.mockReturnValue(adminMethods)
    })

    it('sets species_other to null for non-OTHER species', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: { id: 'obs-1' },
        error: null,
      })

      setupUpdateFromMock({
        3: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [] }),
          }),
        },
      })

      await adminUpdateObservation({
        ...baseUpdateInput,
        outcome: 'SIGHTED',
        sightings: [sightingInput],
      })

      expect(adminMethods.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          species: 'RBL',
          species_other: null,
        })
      )

      mockAdminSupabase.from.mockReturnValue(adminMethods)
    })

    it('does not remove any sightings when all existing IDs are kept', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: { id: 'obs-1' },
        error: null,
      })

      setupUpdateFromMock({
        3: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'sight-1' }, { id: 'sight-2' }],
            }),
          }),
        },
      })

      const result = await adminUpdateObservation({
        ...baseUpdateInput,
        outcome: 'SIGHTED',
        sightings: [
          { ...sightingInput, id: 'sight-1' },
          { ...sightingInput, id: 'sight-2' },
        ],
      })

      expect(result).toEqual({ success: true })
      expect(adminMethods.delete).not.toHaveBeenCalled()
      expect(adminStorage.remove).not.toHaveBeenCalled()

      mockAdminSupabase.from.mockReturnValue(adminMethods)
    })

    it('skips media cleanup when removed sightings have no media', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: { id: 'obs-1' },
        error: null,
      })

      setupUpdateFromMock({
        3: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'sight-removed' }],
            }),
          }),
        },
        4: {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [] }),
          }),
        },
      })

      const result = await adminUpdateObservation({
        ...baseUpdateInput,
        sightings: [],
      })

      expect(result).toEqual({ success: true })
      expect(adminStorage.remove).not.toHaveBeenCalled()

      mockAdminSupabase.from.mockReturnValue(adminMethods)
    })

    it('skips sighting removal when existing sightings query returns empty', async () => {
      setupAdmin()
      adminMethods.single.mockResolvedValueOnce({
        data: { id: 'obs-1' },
        error: null,
      })

      setupUpdateFromMock({
        3: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [] }),
          }),
        },
      })

      const result = await adminUpdateObservation({
        ...baseUpdateInput,
        sightings: [sightingInput],
      })

      expect(result).toEqual({ success: true })
      expect(adminMethods.delete).not.toHaveBeenCalled()

      mockAdminSupabase.from.mockReturnValue(adminMethods)
    })
  })

  // ─── adminDeleteMedia ────────────────────────────────────────────────

  // adminDeleteMedia makes TWO queries to from('media'): select then delete.
  // Use from.mockImplementation to return separate chains per call.
  function setupDeleteMediaMocks(opts: {
    selectData?: Record<string, unknown> | null
    deleteError?: { message: string } | null
  }) {
    let fromCallCount = 0
    mockAdminSupabase.from.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        // select chain → .select().eq().single()
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: opts.selectData ?? null,
                error: null,
              }),
            }),
          }),
        }
      }
      // delete chain → .delete().eq()
      return {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: opts.deleteError ?? null,
          }),
        }),
      }
    })
  }

  describe('adminDeleteMedia', () => {
    afterEach(() => {
      mockAdminSupabase.from.mockReturnValue(adminMethods)
    })

    it('returns error when media record is not found', async () => {
      setupAdmin()
      setupDeleteMediaMocks({ selectData: null })

      const result = await adminDeleteMedia('nonexistent')

      expect(result).toEqual({ error: 'Media not found' })
    })

    it('deletes observation media and cleans up storage', async () => {
      setupAdmin()
      setupDeleteMediaMocks({
        selectData: {
          file_path: 'user-1/obs-1/photo.jpg',
          observation_id: 'obs-1',
          sighting_id: null,
          incident_id: null,
        },
      })

      const result = await adminDeleteMedia('media-1')

      expect(result).toEqual({ success: true })
      expect(mockAdminSupabase.storage.from).toHaveBeenCalledWith(
        'observation-media'
      )
      expect(adminStorage.remove).toHaveBeenCalledWith([
        'user-1/obs-1/photo.jpg',
      ])
    })

    it('deletes sighting media and uses observation-media bucket', async () => {
      setupAdmin()
      setupDeleteMediaMocks({
        selectData: {
          file_path: 'user-1/sight-1/photo.jpg',
          observation_id: null,
          sighting_id: 'sight-1',
          incident_id: null,
        },
      })

      const result = await adminDeleteMedia('media-2')

      expect(result).toEqual({ success: true })
      expect(mockAdminSupabase.storage.from).toHaveBeenCalledWith(
        'observation-media'
      )
    })

    it('deletes incident media and uses incident-media bucket', async () => {
      setupAdmin()
      setupDeleteMediaMocks({
        selectData: {
          file_path: 'user-1/inc-1/photo.jpg',
          observation_id: null,
          sighting_id: null,
          incident_id: 'inc-1',
        },
      })

      const result = await adminDeleteMedia('media-3')

      expect(result).toEqual({ success: true })
      expect(mockAdminSupabase.storage.from).toHaveBeenCalledWith(
        'incident-media'
      )
    })

    it('returns error when DB delete fails', async () => {
      setupAdmin()
      setupDeleteMediaMocks({
        selectData: {
          file_path: 'user-1/obs-1/photo.jpg',
          observation_id: 'obs-1',
          sighting_id: null,
          incident_id: null,
        },
        deleteError: { message: 'Delete denied' },
      })

      const result = await adminDeleteMedia('media-1')

      expect(result).toEqual({ error: 'Delete denied' })
      expect(adminStorage.remove).not.toHaveBeenCalled()
    })

    it('succeeds even if storage cleanup fails (orphan is tolerable)', async () => {
      setupAdmin()
      setupDeleteMediaMocks({
        selectData: {
          file_path: 'user-1/obs-1/photo.jpg',
          observation_id: 'obs-1',
          sighting_id: null,
          incident_id: null,
        },
      })
      adminStorage.remove.mockRejectedValueOnce(new Error('Storage failed'))

      const result = await adminDeleteMedia('media-1')

      // Should still succeed — storage cleanup is best-effort
      expect(result).toEqual({ success: true })
    })
  })
})
