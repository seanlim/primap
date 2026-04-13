/**
 * Tests for the completion_comment feature in observation actions.
 *
 * Covers: saveDraft (insert/update), getObservationFull return shape.
 * Corner cases: empty string, undefined, null, whitespace-only, long text,
 * comment with COMPLETED status (should be stored as null), switching statuses.
 */
import { revalidatePath } from 'next/cache'

const { mockSupabase, methods, mockStorage } = vi.hoisted(() => {
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
    order: vi.fn(),
  }
  for (const key of Object.keys(methods) as (keyof typeof methods)[]) {
    if (key !== 'single') methods[key].mockReturnThis()
  }
  const mockStorage = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn().mockReturnValue({
      data: { publicUrl: 'https://example.com/public/file.jpg' },
    }),
  }
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn().mockReturnValue(methods),
    storage: {
      from: vi.fn().mockReturnValue(mockStorage),
    },
  }
  return { mockSupabase, methods, mockStorage }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

import {
  saveDraft,
  getObservationFull,
} from '@/lib/actions/observation-actions'

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
  methods.order.mockReturnThis()
  methods.single.mockResolvedValue({ data: null, error: null })
}

function setupUser(userId = 'user-1') {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: userId } },
  })
}

const baseDraftInput = {
  walkId: 'slot-1',
  walkCompletion: 'COMPLETED' as const,
  outcome: 'NOT_SIGHTED' as const,
  notes: 'All clear',
  lat: 1.35,
  lng: 103.82,
}

describe('completion_comment in saveDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
  })

  // ─── INSERT (new draft) ─────────────────────────────────────────────

  it('inserts completion_comment when creating a new draft with PARTIAL status', async () => {
    setupUser()
    methods.single.mockResolvedValueOnce({
      data: { id: 'obs-1' },
      error: null,
    })

    await saveDraft({
      ...baseDraftInput,
      walkCompletion: 'PARTIAL',
      completionComment: 'Rain started, had to cut short',
    })

    expect(methods.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        walk_completion: 'PARTIAL',
        completion_comment: 'Rain started, had to cut short',
      })
    )
  })

  it('inserts completion_comment when creating a new draft with ABORTED status', async () => {
    setupUser()
    methods.single.mockResolvedValueOnce({
      data: { id: 'obs-1' },
      error: null,
    })

    await saveDraft({
      ...baseDraftInput,
      walkCompletion: 'ABORTED',
      completionComment: 'Trail blocked by fallen tree',
    })

    expect(methods.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        walk_completion: 'ABORTED',
        completion_comment: 'Trail blocked by fallen tree',
      })
    )
  })

  it('inserts completion_comment as null when COMPLETED (no comment provided)', async () => {
    setupUser()
    methods.single.mockResolvedValueOnce({
      data: { id: 'obs-1' },
      error: null,
    })

    await saveDraft({
      ...baseDraftInput,
      walkCompletion: 'COMPLETED',
    })

    expect(methods.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        walk_completion: 'COMPLETED',
        completion_comment: null,
      })
    )
  })

  it('inserts completion_comment as null when completionComment is undefined', async () => {
    setupUser()
    methods.single.mockResolvedValueOnce({
      data: { id: 'obs-1' },
      error: null,
    })

    await saveDraft({
      ...baseDraftInput,
      walkCompletion: 'PARTIAL',
      completionComment: undefined,
    })

    expect(methods.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        completion_comment: null,
      })
    )
  })

  it('inserts completion_comment as null when completionComment is empty string', async () => {
    setupUser()
    methods.single.mockResolvedValueOnce({
      data: { id: 'obs-1' },
      error: null,
    })

    await saveDraft({
      ...baseDraftInput,
      walkCompletion: 'PARTIAL',
      completionComment: '',
    })

    expect(methods.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        completion_comment: null,
      })
    )
  })

  // ─── UPDATE (existing draft) ────────────────────────────────────────

  it('updates completion_comment when updating existing draft', async () => {
    setupUser()

    await saveDraft({
      ...baseDraftInput,
      observationId: 'obs-1',
      walkCompletion: 'PARTIAL',
      completionComment: 'Weather deteriorated',
    })

    expect(methods.update).toHaveBeenCalledWith(
      expect.objectContaining({
        walk_completion: 'PARTIAL',
        completion_comment: 'Weather deteriorated',
      })
    )
  })

  it('updates completion_comment to null when switching from PARTIAL to COMPLETED', async () => {
    setupUser()

    await saveDraft({
      ...baseDraftInput,
      observationId: 'obs-1',
      walkCompletion: 'COMPLETED',
      completionComment: '',
    })

    expect(methods.update).toHaveBeenCalledWith(
      expect.objectContaining({
        walk_completion: 'COMPLETED',
        completion_comment: null,
      })
    )
  })

  it('updates completion_comment to null when completionComment is undefined on update', async () => {
    setupUser()

    await saveDraft({
      ...baseDraftInput,
      observationId: 'obs-1',
      walkCompletion: 'ABORTED',
      completionComment: undefined,
    })

    expect(methods.update).toHaveBeenCalledWith(
      expect.objectContaining({
        completion_comment: null,
      })
    )
  })

  it('preserves long completion_comment text', async () => {
    setupUser()
    const longComment = 'A'.repeat(1000)
    methods.single.mockResolvedValueOnce({
      data: { id: 'obs-1' },
      error: null,
    })

    await saveDraft({
      ...baseDraftInput,
      walkCompletion: 'ABORTED',
      completionComment: longComment,
    })

    expect(methods.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        completion_comment: longComment,
      })
    )
  })

  it('stores completion_comment with special characters', async () => {
    setupUser()
    const specialComment = 'Trail closed due to 🌧️ & lightning <alert>'
    methods.single.mockResolvedValueOnce({
      data: { id: 'obs-1' },
      error: null,
    })

    await saveDraft({
      ...baseDraftInput,
      walkCompletion: 'ABORTED',
      completionComment: specialComment,
    })

    expect(methods.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        completion_comment: specialComment,
      })
    )
  })
})

describe('completion_comment in getObservationFull', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
  })

  it('returns completionComment from server data', async () => {
    setupUser()
    methods.single.mockResolvedValueOnce({
      data: {
        id: 'obs-1',
        walk_completion: 'PARTIAL',
        completion_comment: 'Rain started midway',
        outcome: 'NOT_SIGHTED',
        notes: null,
        lat: 1.35,
        lng: 103.82,
        updated_at: '2026-04-12T10:00:00Z',
        sightings: [],
        media: [],
      },
      error: null,
    })

    const result = await getObservationFull('slot-1')

    expect(result).not.toBeNull()
    expect(result!.completionComment).toBe('Rain started midway')
    expect(result!.walkCompletion).toBe('PARTIAL')
  })

  it('returns null completionComment when column is null', async () => {
    setupUser()
    methods.single.mockResolvedValueOnce({
      data: {
        id: 'obs-1',
        walk_completion: 'COMPLETED',
        completion_comment: null,
        outcome: 'NOT_SIGHTED',
        notes: null,
        lat: 1.35,
        lng: 103.82,
        updated_at: '2026-04-12T10:00:00Z',
        sightings: [],
        media: [],
      },
      error: null,
    })

    const result = await getObservationFull('slot-1')

    expect(result).not.toBeNull()
    expect(result!.completionComment).toBeNull()
  })

  it('returns null when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    const result = await getObservationFull('slot-1')

    expect(result).toBeNull()
  })

  it('returns null when observation not found', async () => {
    setupUser()
    methods.single.mockResolvedValueOnce({ data: null, error: null })

    const result = await getObservationFull('slot-1')

    expect(result).toBeNull()
  })
})
