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
  sendWalkParticipantUpdateEmail,
  sendIncidentReportedEmail,
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

  // ─── XSS escaping for all account-flow templates ──────────────────────
  //
  // Every template that interpolates user-controlled fields (full_name,
  // location, description, etc.) must escape HTML to prevent attacker-
  // injected scripts/images/anchors from rendering in recipient inboxes.

  describe('XSS escaping (account templates)', () => {
    it('escapes HTML in fullName for sendAccountApprovedEmail', async () => {
      await sendAccountApprovedEmail('user@example.com', '<script>x</script>')
      const call = mockSend.mock.calls[0][0]
      expect(call.html).not.toContain('<script>x</script>')
      expect(call.html).toContain('&lt;script&gt;x&lt;/script&gt;')
    })

    it('escapes HTML in fullName for sendAccountRejectedEmail', async () => {
      await sendAccountRejectedEmail('user@example.com', '<img src=x>')
      const call = mockSend.mock.calls[0][0]
      expect(call.html).not.toContain('<img src=x>')
      expect(call.html).toContain('&lt;img src=x&gt;')
    })

    it('escapes HTML in fullName for sendAccountDisabledEmail', async () => {
      await sendAccountDisabledEmail('user@example.com', '<b>X</b>')
      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('&lt;b&gt;X&lt;/b&gt;')
    })

    it('escapes HTML in fullName for sendAccountEnabledEmail', async () => {
      await sendAccountEnabledEmail('user@example.com', '<b>X</b>')
      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('&lt;b&gt;X&lt;/b&gt;')
    })

    it('escapes HTML in fullName for sendRolePromotedEmail', async () => {
      await sendRolePromotedEmail('user@example.com', '<b>X</b>')
      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('&lt;b&gt;X&lt;/b&gt;')
    })

    it('escapes HTML in fullName for sendRoleDemotedEmail', async () => {
      await sendRoleDemotedEmail('user@example.com', '<b>X</b>')
      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('&lt;b&gt;X&lt;/b&gt;')
    })

    it('escapes HTML in cancelledBy and slot fields for sendWalkCancellationEmail', async () => {
      await sendWalkCancellationEmail(
        ['a@example.com'],
        { date: '2025-01-01', time: '09:00', location: '<b>Bukit</b>' },
        '<script>alert(1)</script>'
      )
      const call = mockSend.mock.calls[0][0]
      expect(call.html).not.toContain('<script>alert(1)</script>')
      expect(call.html).not.toContain('<b>Bukit</b>')
      expect(call.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
      expect(call.html).toContain('&lt;b&gt;Bukit&lt;/b&gt;')
    })

    it('escapes HTML in name and slot fields for sendWalkReminderEmail', async () => {
      await sendWalkReminderEmail(
        'user@example.com',
        '<img src=x>',
        { date: '2025-01-01', time: '09:00', location: '<b>Bukit</b>' },
        []
      )
      const call = mockSend.mock.calls[0][0]
      expect(call.html).not.toContain('<img src=x>')
      expect(call.html).not.toContain('<b>Bukit</b>')
      expect(call.html).toContain('&lt;img src=x&gt;')
      expect(call.html).toContain('&lt;b&gt;Bukit&lt;/b&gt;')
    })
  })

  describe('sendIncidentReportedEmail', () => {
    const baseDetails = {
      typeLabel: 'Injured Animal',
      description: 'Found a wounded macaque near the trail.',
      reporterName: 'Volunteer One',
      walkLocation: 'Bukit Timah',
      walkDate: '2026-04-15',
    }

    it('returns early on empty recipients without sending', async () => {
      await sendIncidentReportedEmail([], baseDetails)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('sends a single email with the expected subject and body', async () => {
      await sendIncidentReportedEmail(['admin@example.com'], baseDetails)

      expect(mockSend).toHaveBeenCalledTimes(1)
      const call = mockSend.mock.calls[0][0]
      expect(call.to).toBe('admin@example.com')
      expect(call.subject).toBe('New Incident Reported - Primap')
      expect(call.html).toContain('Injured Animal')
      expect(call.html).toContain('Found a wounded macaque near the trail.')
      expect(call.html).toContain('Volunteer One')
      expect(call.html).toContain('Bukit Timah')
      expect(call.html).toContain('2026-04-15')
    })

    it('sends individually to each recipient (not BCC)', async () => {
      await sendIncidentReportedEmail(
        ['a@example.com', 'b@example.com', 'c@example.com'],
        baseDetails
      )

      expect(mockSend).toHaveBeenCalledTimes(3)
      expect(mockSend.mock.calls[0][0].to).toBe('a@example.com')
      expect(mockSend.mock.calls[1][0].to).toBe('b@example.com')
      expect(mockSend.mock.calls[2][0].to).toBe('c@example.com')
    })

    it('does NOT throw when one recipient send fails (Promise.allSettled)', async () => {
      mockSend
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Resend down for one recipient'))
        .mockResolvedValueOnce({})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(
        sendIncidentReportedEmail(
          ['a@example.com', 'b@example.com', 'c@example.com'],
          baseDetails
        )
      ).resolves.toBeUndefined()

      expect(mockSend).toHaveBeenCalledTimes(3)
      errorSpy.mockRestore()
    })

    it('never includes an attachment count line', async () => {
      // Notification fires at incident creation time, before media upload —
      // so the email never reports a count, even if media will be attached later.
      await sendIncidentReportedEmail(['admin@example.com'], baseDetails)

      const call = mockSend.mock.calls[0][0]
      expect(call.html).not.toContain('Attachments:')
      expect(call.html).not.toContain('files')
      expect(call.html).not.toContain('attachment')
    })

    it('includes the admin incidents CTA link', async () => {
      await sendIncidentReportedEmail(['admin@example.com'], baseDetails)

      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('https://primap.org/admin/incidents')
    })

    it('uses custom APP_URL when env var is set', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://staging.primap.org'

      await sendIncidentReportedEmail(['admin@example.com'], baseDetails)

      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('https://staging.primap.org/admin/incidents')
    })

    it('does NOT throw when RESEND_API_KEY is unset (silent skip)', async () => {
      delete process.env.RESEND_API_KEY
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await expect(
        sendIncidentReportedEmail(['admin@example.com'], baseDetails)
      ).resolves.toBeUndefined()

      warnSpy.mockRestore()
    })

    // ─── XSS escaping (security regression tests) ─────────────────────────
    //
    // All user-controlled fields are interpolated into HTML email bodies and
    // MUST be escaped. A volunteer with a malicious description or full_name
    // could inject script/img tags into every admin's inbox if escaping is
    // ever removed. These tests guard against that.

    describe('XSS escaping', () => {
      it('escapes <script> tags in description', async () => {
        await sendIncidentReportedEmail(['admin@example.com'], {
          ...baseDetails,
          description: '<script>alert("xss")</script>',
        })

        const call = mockSend.mock.calls[0][0]
        expect(call.html).not.toContain('<script>alert("xss")</script>')
        expect(call.html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
      })

      it('escapes HTML tags in reporterName', async () => {
        await sendIncidentReportedEmail(['admin@example.com'], {
          ...baseDetails,
          reporterName: '<img src=x onerror=alert(1)>',
        })

        const call = mockSend.mock.calls[0][0]
        expect(call.html).not.toContain('<img src=x onerror=alert(1)>')
        expect(call.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
      })

      it('escapes HTML tags in walkLocation', async () => {
        await sendIncidentReportedEmail(['admin@example.com'], {
          ...baseDetails,
          walkLocation: 'Bukit <b>Timah</b>',
        })

        const call = mockSend.mock.calls[0][0]
        expect(call.html).not.toContain('Bukit <b>Timah</b>')
        expect(call.html).toContain('Bukit &lt;b&gt;Timah&lt;/b&gt;')
      })

      it('escapes ampersands and quotes in typeLabel', async () => {
        await sendIncidentReportedEmail(['admin@example.com'], {
          ...baseDetails,
          typeLabel: 'A & B "c"',
        })

        const call = mockSend.mock.calls[0][0]
        expect(call.html).toContain('A &amp; B &quot;c&quot;')
      })
    })
  })

  describe('sendWalkReminderEmail', () => {
    const slotInfo = { date: '2025-07-02', time: '08:00', location: 'MacRitchie' }
    const participants = [{ fullName: 'Charlie', email: 'charlie@example.com' }]

    it('sends reminder with name', async () => {
      await sendWalkReminderEmail('user@example.com', 'Charlie', slotInfo, participants)

      const call = mockSend.mock.calls[0][0]
      expect(call.subject).toBe('Reminder: Upcoming Survey Walk')
      expect(call.html).toContain('Hi Charlie')
      expect(call.html).toContain('2025-07-02')
      expect(call.html).toContain('08:00')
      expect(call.html).toContain('MacRitchie')
    })

    it('uses "Volunteer" when name is null', async () => {
      await sendWalkReminderEmail('user@example.com', null, slotInfo, participants)

      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('Hi Volunteer')
    })

    it('includes walk link', async () => {
      await sendWalkReminderEmail('user@example.com', 'Charlie', slotInfo, participants)

      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('https://primap.org/walk')
    })

    it('includes the participant roster', async () => {
      await sendWalkReminderEmail('user@example.com', 'Charlie', slotInfo, participants)

      const call = mockSend.mock.calls[0][0]
      expect(call.html).toContain('Current participant roster')
      expect(call.html).toContain('charlie@example.com')
    })
  })

  describe('sendWalkParticipantUpdateEmail', () => {
    const slotInfo = { date: '2025-07-02', time: '08:00', location: 'MacRitchie' }
    const participants = [{ fullName: 'Charlie', email: 'charlie@example.com' }]

    it('sends individually to each recipient', async () => {
      await sendWalkParticipantUpdateEmail(
        ['a@example.com', 'b@example.com'],
        slotInfo,
        participants,
        'join',
        'Alex'
      )

      expect(mockSend).toHaveBeenCalledTimes(2)
      expect(mockSend.mock.calls[0][0].to).toBe('a@example.com')
      expect(mockSend.mock.calls[1][0].to).toBe('b@example.com')
    })

    it('includes the updated roster and actor name', async () => {
      await sendWalkParticipantUpdateEmail(
        ['a@example.com'],
        slotInfo,
        participants,
        'late-cancellation',
        'Alex'
      )

      const call = mockSend.mock.calls[0][0]
      expect(call.subject).toBe('Notice: Walk Participant Update')
      expect(call.html).toContain('Alex')
      expect(call.html).toContain('charlie@example.com')
    })
  })
})
