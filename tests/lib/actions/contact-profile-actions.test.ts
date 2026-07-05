import { revalidatePath } from 'next/cache'

const {
  mockSupabase,
  serverMethods,
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
      resend: vi.fn(),
      verifyOtp: vi.fn(),
    },
    from: vi.fn(() => serverMethods),
  }

  return {
    mockSupabase,
    serverMethods,
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

import {
  saveContactDetails,
  sendAccountPhoneOtp,
  verifyAccountPhoneOtp,
} from '@/lib/actions/contact-profile-actions'

function resetMocks() {
  vi.clearAllMocks()
  serverMethods.select.mockReturnValue(serverMethods)
  serverMethods.update.mockReturnValue(serverMethods)
  serverMethods.eq.mockReturnValue(serverMethods)
  serverMethods.single.mockResolvedValue({ data: null, error: null })
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  mockSupabase.auth.updateUser.mockResolvedValue({
    data: { user: { new_phone: '+6591234567' } },
    error: null,
  })
  mockSupabase.auth.resend.mockResolvedValue({ data: {}, error: null })
  mockSupabase.auth.verifyOtp.mockResolvedValue({ data: {}, error: null })
}

describe('contact-profile-actions', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('saves contact details and preserves verification for unchanged phone', async () => {
    serverMethods.single.mockResolvedValueOnce({
      data: {
        phone_number: '+6591234567',
        phone_verified_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    })

    const result = await saveContactDetails({
      fullName: ' Alice ',
      phoneNumber: '9123 4567',
      birthMonth: '1990-01',
    })

    expect(result).toEqual({ success: true, phoneNumber: '+6591234567' })
    expect(serverMethods.update).toHaveBeenCalledWith(expect.objectContaining({
      full_name: 'Alice',
      phone_number: '+6591234567',
      phone_verified_at: '2026-01-01T00:00:00.000Z',
      birth_month: '1990-01-01',
    }))
    expect(revalidatePath).toHaveBeenCalledWith('/complete-profile')
  })

  it('clears verification when the saved phone changes', async () => {
    serverMethods.single.mockResolvedValueOnce({
      data: {
        phone_number: '+6599999999',
        phone_verified_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    })

    const result = await saveContactDetails({
      phoneNumber: '9123 4567',
      birthMonth: '1990-01',
    })

    expect(result).toEqual({ success: true, phoneNumber: '+6591234567' })
    expect(serverMethods.update).toHaveBeenCalledWith(expect.objectContaining({
      phone_number: '+6591234567',
      phone_verified_at: null,
      birth_month: '1990-01-01',
    }))
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

  it('syncs account phone verification when Supabase Auth already confirms the same phone', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-1',
          phone: '6591234567',
          phone_confirmed_at: '2026-07-05T10:00:00.000Z',
        },
      },
    })

    const result = await sendAccountPhoneOtp('9123 4567')

    expect(result).toEqual({
      success: true,
      phoneNumber: '+6591234567',
      alreadyVerified: true,
    })
    expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled()
    expect(mockSupabase.auth.resend).not.toHaveBeenCalled()
    expect(serverMethods.update).toHaveBeenCalledWith(expect.objectContaining({
      phone_number: '+6591234567',
      phone_verified_at: '2026-07-05T10:00:00.000Z',
    }))
  })

  it('resends account phone OTP when the same phone change is already pending', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-1',
          new_phone: '+6591234567',
        },
      },
    })

    const result = await sendAccountPhoneOtp('9123 4567')

    expect(result).toEqual({ success: true, phoneNumber: '+6591234567' })
    expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled()
    expect(mockSupabase.auth.resend).toHaveBeenCalledWith({
      type: 'phone_change',
      phone: '+6591234567',
    })
    expect(serverMethods.update).toHaveBeenCalledWith(expect.objectContaining({
      phone_number: '+6591234567',
      phone_verified_at: null,
    }))
  })

  it('does not report account phone OTP success when Supabase does not create a phone change', async () => {
    mockSupabase.auth.updateUser.mockResolvedValueOnce({
      data: { user: { new_phone: '', phone_change: '' } },
      error: null,
    })

    const result = await sendAccountPhoneOtp('9123 4567')

    expect(result).toEqual({
      error: 'Phone verification SMS was not created. Check Supabase Auth phone confirmations and SMS provider settings.',
    })
    expect(serverMethods.update).not.toHaveBeenCalled()
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
})
