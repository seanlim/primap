import { createHash } from 'crypto'
import { revalidatePath } from 'next/cache'

const {
  mockSupabase,
  serverMethods,
  mockAdminClient,
  adminMethods,
  mockSendSms,
} = vi.hoisted(() => {
  const serverMethods = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  }
  serverMethods.select.mockReturnValue(serverMethods)
  serverMethods.update.mockReturnValue(serverMethods)
  serverMethods.eq.mockReturnValue(serverMethods)

  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
      verifyOtp: vi.fn(),
    },
    from: vi.fn(() => serverMethods),
  }

  const adminMethods = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  }
  adminMethods.select.mockReturnValue(adminMethods)
  adminMethods.update.mockReturnValue(adminMethods)
  adminMethods.eq.mockReturnValue(adminMethods)
  adminMethods.is.mockReturnValue(adminMethods)
  adminMethods.order.mockReturnValue(adminMethods)
  adminMethods.limit.mockReturnValue(adminMethods)

  const mockAdminClient = {
    from: vi.fn(() => adminMethods),
  }

  return {
    mockSupabase,
    serverMethods,
    mockAdminClient,
    adminMethods,
    mockSendSms: vi.fn(),
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}))

vi.mock('@/lib/sms/twilio', () => ({
  sendSms: (...args: unknown[]) => mockSendSms(...args),
}))

import {
  saveContactDetails,
  sendAccountPhoneOtp,
  sendGuardianPhoneOtp,
  verifyAccountPhoneOtp,
  verifyGuardianPhoneOtp,
} from '@/lib/actions/contact-profile-actions'

function resetMocks() {
  vi.clearAllMocks()
  serverMethods.select.mockReturnValue(serverMethods)
  serverMethods.update.mockReturnValue(serverMethods)
  serverMethods.eq.mockReturnValue(serverMethods)
  serverMethods.single.mockResolvedValue({ data: null, error: null })
  adminMethods.select.mockReturnValue(adminMethods)
  adminMethods.update.mockReturnValue(adminMethods)
  adminMethods.eq.mockReturnValue(adminMethods)
  adminMethods.is.mockReturnValue(adminMethods)
  adminMethods.order.mockReturnValue(adminMethods)
  adminMethods.limit.mockReturnValue(adminMethods)
  adminMethods.insert.mockResolvedValue({ error: null })
  adminMethods.maybeSingle.mockResolvedValue({ data: null, error: null })
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  mockSupabase.auth.updateUser.mockResolvedValue({ data: {}, error: null })
  mockSupabase.auth.verifyOtp.mockResolvedValue({ data: {}, error: null })
  mockSendSms.mockResolvedValue({ success: true })
  process.env.GUARDIAN_OTP_SECRET = 'test-secret'
  process.env.GUARDIAN_OTP_TEST_CODE = '123456'
}

function guardianHash(phoneNumber: string, code: string) {
  return createHash('sha256')
    .update(`test-secret:user-1:${phoneNumber}:${code}`)
    .digest('hex')
}

describe('contact-profile-actions', () => {
  beforeEach(() => {
    resetMocks()
  })

  afterEach(() => {
    delete process.env.GUARDIAN_OTP_SECRET
    delete process.env.GUARDIAN_OTP_TEST_CODE
  })

  it('saves adult contact details and preserves verification for unchanged phone', async () => {
    serverMethods.single.mockResolvedValueOnce({
      data: {
        phone_number: '+6591234567',
        phone_verified_at: '2026-01-01T00:00:00.000Z',
        guardian_phone_number: null,
        guardian_phone_verified_at: null,
      },
      error: null,
    })

    const result = await saveContactDetails({
      fullName: ' Alice ',
      phoneNumber: '9123 4567',
      dateOfBirth: '1990-01-01',
    })

    expect(result).toEqual({ success: true, phoneNumber: '+6591234567' })
    expect(serverMethods.update).toHaveBeenCalledWith(expect.objectContaining({
      full_name: 'Alice',
      phone_number: '+6591234567',
      phone_verified_at: '2026-01-01T00:00:00.000Z',
      date_of_birth: '1990-01-01',
      guardian_phone_number: null,
      guardian_phone_verified_at: null,
    }))
    expect(revalidatePath).toHaveBeenCalledWith('/complete-profile')
  })

  it('sends account phone OTP through Supabase Auth', async () => {
    const result = await sendAccountPhoneOtp('9123 4567')

    expect(result).toEqual({ success: true, phoneNumber: '+6591234567' })
    expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({ phone: '+6591234567' })
    expect(serverMethods.update).toHaveBeenCalledWith(expect.objectContaining({
      phone_number: '+6591234567',
      phone_verified_at: null,
    }))
  })

  it('verifies account phone OTP through Supabase Auth phone_change', async () => {
    const result = await verifyAccountPhoneOtp('9123 4567', '123456')

    expect(result).toEqual({ success: true, phoneNumber: '+6591234567' })
    expect(mockSupabase.auth.verifyOtp).toHaveBeenCalledWith({
      phone: '+6591234567',
      token: '123456',
      type: 'phone_change',
    })
    expect(serverMethods.update).toHaveBeenCalledWith(expect.objectContaining({
      phone_number: '+6591234567',
      phone_verified_at: expect.any(String),
    }))
  })

  it('sends guardian OTP through Twilio and stores a hashed code', async () => {
    serverMethods.single.mockResolvedValueOnce({
      data: { date_of_birth: '2010-01-01' },
      error: null,
    })

    const result = await sendGuardianPhoneOtp('8123 4567')

    expect(result).toEqual({ success: true, phoneNumber: '+6581234567' })
    expect(mockSendSms).toHaveBeenCalledWith(expect.objectContaining({
      to: '+6581234567',
      body: expect.stringContaining('123456'),
    }))
    expect(adminMethods.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      phone_number: '+6581234567',
      code_hash: expect.any(String),
      attempts: 0,
    }))
    expect(serverMethods.update).toHaveBeenCalledWith(expect.objectContaining({
      guardian_phone_number: '+6581234567',
      guardian_phone_verified_at: null,
    }))
  })

  it('verifies guardian OTP and marks guardian phone verified', async () => {
    adminMethods.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'otp-1',
        code_hash: guardianHash('+6581234567', '123456'),
        attempts: 0,
        expires_at: '2099-01-01T00:00:00.000Z',
      },
      error: null,
    })

    const result = await verifyGuardianPhoneOtp('8123 4567', '123456')

    expect(result).toEqual({ success: true, phoneNumber: '+6581234567' })
    expect(adminMethods.update).toHaveBeenCalledWith(expect.objectContaining({
      verified_at: expect.any(String),
      updated_at: expect.any(String),
    }))
    expect(serverMethods.update).toHaveBeenCalledWith(expect.objectContaining({
      guardian_phone_number: '+6581234567',
      guardian_phone_verified_at: expect.any(String),
    }))
  })
})
