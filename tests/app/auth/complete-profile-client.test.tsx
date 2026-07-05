import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const {
  mockSaveContactDetails,
  mockSendAccountPhoneOtp,
  mockVerifyAccountPhoneOtp,
} = vi.hoisted(() => ({
  mockSaveContactDetails: vi.fn(),
  mockSendAccountPhoneOtp: vi.fn(),
  mockVerifyAccountPhoneOtp: vi.fn(),
}))

vi.mock('@/lib/actions/contact-profile-actions', () => ({
  saveContactDetails: (...args: unknown[]) => mockSaveContactDetails(...args),
  sendAccountPhoneOtp: (...args: unknown[]) => mockSendAccountPhoneOtp(...args),
  verifyAccountPhoneOtp: (...args: unknown[]) => mockVerifyAccountPhoneOtp(...args),
}))

import { CompleteProfileClient } from '@/app/(auth)/complete-profile/complete-profile-client'

const profile = {
  id: 'user-1',
  email: 'volunteer@example.com',
  fullName: null,
  role: 'VOLUNTEER',
  status: 'ACTIVE',
  phoneNumber: null,
  phoneVerifiedAt: null,
  birthMonth: null,
}

describe('CompleteProfileClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSaveContactDetails.mockResolvedValue({ success: true, phoneNumber: '+6591234567' })
    mockSendAccountPhoneOtp.mockResolvedValue({ success: true, phoneNumber: '+6591234567' })
    mockVerifyAccountPhoneOtp.mockResolvedValue({ success: true, phoneNumber: '+6591234567' })
  })

  it('saves birth month and sends account phone OTP from the split code row', async () => {
    const user = userEvent.setup()
    render(<CompleteProfileClient profile={profile} nextPath="/home" />)

    await user.type(screen.getByLabelText('Display name'), 'Volunteer One')
    fireEvent.change(screen.getByLabelText('Birth month'), { target: { value: '1990-01' } })
    await user.type(screen.getByLabelText('Phone number'), '91234567')

    expect(screen.getByLabelText('Phone number')).toHaveValue('9123 4567')

    await user.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(mockSaveContactDetails).toHaveBeenCalled())
    expect(mockSaveContactDetails).toHaveBeenCalledWith({
      fullName: 'Volunteer One',
      phoneNumber: '9123 4567',
      birthMonth: '1990-01',
    })
    expect(mockSendAccountPhoneOtp).toHaveBeenCalledWith('9123 4567')
    expect(screen.getByPlaceholderText('6-digit code')).toBeInTheDocument()
  })

  it('enables continue when the account phone is already verified in Supabase Auth', async () => {
    mockSendAccountPhoneOtp.mockResolvedValueOnce({
      success: true,
      phoneNumber: '+6591234567',
      alreadyVerified: true,
    })
    const user = userEvent.setup()
    render(<CompleteProfileClient profile={profile} nextPath="/home" />)

    fireEvent.change(screen.getByLabelText('Birth month'), { target: { value: '1990-01' } })
    await user.type(screen.getByLabelText('Phone number'), '91234567')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(screen.getByText('Account phone already verified.')).toBeInTheDocument())
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('verifies the account phone code and enables continue', async () => {
    const user = userEvent.setup()
    render(<CompleteProfileClient profile={profile} nextPath="/home" />)

    fireEvent.change(screen.getByLabelText('Birth month'), { target: { value: '1990-01' } })
    await user.type(screen.getByLabelText('Phone number'), '91234567')
    await user.type(screen.getByPlaceholderText('6-digit code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verify' }))

    await waitFor(() => expect(mockVerifyAccountPhoneOtp).toHaveBeenCalledWith('9123 4567', '123456'))
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })
})
