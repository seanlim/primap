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
    vi.setSystemTime(new Date('2026-04-11T12:00:00+08:00'))
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('prevents selecting dates before today', () => {
    render(<WalkFilters />)

    expect(screen.getByLabelText('Date')).toHaveAttribute('min', '2026-04-11')
  })
})
