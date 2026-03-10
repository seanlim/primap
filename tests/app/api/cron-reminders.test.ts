import { NextRequest } from 'next/server'

const mockSlotsResult = vi.fn()
const mockMembersResult = vi.fn()

const slotsChain = {
  select: vi.fn().mockReturnThis(),
  eq: mockSlotsResult,
}
const membersChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnValue({ eq: mockMembersResult }),
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) =>
      table === 'walk_slots' ? slotsChain : membersChain
    ),
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
    membersChain.select.mockReturnThis()
  })

  // --- Auth ---

  it('proceeds without auth check when CRON_SECRET is not set', async () => {
    mockSlotsResult.mockResolvedValue({ data: [], error: null })

    const response = await GET(makeRequest('/api/cron/reminders'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.message).toBe('No walks scheduled.')
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
    expect(body.date).toBeDefined()
  })

  // --- Members and email ---

  it('continues without crashing when members query errors', async () => {
    mockSlotsResult.mockResolvedValue({
      data: [{ id: 'slot-1', walk_date: '2026-03-11', start_time: '08:00', location_name: 'Park' }],
      error: null,
    })
    mockMembersResult.mockResolvedValue({
      data: null,
      error: { message: 'Members error' },
    })

    const response = await GET(makeRequest('/api/cron/reminders'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.emailsSent).toBe(0)
  })

  it('continues when members data is null', async () => {
    mockSlotsResult.mockResolvedValue({
      data: [{ id: 'slot-1', walk_date: '2026-03-11', start_time: '08:00', location_name: 'Park' }],
      error: null,
    })
    mockMembersResult.mockResolvedValue({ data: null, error: null })

    const response = await GET(makeRequest('/api/cron/reminders'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.emailsSent).toBe(0)
  })

  it('sends reminder emails to members with email addresses', async () => {
    mockSlotsResult.mockResolvedValue({
      data: [{ id: 'slot-1', walk_date: '2026-03-11', start_time: '08:00', location_name: 'Bukit Timah' }],
      error: null,
    })
    mockMembersResult.mockResolvedValue({
      data: [
        { user_id: 'u1', profiles: { full_name: 'Alice', email: 'alice@test.com' } },
        { user_id: 'u2', profiles: { full_name: 'Bob', email: 'bob@test.com' } },
      ],
      error: null,
    })

    const response = await GET(makeRequest('/api/cron/reminders'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.emailsSent).toBe(2)
    expect(sendWalkReminderEmail).toHaveBeenCalledTimes(2)
    expect(sendWalkReminderEmail).toHaveBeenCalledWith('alice@test.com', 'Alice', {
      date: '2026-03-11',
      time: '08:00',
      location: 'Bukit Timah',
    })
    expect(sendWalkReminderEmail).toHaveBeenCalledWith('bob@test.com', 'Bob', {
      date: '2026-03-11',
      time: '08:00',
      location: 'Bukit Timah',
    })
  })

  it('skips members without an email address', async () => {
    mockSlotsResult.mockResolvedValue({
      data: [{ id: 'slot-1', walk_date: '2026-03-11', start_time: '08:00', location_name: 'Park' }],
      error: null,
    })
    mockMembersResult.mockResolvedValue({
      data: [
        { user_id: 'u1', profiles: { full_name: 'NoEmail', email: '' } },
        { user_id: 'u2', profiles: null },
      ],
      error: null,
    })

    const response = await GET(makeRequest('/api/cron/reminders'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.emailsSent).toBe(0)
    expect(sendWalkReminderEmail).not.toHaveBeenCalled()
  })

  it('returns correct total emailCount across multiple slots', async () => {
    mockSlotsResult.mockResolvedValue({
      data: [
        { id: 'slot-1', walk_date: '2026-03-11', start_time: '08:00', location_name: 'Park A' },
        { id: 'slot-2', walk_date: '2026-03-11', start_time: '14:00', location_name: 'Park B' },
      ],
      error: null,
    })
    mockMembersResult
      .mockResolvedValueOnce({
        data: [{ user_id: 'u1', profiles: { full_name: 'Alice', email: 'alice@test.com' } }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          { user_id: 'u2', profiles: { full_name: 'Bob', email: 'bob@test.com' } },
          { user_id: 'u3', profiles: { full_name: 'Charlie', email: 'charlie@test.com' } },
        ],
        error: null,
      })

    const response = await GET(makeRequest('/api/cron/reminders'))
    const body = await response.json()

    expect(body.emailsSent).toBe(3)
    expect(sendWalkReminderEmail).toHaveBeenCalledTimes(3)
  })
})
