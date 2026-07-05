import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { mockSignUp, mockSignInWithPassword, mockSignInWithOAuth } = vi.hoisted(() => ({
  mockSignUp: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockSignInWithOAuth: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
      signInWithOAuth: mockSignInWithOAuth,
    },
  }),
}))

import LoginPage from '@/app/(auth)/login/page'

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null })
  })

  it('signs up with phone and birth month metadata only', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByRole('button', { name: 'Sign Up' }))
    await user.type(screen.getByPlaceholderText('Display name'), 'New Volunteer')
    await user.type(screen.getByPlaceholderText('Email'), 'new@example.com')
    await user.type(screen.getByPlaceholderText('Phone number'), '91234567')
    fireEvent.change(screen.getByLabelText('Birth month'), { target: { value: '1990-01' } })
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign Up' }))

    await waitFor(() => expect(mockSignUp).toHaveBeenCalled())
    expect(mockSignUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'new@example.com',
      password: 'password123',
      options: expect.objectContaining({
        data: {
          full_name: 'New Volunteer',
          phone_number: '+6591234567',
          birth_month: '1990-01-01',
        },
      }),
    }))
    expect(mockSignUp.mock.calls[0][0].options.data).not.toHaveProperty('date_of_birth')
    expect(mockSignUp.mock.calls[0][0].options.data).not.toHaveProperty('guardian_phone_number')
  })
})
