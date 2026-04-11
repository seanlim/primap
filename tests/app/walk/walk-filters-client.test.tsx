import { render, screen } from '@testing-library/react'

const { mockUseSearchParams } = vi.hoisted(() => ({
  mockUseSearchParams: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
  useSearchParams: mockUseSearchParams,
}))

import { WalkFilters } from '@/app/(app)/walk/walk-filters-client'

describe('WalkFilters', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses today in Singapore time for the date picker min', () => {
    vi.setSystemTime(new Date('2026-04-10T16:30:00.000Z'))

    render(<WalkFilters />)

    expect(screen.getByLabelText('Date')).toHaveAttribute('min', '2026-04-11')
  })
})
