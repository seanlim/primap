import { revalidatePath } from 'next/cache'

const { state, serverClient, adminClient } = vi.hoisted(() => {
  const state = {
    user: { id: 'volunteer-1' } as { id: string } | null,
    actor: { role: 'VOLUNTEER' as string },
    profile: { role: 'VOLUNTEER' as string, birth_month: '2010-05-01' as string | null },
    targetProfile: { role: 'VOLUNTEER' as string, birth_month: '2010-05-01' as string | null },
    round: { id: 'round-1', start_date: '2026-04-01', status: 'OPEN', minor_workshop_required: true },
    requirement: null as null | {
      guardian_name: string
      guardian_email: string
      guardian_phone_number?: string | null
      guardian_email_verified_at?: string | null
      guardian_phone_verified_at?: string | null
      guardian_workshop_attended_at?: string | null
      guardian_accompaniment_acknowledged_at?: string | null
    },
    upserted: null as unknown,
    updated: null as unknown,
    updateError: null as { message: string } | null,
  }

  function query(table: string, source: 'server' | 'admin') {
    let selected = ''
    let isUpdate = false
    let updateEqCount = 0
    const builder = {
      select: (columns?: unknown) => {
        selected = String(columns ?? '')
        return builder
      },
      eq: () => {
        if (isUpdate && ++updateEqCount >= 2) return Promise.resolve({ error: state.updateError })
        return builder
      },
      maybeSingle: async () => ({
        data: table === 'survey_rounds' ? state.round
          : table === 'profiles' ? (source === 'server' ? state.profile : state.targetProfile)
            : state.requirement,
        error: null,
      }),
      single: async () => ({
        data: source === 'server'
          ? table === 'profiles' && selected.includes('birth_month') ? state.profile : state.actor
          : state.targetProfile,
        error: null,
      }),
      upsert: async (value: unknown) => {
        state.upserted = value
        return { error: null }
      },
      update: (value: unknown) => {
        state.updated = value
        isUpdate = true
        return builder
      },
    }
    return builder
  }

  const serverClient = {
    auth: { getUser: vi.fn(async () => ({ data: { user: state.user } })) },
    from: vi.fn((table: string) => query(table, 'server')),
  }
  const adminClient = { from: vi.fn((table: string) => query(table, 'admin')) }
  return { state, serverClient, adminClient }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => serverClient) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => adminClient) }))

import { markGuardianWorkshopAttendance, saveRoundGuardianDetails } from '@/lib/actions/guardian-actions'

beforeEach(() => {
  vi.clearAllMocks()
  state.user = { id: 'volunteer-1' }
  state.actor = { role: 'VOLUNTEER' }
  state.profile = { role: 'VOLUNTEER', birth_month: '2010-05-01' }
  state.targetProfile = { role: 'VOLUNTEER', birth_month: '2010-05-01' }
  state.round = { id: 'round-1', start_date: '2026-04-01', status: 'OPEN', minor_workshop_required: true }
  state.requirement = null
  state.upserted = null
  state.updated = null
  state.updateError = null
})

describe('saveRoundGuardianDetails', () => {
  it('requires authentication', async () => {
    state.user = null
    expect(await saveRoundGuardianDetails('round-1', {
      guardianName: 'Pat', guardianEmail: 'pat@example.com', guardianPhone: '', confirmsAccompaniment: true,
    })).toEqual({ error: 'Not authenticated' })
  })

  it('normalizes and saves guardian details for a minor and records their acknowledgement', async () => {
    const result = await saveRoundGuardianDetails('round-1', {
      guardianName: ' Pat Guardian ',
      guardianEmail: 'PAT@Example.com ',
      guardianPhone: '9123 4567',
      confirmsAccompaniment: true,
    })

    expect(result).toEqual({ success: true })
    expect(state.upserted).toMatchObject({
      user_id: 'volunteer-1',
      round_id: 'round-1',
      guardian_name: 'Pat Guardian',
      guardian_email: 'pat@example.com',
      guardian_phone_number: '+6591234567',
      guardian_accompaniment_acknowledged_at: expect.any(String),
      guardian_workshop_attended_at: null,
    })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/rounds/round-1/participants')
  })

  it('rejects invalid email and missing accompaniment confirmation', async () => {
    expect(await saveRoundGuardianDetails('round-1', {
      guardianName: 'Pat', guardianEmail: 'not-an-email', guardianPhone: '', confirmsAccompaniment: true,
    })).toEqual({ error: 'Enter a valid guardian email address.' })
    expect(await saveRoundGuardianDetails('round-1', {
      guardianName: 'Pat', guardianEmail: 'pat@example.com', guardianPhone: '', confirmsAccompaniment: false,
    })).toEqual({ error: 'Confirm that this guardian will accompany you on walks in this round.' })
    expect(state.upserted).toBeNull()
  })

  it('does not accept guardian details for an adult volunteer', async () => {
    state.profile.birth_month = '2000-05-01'
    expect(await saveRoundGuardianDetails('round-1', {
      guardianName: 'Pat', guardianEmail: 'pat@example.com', guardianPhone: '', confirmsAccompaniment: true,
    })).toEqual({ error: 'Guardian details are not required for this survey round.' })
    expect(state.upserted).toBeNull()
  })
})

describe('markGuardianWorkshopAttendance', () => {
  it('allows only admins to record attendance', async () => {
    state.actor = { role: 'VOLUNTEER' }
    expect(await markGuardianWorkshopAttendance('round-1', 'volunteer-1', true))
      .toEqual({ error: 'Not authorized' })
  })

  it('records attendance after checking the round, minor, and guardian record', async () => {
    state.user = { id: 'admin-1' }
    state.actor = { role: 'ADMIN' }
    state.targetProfile = { role: 'VOLUNTEER', birth_month: '2010-05-01' }
    state.requirement = {
      guardian_name: 'Pat Guardian',
      guardian_email: 'pat@example.com',
      guardian_workshop_attended_at: null,
    }

    const result = await markGuardianWorkshopAttendance('round-1', 'volunteer-1', true)

    expect(result).toEqual({ success: true })
    expect(state.updated).toEqual({ guardian_workshop_attended_at: expect.any(String) })
  })
})
