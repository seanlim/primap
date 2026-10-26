import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import LoginPage from '@/app/(auth)/login/page'

const { signUp, signInWithPassword } = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signUp, signInWithPassword } }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  signUp.mockResolvedValue({ error: null })
})

function openSignUp() {
  render(<LoginPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }))
  fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'volunteer@example.com' } })
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'test-password' } })
}

it('requires a masked confirmation only in email sign-up mode', () => {
  render(<LoginPage />)
  expect(screen.queryByPlaceholderText('Confirm password')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }))
  expect(screen.getByPlaceholderText('Confirm password')).toHaveAttribute('type', 'password')
  expect(screen.getByPlaceholderText('Confirm password')).toBeRequired()
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
  expect(screen.queryByPlaceholderText('Confirm password')).not.toBeInTheDocument()
})

it.each(['different-password', 'test-password '])('blocks sign-up when confirmation differs: %s', (confirmation) => {
  openSignUp()
  fireEvent.change(screen.getByPlaceholderText('Confirm password'), { target: { value: confirmation } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }))
  expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
  expect(signUp).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Sign Up' })).toBeEnabled()
})

it('submits matching passwords and preserves the email confirmation message', async () => {
  openSignUp()
  fireEvent.change(screen.getByPlaceholderText('Confirm password'), { target: { value: 'test-password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }))
  await waitFor(() => expect(screen.getByText('Check your email for the confirmation link!')).toBeInTheDocument())
  expect(signUp).toHaveBeenCalledExactlyOnceWith({
    email: 'volunteer@example.com',
    password: 'test-password',
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  })
})
