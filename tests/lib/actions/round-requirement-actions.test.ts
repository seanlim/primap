const {
  mockSupabase,
  mockAdmin,
  profileQuery,
  roundQuery,
  requirementQuery,
  otpQuery,
  mockSendGuardianEmailVerificationEmail,
} = vi.hoisted(() => {
  const makeQuery = () => {
    const query = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
    }
    query.select.mockReturnValue(query)
    query.update.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.is.mockReturnValue(query)
    query.order.mockReturnValue(query)
    query.limit.mockReturnValue(query)
    query.insert.mockResolvedValue({ error: null })
    query.upsert.mockResolvedValue({ error: null })
    query.single.mockResolvedValue({ data: null, error: null })
    query.maybeSingle.mockResolvedValue({ data: null, error: null })
    return query
  }

  const profileQuery = makeQuery()
  const roundQuery = makeQuery()
  const requirementQuery = makeQuery()
  const otpQuery = makeQuery()

  const mockAdmin = {
    from: vi.fn((table: string) => {
      if (table === 'profiles') return profileQuery
      if (table === 'survey_rounds') return roundQuery
      if (table === 'round_participation_requirements') return requirementQuery
      if (table === 'guardian_contact_otps') return otpQuery
      return makeQuery()
    }),
  }

  return {
    mockSupabase: {
      auth: {
        getUser: vi.fn(),
      },
    },
    mockAdmin,
    profileQuery,
    roundQuery,
    requirementQuery,
    otpQuery,
    mockSendGuardianEmailVerificationEmail: vi.fn(),
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdmin),
}))

vi.mock('@/lib/email', () => ({
  sendGuardianEmailVerificationEmail: (...args: unknown[]) => mockSendGuardianEmailVerificationEmail(...args),
}))

import {
  saveRoundRequirements,
  sendGuardianEmailOtp,
} from '@/lib/actions/round-requirement-actions'

function resetQuery(query: typeof profileQuery) {
  query.select.mockClear()
  query.insert.mockClear()
  query.update.mockClear()
  query.upsert.mockClear()
  query.eq.mockClear()
  query.is.mockClear()
  query.order.mockClear()
  query.limit.mockClear()
  query.single.mockReset().mockResolvedValue({ data: null, error: null })
  query.maybeSingle.mockReset().mockResolvedValue({ data: null, error: null })
  query.insert.mockResolvedValue({ error: null })
  query.upsert.mockResolvedValue({ error: null })
}

function setupRoundContext(birthMonth: string, requirement: Record<string, unknown> | null = null) {
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  profileQuery.single.mockResolvedValue({
    data: { id: 'user-1', full_name: 'Minor Volunteer', birth_month: birthMonth },
    error: null,
  })
  roundQuery.single.mockResolvedValue({
    data: {
      id: 'round-1',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      indemnity_form_url: 'https://example.com/form',
    },
    error: null,
  })
  requirementQuery.maybeSingle.mockResolvedValue({ data: requirement, error: null })
}

describe('round-requirement-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetQuery(profileQuery)
    resetQuery(roundQuery)
    resetQuery(requirementQuery)
    resetQuery(otpQuery)
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSendGuardianEmailVerificationEmail.mockResolvedValue(undefined)
    process.env.GUARDIAN_OTP_SECRET = 'test-secret'
    process.env.GUARDIAN_OTP_TEST_CODE = '123456'
  })

  afterEach(() => {
    delete process.env.GUARDIAN_OTP_SECRET
    delete process.env.GUARDIAN_OTP_TEST_CODE
  })

  it('saves adult indemnity acknowledgement without guardian fields', async () => {
    setupRoundContext('1990-01-01')

    const result = await saveRoundRequirements('round-1', {
      indemnityAcknowledged: true,
    })

    expect(result).toEqual({
      success: true,
      indemnityAcknowledgedAt: expect.any(String),
    })
    expect(requirementQuery.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      round_id: 'round-1',
      indemnity_acknowledged_at: expect.any(String),
      guardian_name: null,
      guardian_email: null,
      guardian_phone_number: null,
    }), { onConflict: 'user_id,round_id' })
  })

  it('requires guardian details for under-18 round participation', async () => {
    setupRoundContext('2010-01-01')

    const result = await saveRoundRequirements('round-1', {
      indemnityAcknowledged: true,
    })

    expect(result).toEqual({ error: 'Guardian name is required.' })
    expect(requirementQuery.upsert).not.toHaveBeenCalled()
  })

  it('sends guardian email OTP and stores only the hashed code', async () => {
    setupRoundContext('2010-01-01', {
      guardian_name: 'Parent One',
      guardian_email: null,
      guardian_email_verified_at: null,
      guardian_phone_number: null,
      guardian_phone_verified_at: null,
      indemnity_acknowledged_at: null,
    })
    otpQuery.maybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await sendGuardianEmailOtp('round-1', 'Parent@Example.com')

    expect(result).toEqual({ success: true, guardianEmail: 'parent@example.com' })
    expect(mockSendGuardianEmailVerificationEmail).toHaveBeenCalledWith(
      'parent@example.com',
      'Parent One',
      'Minor Volunteer',
      '123456'
    )
    expect(otpQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      round_id: 'round-1',
      channel: 'EMAIL',
      destination: 'parent@example.com',
      code_hash: expect.any(String),
      attempts: 0,
    }))
    expect(otpQuery.insert.mock.calls[0][0]).not.toHaveProperty('code')
    expect(requirementQuery.upsert).toHaveBeenCalledWith(expect.objectContaining({
      guardian_email: 'parent@example.com',
      guardian_email_verified_at: null,
    }), { onConflict: 'user_id,round_id' })
  })
})
