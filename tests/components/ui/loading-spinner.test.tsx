import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

describe('LoadingSpinner', () => {
  it('renders spinner element', () => {
    const { container } = render(<LoadingSpinner />)
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<LoadingSpinner className="mt-4" />)
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('mt-4')
  })

  it('uses default empty className when not provided', () => {
    const { container } = render(<LoadingSpinner />)
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('flex items-center justify-center p-8')
  })
})
