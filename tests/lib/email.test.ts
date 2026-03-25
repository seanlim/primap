import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockSend = vi.fn().mockResolvedValue({})

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockSend }
  },
}))

import {
  sendAccountApprovedEmail,
  sendAccountRejectedEmail,
  sendAccountDisabledEmail,
  sendAccountEnabledEmail,
  sendRolePromotedEmail,
  sendRoleDemotedEmail,
  sendWalkCancellationEmail,
  sendWalkReminderEmail,
} from '@/lib/email'

describe('email utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_API_KEY = 'test-key'
  })

  afterEach(() => {
    delete process.env.RESEND_API_KEY
    delete process.env.RESEND_FROM_EMAIL
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  describe('sendEmail internals', () => {
    it('skips sending when RESEND_API_KEY is not set', async () => {
      delete process.env.RESEND_API_KEY
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await sendAccountApprovedEmail('test@example.com', 'Test User')

      expect(warnSpy).toHaveBeenCalledWith('RESEND_API_KEY is not set. Skipping email.')
      expect(mockSend).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('calls Resend emails.send with correct params', async () => {
      await sendAccountApprovedEmail('test@example.com', 'Test User')

      expect(mockSend).toHaveBeenCalledTimes(1)
      const call = mockSend.mock.calls[0][0]
      expect(call.from).toBe('Primap <no-reply@primap.org>')
      expect(call.to).toBe('test@example.com')
      expect(call.subject).toBe('Primap Account Approved')
      expect(call.html).toContain('Hi Test User')
    })

    it('uses custom FROM_EMAIL when env var is set', async () => {
      process.env.RESEND_FROM_EMAIL = 'Custom <custom@example.com>'

      await sendAccountApprovedEmail('test@example.com', 'Test User')

      const call = mockSend.mock.calls[0][0]
      expect(call.from).toBe('Custom <custom@example.com>')
    })

    it('catches and logs Resend errors without throwing', async () => {
      mockSend.mockRejectedValueOnce(new Error('Resend API failure'))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(
        sendAccountApprovedEmail('test@example.com', 'Test User')
      ).resolves.toBeUndefined()

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send email'),
        expect.any(Error)
      )
      errorSpy.mockRestore()
    })
  })

  describe('sendAccountApprovedEmail', () => {
    it('sends approval email with full name', async () => {
      await sendAccountApprovedEmail('user@example.com', 'Jane Doe')

      const call = mockSend.mock.calls[0][0]
      expect(call.subject).toBe('Primap Account Approved')
      expect(call.html).toContain('Hi Jane Doe')
      expect(call.html).toContain('has been approved')
    })

    it('uses "Volunteer" when fullName is null', async () => {
      await sendAccountApprovedEmail('user@example.com', null)

      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('Hi Volunteer')
    })

    it('includes login link with default APP_URL', async () => {
      await sendAccountApprovedEmail('user@example.com', 'Jane')

      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('https://primap.org/login')
    })

    it('includes login link with custom APP_URL', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://staging.primap.org'

      await sendAccountApprovedEmail('user@example.com', 'Jane')

      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('https://staging.primap.org/login')
    })
  })

  describe('sendAccountRejectedEmail', () => {
    it('sends rejection email with full name', async () => {
      await sendAccountRejectedEmail('user@example.com', 'John Doe')

      const call = mockSend.mock.calls[0][0]
      expect(call.subject).toBe('Primap Account Update')
      expect(call.html).toContain('Hi John Doe')
      expect(call.html).toContain('was not approved')
    })

    it('uses "Volunteer" when fullName is null', async () => {
      await sendAccountRejectedEmail('user@example.com', null)

      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('Hi Volunteer')
    })
  })

  describe('sendAccountDisabledEmail', () => {
    it('sends disabled email with full name', async () => {
      await sendAccountDisabledEmail('user@example.com', 'Alice')

      const call = mockSend.mock.calls[0][0]
      expect(call.subject).toBe('Primap Account Disabled')
      expect(call.html).toContain('Hi Alice')
      expect(call.html).toContain('has been disabled')
    })

    it('uses "Volunteer" when fullName is null', async () => {
      await sendAccountDisabledEmail('user@example.com', null)

      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('Hi Volunteer')
    })
  })

  describe('sendAccountEnabledEmail', () => {
    it('sends re-enabled email with full name', async () => {
      await sendAccountEnabledEmail('user@example.com', 'Bob')

      const call = mockSend.mock.calls[0][0]
      expect(call.subject).toBe('Primap Account Re-enabled')
      expect(call.html).toContain('Hi Bob')
      expect(call.html).toContain('has been re-enabled')
    })

    it('uses "Volunteer" when fullName is null', async () => {
      await sendAccountEnabledEmail('user@example.com', null)

      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('Hi Volunteer')
    })

    it('includes login link', async () => {
      await sendAccountEnabledEmail('user@example.com', 'Bob')

      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('https://primap.org/login')
    })
  })

  describe('sendRolePromotedEmail', () => {
    it('sends promotion email with full name', async () => {
      await sendRolePromotedEmail('user@example.com', 'Jane Doe')

      const call = mockSend.mock.calls[0][0]
      expect(call.subject).toBe('Primap: You Have Been Promoted to Admin')
      expect(call.html).toContain('Hi Jane Doe')
      expect(call.html).toContain('administrator')
    })

    it('uses "User" when fullName is null', async () => {
      await sendRolePromotedEmail('user@example.com', null)

      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('Hi User')
    })

    it('includes admin dashboard link', async () => {
      await sendRolePromotedEmail('user@example.com', 'Jane')

      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('https://primap.org/admin')
    })
  })

  describe('sendRoleDemotedEmail', () => {
    it('sends demotion email with full name', async () => {
      await sendRoleDemotedEmail('user@example.com', 'John Doe')

      const call = mockSend.mock.calls[0][0]
      expect(call.subject).toBe('Primap: Your Role Has Been Updated')
      expect(call.html).toContain('Hi John Doe')
      expect(call.html).toContain('volunteer')
    })

    it('uses "User" when fullName is null', async () => {
      await sendRoleDemotedEmail('user@example.com', null)

      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('Hi User')
    })

    it('includes home link', async () => {
      await sendRoleDemotedEmail('user@example.com', 'John')

      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('https://primap.org/home')
    })
  })

  describe('sendWalkCancellationEmail', () => {
    const slotInfo = { date: '2025-07-01', time: '09:00', location: 'Bukit Timah' }

    it('returns early on empty recipients without sending', async () => {
      await sendWalkCancellationEmail([], slotInfo, 'Jane Doe')

      expect(mockSend).not.toHaveBeenCalled()
    })

    it('sends to each recipient individually', async () => {
      await sendWalkCancellationEmail(
        ['a@example.com', 'b@example.com', 'c@example.com'],
        slotInfo,
        'Jane Doe'
      )

      expect(mockSend).toHaveBeenCalledTimes(3)
      expect(mockSend.mock.calls[0][0].to).toBe('a@example.com')
      expect(mockSend.mock.calls[1][0].to).toBe('b@example.com')
      expect(mockSend.mock.calls[2][0].to).toBe('c@example.com')
    })

    it('includes slot info and cancellation details in email body', async () => {
      await sendWalkCancellationEmail(['a@example.com'], slotInfo, 'Jane Doe')

      const call = mockSend.mock.calls[0][0]
      expect(call.subject).toBe('Walk Cancellation Update')
      expect(call.html).toContain('2025-07-01')
      expect(call.html).toContain('09:00')
      expect(call.html).toContain('Bukit Timah')
      expect(call.html).toContain('Jane Doe')
    })
  })

  describe('sendWalkReminderEmail', () => {
    const slotInfo = { date: '2025-07-02', time: '08:00', location: 'MacRitchie' }

    it('sends reminder with name', async () => {
      await sendWalkReminderEmail('user@example.com', 'Charlie', slotInfo)

      const call = mockSend.mock.calls[0][0]
      expect(call.subject).toBe('Reminder: Upcoming Survey Walk')
      expect(call.html).toContain('Hi Charlie')
      expect(call.html).toContain('2025-07-02')
      expect(call.html).toContain('08:00')
      expect(call.html).toContain('MacRitchie')
    })

    it('uses "Volunteer" when name is null', async () => {
      await sendWalkReminderEmail('user@example.com', null, slotInfo)

      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('Hi Volunteer')
    })

    it('includes walk link', async () => {
      await sendWalkReminderEmail('user@example.com', 'Charlie', slotInfo)

      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('https://primap.org/walk')
    })
  })
})
