import { fireEvent, render, screen } from '@testing-library/react'
import { WalksClient } from '@/app/(app)/walk/walks-client'
import { ComponentProps } from 'react'

const { mockWalkCalendar, mockEmptyState } = vi.hoisted(() => ({
  mockWalkCalendar: vi.fn(),
  mockEmptyState: vi.fn(),
}))

vi.mock('@/components/ui/WalkCalendar', () => ({
  default: (props: unknown) => {
    mockWalkCalendar(props)
    return <div data-testid="walk-calendar" />
  },
}))

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: (props: unknown) => {
    mockEmptyState(props)
    return <div data-testid="empty-state" />
  }
}))

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation')
  return {
    ...actual,
    redirect: (...args: unknown[]) => mockRedirect(...args),
    useRouter: () => ({
      push: vi.fn()
    })
  }
})

type MockWalkCalendarProps = {
  events: Array<{
    id: string
    locationName: string
    walkDate: string
    startTime: string
    endTime: string
    maxVolunteers: number
    activeCount: number
    isJoined: boolean
  }>
  initialMonth?: Date
  minMonth?: Date
  maxMonth?: Date
  getEventStartTime: (event: { walkDate: string; startTime: string }) => string
  getEventEndTime: (event: { walkDate: string; endTime: string }) => string
  eventClassName: (event: { isJoined: boolean; activeCount: number; maxVolunteers: number }) => string
}

function renderWalksClient(overrides: Partial<ComponentProps<typeof WalksClient>> = {}) {
  return render(
    <WalksClient 
      rounds={[
        { 
          id: 'round-1', 
          name: 'Round Alpha', 
          status: 'OPEN', 
          start_date: '2026-04-01', 
          end_date: '2026-04-30' 
        },
        { 
          id: 'round-2', 
          name: 'Round Beta', 
          status: 'OPEN', 
          start_date: '2026-05-01', 
          end_date: '2026-05-31' 
        },
      ]}
      walks={[
      {
        id: 'slot-1',
        round_id: 'round-1',
        location_name: 'Hill Park',
        walk_date: '2026-04-12',
        start_time: '08:00:00',
        end_time: '10:00:00',
        max_volunteers: 3,
        slot_memberships: [{ id: 'mem-1', user_id: 'user-1', status: 'ACTIVE' }],
      },
      {
        id: 'slot-past',
        round_id: 'round-1',
        location_name: 'Old Trail',
        walk_date: '2026-04-08',
        start_time: '08:00:00',
        end_time: '10:00:00',
        max_volunteers: 3,
        slot_memberships: [],
      },
      {
        id: 'slot-2',
        round_id: 'round-1',
        location_name: 'River Bend',
        walk_date: '2026-04-13',
        start_time: '08:00:00',
        end_time: '10:00:00',
        max_volunteers: 3,
        slot_memberships: [],
      },
      {
        id: 'slot-full',
        round_id: 'round-1',
        location_name: 'River Bend',
        walk_date: '2026-04-14',
        start_time: '08:00:00',
        end_time: '10:00:00',
        max_volunteers: 4,
        slot_memberships: [
          { id: 'mem-2', user_id: 'user-2', status: 'ACTIVE' },
          { id: 'mem-3', user_id: 'user-3', status: 'ACTIVE' },
          { id: 'mem-4', user_id: 'user-4', status: 'ACTIVE' },
          { id: 'mem-5', user_id: 'user-5', status: 'ACTIVE' },
        ],
      },
      {
        id: 'slot-3',
        round_id: 'round-2',
        location_name: 'Coast Trail',
        walk_date: '2026-05-04',
        start_time: '08:00:00',
        end_time: '10:00:00',
        max_volunteers: 2,
        slot_memberships: [],
      },
    ]}
      myMemberships={[{ slot_id: 'slot-1' }]}
      {...overrides}
    />
  )
}

describe('WalksClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-11T12:00:00+08:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('groups available and joined walks by round', async () => {
    renderWalksClient();

    expect(screen.getByText('My Walks')).toBeInTheDocument()
    expect(screen.getByText('Round Alpha')).toBeInTheDocument()
    expect(screen.getByText('Round Beta')).toBeInTheDocument()
    expect(screen.getByText('Current Round')).toBeInTheDocument()
    expect(screen.getAllByText('Joined').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0)

    expect(mockWalkCalendar).toHaveBeenCalledTimes(2)
    const calendarProps = mockWalkCalendar.mock.calls.map(
      ([props]) => props as MockWalkCalendarProps
    )
    const roundAlphaCalendar = calendarProps.find((props) =>
      props.events.some((event) => event.id === 'slot-1')
    )
    const roundBetaCalendar = calendarProps.find((props) =>
      props.events.some((event) => event.id === 'slot-3')
    )

    expect(roundAlphaCalendar).toBeDefined()
    expect(roundBetaCalendar).toBeDefined()

    expect(roundAlphaCalendar?.events).toEqual([
      expect.objectContaining({
        id: 'slot-1',
        locationName: 'Hill Park',
        walkDate: '2026-04-12',
        startTime: '08:00:00',
        endTime: '10:00:00',
        maxVolunteers: 3,
        activeCount: 1,
        isJoined: true,
      }),
      expect.objectContaining({
        id: 'slot-2',
        locationName: 'River Bend',
        walkDate: '2026-04-13',
        activeCount: 0,
        isJoined: false,
      }),
      expect.objectContaining({
        id: 'slot-full',
        locationName: 'River Bend',
        walkDate: '2026-04-14',
        activeCount: 4,
        isJoined: false,
      })
    ])
    expect(roundAlphaCalendar?.events).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'slot-past' }),
      ])
    )
    expect(roundAlphaCalendar?.minMonth).toEqual(new Date('2026-04-01T00:00:00'))
    expect(roundAlphaCalendar?.maxMonth).toEqual(new Date('2026-04-30T00:00:00'))
    expect(roundAlphaCalendar?.getEventStartTime(roundAlphaCalendar.events[0])).toBe('2026-04-12T08:00:00')
    expect(roundAlphaCalendar?.getEventEndTime(roundAlphaCalendar.events[0])).toBe('2026-04-12T10:00:00')
    expect(roundAlphaCalendar?.eventClassName(roundAlphaCalendar.events[0])).toContain('bg-green-50')
    expect(roundAlphaCalendar?.eventClassName(roundAlphaCalendar.events[1])).toContain('bg-sky-50')
    expect(roundAlphaCalendar?.eventClassName(roundAlphaCalendar.events[2])).toContain('bg-gray-50')

    expect(roundBetaCalendar?.events).toEqual([
      expect.objectContaining({
        id: 'slot-3',
        locationName: 'Coast Trail',
        walkDate: '2026-05-04',
        activeCount: 0,
        isJoined: false,
      }),
    ])
    expect(roundBetaCalendar?.minMonth).toEqual(new Date('2026-05-01T00:00:00'))
    expect(roundBetaCalendar?.maxMonth).toEqual(new Date('2026-05-31T00:00:00'))
  })

  it('shows empty state with no walks available when no walks exist', async () => {
    renderWalksClient({ walks: [], myMemberships: [] })

    expect(mockEmptyState).toHaveBeenCalledWith(expect.objectContaining({
      title: "No walks available"
    }))
  })

  it('filters walks correctly', async () => {
    renderWalksClient()

    const locationFilter = document.querySelector('#walk-location-filter') as HTMLInputElement
    const availabilityFilter = document.querySelector('#walk-availability-filter') as HTMLInputElement

    fireEvent.change(locationFilter, { target: { value: 'ive'}})
    fireEvent.change(availabilityFilter, { target: { value: 'full' }})

    expect(screen.getByText('Round Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Round Beta')).not.toBeInTheDocument()

    const calendarProps = mockWalkCalendar.mock.calls.map(
      ([props]) => props as MockWalkCalendarProps
    )
    // First 2 calls of mockWalkCalendar is from initial page render without filters
    const locationFilterOnlyProps = calendarProps[2]
    const bothFilterProps = calendarProps[3]
    
    expect(locationFilterOnlyProps.events).toEqual([
      expect.objectContaining({
        id: 'slot-2',
        locationName: 'River Bend',
        walkDate: '2026-04-13',
        activeCount: 0,
        isJoined: false,
      }),
      expect.objectContaining({
        id: 'slot-full',
        locationName: 'River Bend',
        walkDate: '2026-04-14',
        activeCount: 4,
        isJoined: false,
      })
    ])
    expect(bothFilterProps.events).toEqual([
      expect.objectContaining({
        id: 'slot-full',
        locationName: 'River Bend',
        walkDate: '2026-04-14',
        activeCount: 4,
        isJoined: false,
      })
    ])
  })
})
