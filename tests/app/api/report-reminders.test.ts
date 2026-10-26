import { NextRequest } from 'next/server'
const { from, sendEmail } = vi.hoisted(() => ({ from: vi.fn(), sendEmail: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from }) }))
vi.mock('@/lib/email', () => ({ sendReportReminderEmail: sendEmail }))
import { GET } from '@/app/api/cron/report-reminders/route'

const slot = { id: 'slot-1', walk_date: '2026-10-24', start_time: '08:00', location_name: 'Park', observations: null }
let slots: unknown[], members: unknown[], deliveries: unknown[]
let databaseError: string | null
const insert = vi.fn()
const membersEq = vi.fn()
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-27T05:00:00Z'))
  process.env.CRON_SECRET = 'test-secret'
  vi.clearAllMocks()
  slots = [slot]
  members = [{ slot_id: 'slot-1', user_id: 'user-1', profiles: { full_name: 'Alice', email: 'alice@example.test', status: 'ACTIVE' } }]
  deliveries = []
  databaseError = null
  sendEmail.mockResolvedValue(true)
  insert.mockResolvedValue({ error: null })
  membersEq.mockImplementation(() => Promise.resolve({ data: members, error: null }))
  from.mockImplementation(table => {
    if (table === 'walk_slots') return { select: () => ({ in: (field: string, dates: string[]) => {
      expect(field).toBe('walk_date')
      expect(dates).toEqual(['2026-10-24', '2026-10-20'])
      return Promise.resolve({ data: slots, error: databaseError ? { message: databaseError } : null })
    } }) }
    if (table === 'slot_memberships') return { select: () => ({ in: () => ({ eq: membersEq }) }) }
    if (table === 'report_reminder_deliveries') return {
      select: () => ({ in: () => Promise.resolve({ data: deliveries, error: null }) }),
      upsert: insert,
    }
    throw Error(`Unexpected table ${table}`)
  })
})
afterEach(() => { vi.useRealTimers(); delete process.env.CRON_SECRET })
function request(token = 'test-secret') {
  return new NextRequest('https://example.test/api/cron/report-reminders', { headers: { Authorization: `Bearer ${token}` } })
}
it('requires the configured cron secret and fails closed when missing', async () => {
  expect((await GET(request('wrong'))).status).toBe(401)
  delete process.env.CRON_SECRET
  expect((await GET(request())).status).toBe(503)
  expect(from).not.toHaveBeenCalled()
})
it('emails active participants and records a successful day-3 reminder', async () => {
  expect((await GET(request())).status).toBe(200)
  expect(sendEmail).toHaveBeenCalledWith('alice@example.test', 'Alice', { date: '2026-10-24', time: '08:00', location: 'Park' }, 'slot-1', 3)
  expect(membersEq).toHaveBeenCalledWith('status', 'ACTIVE')
  expect(insert).toHaveBeenCalledWith({ slot_id: 'slot-1', user_id: 'user-1', reminder_day: 3 }, expect.any(Object))
})
it('sends day-7 reminders to every active participant in a draft report', async () => {
  slots = [{ ...slot, walk_date: '2026-10-20', observations: { status: 'DRAFT' } }]
  members.push({ slot_id: 'slot-1', user_id: 'user-2', profiles: { full_name: 'Bob', email: 'bob@example.test', status: 'ACTIVE' } })
  await GET(request())
  expect(sendEmail).toHaveBeenCalledTimes(2)
  expect(sendEmail).toHaveBeenCalledWith('bob@example.test', 'Bob', expect.any(Object), 'slot-1', 7)
})
it('does not remind a submitted report', async () => {
  slots = [{ ...slot, observations: { status: 'SUBMITTED' } }]
  await GET(request())
  expect(sendEmail).not.toHaveBeenCalled()
})
it('skips already sent reminders while still sending to remaining members', async () => {
  deliveries = [{ slot_id: 'slot-1', user_id: 'user-1', reminder_day: 3 }]
  members.push({ slot_id: 'slot-1', user_id: 'user-2', profiles: { full_name: 'Bob', email: 'bob@example.test', status: 'ACTIVE' } })
  await GET(request())
  expect(sendEmail).toHaveBeenCalledExactlyOnceWith('bob@example.test', 'Bob', expect.any(Object), 'slot-1', 3)
})
it('does not resend after a successful reminder has been recorded', async () => {
  insert.mockImplementation(async row => { deliveries.push(row); return { error: null } })
  await GET(request())
  await GET(request())
  expect(sendEmail).toHaveBeenCalledTimes(1)
})
it('can retry a failed send without resending to successful recipients', async () => {
  sendEmail.mockResolvedValueOnce(false)
  await GET(request())
  expect(insert).not.toHaveBeenCalled()
  await GET(request())
  expect(insert).toHaveBeenCalledTimes(1)
})
it('does not mark a failed send as delivered', async () => {
  sendEmail.mockResolvedValue(false)
  expect((await GET(request())).status).toBe(502)
  expect(insert).not.toHaveBeenCalled()
})
it('skips missing emails and disabled accounts', async () => {
  members = [
    { slot_id: 'slot-1', user_id: 'no-email', profiles: { email: '', status: 'ACTIVE' } },
    { slot_id: 'slot-1', user_id: 'disabled', profiles: { email: 'disabled@example.test', status: 'DISABLED' } },
    { slot_id: 'slot-1', user_id: 'deleted', profiles: null },
  ]
  await GET(request())
  expect(sendEmail).not.toHaveBeenCalled()
})
it('fails safely on a database error', async () => {
  databaseError = 'Failed to read walks'
  expect((await GET(request())).status).toBe(500)
  expect(sendEmail).not.toHaveBeenCalled()
})
it('reports failure if a successful send cannot be recorded', async () => {
  insert.mockResolvedValue({ error: { message: 'Write failed' } })
  expect((await GET(request())).status).toBe(500)
})
