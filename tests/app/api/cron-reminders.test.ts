import { NextRequest } from 'next/server'

const mockSlotsResult = vi.fn()
const mockMembersInResult = vi.fn()
const mockSettingsSingle = vi.fn()
const mockWalkUpdateEq = vi.fn()

const slotsChain = {
  select: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  is: mockSlotsResult,
  update: vi.fn().mockReturnValue({
    eq: mockWalkUpdateEq,
  }),
}
const membersChain = {
  select: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnValue({ eq: mockMembersInResult }),
  eq: vi.fn().mockReturnThis(),
}
const settingsChain = {
  select: vi.fn().mockReturnValue({
    limit: vi.fn().mockReturnValue({
      single: mockSettingsSingle,
    }),
  }),
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'app_settings') return settingsChain
      if (table === 'walk_slots') return slotsChain
      if (table === 'slot_memberships') return membersChain
      throw new Error(`Unexpected table ${table}`)
    }),
  })),
}))

vi.mock('@/lib/email', () => ({
  sendWalkReminderEmail: vi.fn(),
}))

import { GET } from '@/app/api/cron/reminders/route'
import { sendWalkReminderEmail } from '@/lib/email'

function makeRequest(path: string, headers?: Record<string, string>): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: headers ?? {},
  })
}

describe('GET /api/cron/reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CRON_SECRET
    slotsChain.select.mockReturnThis()
    slotsChain.gte.mockReturnThis()
    slotsChain.lte.mockReturnThis()
    membersChain.select.mockReturnThis()
    membersChain.in.mockReturnValue({ eq: mockMembersInResult })
    mockSettingsSingle.mockResolvedValue({
      data: {
        reminder_send_weekday: 3,
        reminder_send_time: '13:00:00',
        reminder_window_start_offset_days: 2,
        reminder_window_length_days: 7,
      },
      error: null,
    })
    mockWalkUpdateEq.mockResolvedValue({ error: null })
  })

  // --- Auth ---

  it('proceeds without auth check when CRON_SECRET is not set', async () => {
    mockSlotsResult.mockResolvedValue({ data: [], error: null })

    const response = await GET(makeRequest('/api/cron/reminders'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.message).toBe('No walks scheduled.')
    expect(body.startDate).toBeDefined()
    expect(body.endDate).toBeDefined()
  })

  it('returns 401 when CRON_SECRET is set and token is invalid', async () => {
    process.env.CRON_SECRET = 'my-secret'

    const response = await GET(
      makeRequest('/api/cron/reminders', { Authorization: 'Bearer wrong' })
    )

    expect(response.status).toBe(401)
  })

  it('proceeds when CRON_SECRET is set and token is valid', async () => {
    process.env.CRON_SECRET = 'my-secret'
    mockSlotsResult.mockResolvedValue({ data: [], error: null })

    const response = await GET(
      makeRequest('/api/cron/reminders', { Authorization: 'Bearer my-secret' })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.message).toBe('No walks scheduled.')
  })

  // --- Slots query ---

  it('returns 500 when slots query errors', async () => {
    mockSlotsResult.mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    })

    const response = await GET(makeRequest('/api/cron/reminders'))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('DB error')
  })

  it('returns message when no slots are found', async () => {
    mockSlotsResult.mockResolvedValue({ data: [], error: null })

    const response = await GET(makeRequest('/api/cron/reminders'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.message).toBe('No walks scheduled.')
    expect(body.startDate).toBeDefined()
    expect(body.endDate).toBeDefined()
  })

  // --- Batch members query ---

  it('returns 500 when batch members query errors', async () => {
    mockSlotsResult.mockResolvedValue({
      data: [{ id: 'slot-1', walk_date: '2026-03-11', start_time: '08:00', location_name: 'Park' }],
      error: null,
    })
    mockMembersInResult.mockResolvedValue({
      data: null,
      error: { message: 'Members error' },
    })

    const response = await GET(makeRequest('/api/cron/reminders'))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('Members error')
  })

  it('sends reminder emails to members with email addresses', async () => {
    mockSlotsResult.mockResolvedValue({
      data: [{ id: 'slot-1', walk_date: '2026-03-11', start_time: '08:00', location_name: 'Bukit Timah' }],
      error: null,
    })
    mockMembersInResult.mockResolvedValue({
      data: [
        { slot_id: 'slot-1', user_id: 'u1', profiles: { full_name: 'Alice', email: 'alice@test.com' } },
        { slot_id: 'slot-1', user_id: 'u2', profiles: { full_name: 'Bob', email: 'bob@test.com' } },
      ],
      error: null,
    })

    const response = await GET(makeRequest('/api/cron/reminders'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.emailsSent).toBe(2)
    expect(body.slotsMarkedLate).toBe(1)
    expect(sendWalkReminderEmail).toHaveBeenCalledTimes(2)
    expect(sendWalkReminderEmail).toHaveBeenCalledWith('alice@test.com', 'Alice', {
      date: '2026-03-11',
      time: '08:00',
      location: 'Bukit Timah',
    }, [
      { fullName: 'Alice', email: 'alice@test.com' },
      { fullName: 'Bob', email: 'bob@test.com' },
    ])
    expect(sendWalkReminderEmail).toHaveBeenCalledWith('bob@test.com', 'Bob', {
      date: '2026-03-11',
      time: '08:00',
      location: 'Bukit Timah',
    }, [
      { fullName: 'Alice', email: 'alice@test.com' },
      { fullName: 'Bob', email: 'bob@test.com' },
    ])
    expect(mockWalkUpdateEq).toHaveBeenCalledWith('id', 'slot-1')
  })

  it('skips members without an email address', async () => {
    mockSlotsResult.mockResolvedValue({
      data: [{ id: 'slot-1', walk_date: '2026-03-11', start_time: '08:00', location_name: 'Park' }],
      error: null,
    })
    mockMembersInResult.mockResolvedValue({
      data: [
        { slot_id: 'slot-1', user_id: 'u1', profiles: { full_name: 'NoEmail', email: '' } },
        { slot_id: 'slot-1', user_id: 'u2', profiles: null },
      ],
      error: null,
    })

    const response = await GET(makeRequest('/api/cron/reminders'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.emailsSent).toBe(0)
    expect(body.slotsMarkedLate).toBe(1)
    expect(sendWalkReminderEmail).not.toHaveBeenCalled()
    expect(mockWalkUpdateEq).toHaveBeenCalledWith('id', 'slot-1')
  })

  it('returns correct total emailCount across multiple slots', async () => {
    mockSlotsResult.mockResolvedValue({
      data: [
        { id: 'slot-1', walk_date: '2026-03-11', start_time: '08:00', location_name: 'Park A' },
        { id: 'slot-2', walk_date: '2026-03-11', start_time: '14:00', location_name: 'Park B' },
      ],
      error: null,
    })
    mockMembersInResult.mockResolvedValue({
      data: [
        { slot_id: 'slot-1', user_id: 'u1', profiles: { full_name: 'Alice', email: 'alice@test.com' } },
        { slot_id: 'slot-2', user_id: 'u2', profiles: { full_name: 'Bob', email: 'bob@test.com' } },
        { slot_id: 'slot-2', user_id: 'u3', profiles: { full_name: 'Charlie', email: 'charlie@test.com' } },
      ],
      error: null,
    })

    const response = await GET(makeRequest('/api/cron/reminders'))
    const body = await response.json()

    expect(body.emailsSent).toBe(3)
    expect(sendWalkReminderEmail).toHaveBeenCalledTimes(3)
  })

  it('handles empty members result gracefully', async () => {
    mockSlotsResult.mockResolvedValue({
      data: [{ id: 'slot-1', walk_date: '2026-03-11', start_time: '08:00', location_name: 'Park' }],
      error: null,
    })
    mockMembersInResult.mockResolvedValue({ data: [], error: null })

    const response = await GET(makeRequest('/api/cron/reminders'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.emailsSent).toBe(0)
    expect(body.slotsMarkedLate).toBe(1)
    expect(mockWalkUpdateEq).toHaveBeenCalledWith('id', 'slot-1')
  })

  it('uses Singapore timezone for date calculation', async () => {
    mockSlotsResult.mockResolvedValue({ data: [], error: null })

    const response = await GET(makeRequest('/api/cron/reminders'))
    const body = await response.json()

    expect(body.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(body.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
